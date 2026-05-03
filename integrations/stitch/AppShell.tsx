import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { STITCH_APP_NAME } from "@stitch/shared";
import { DEFAULT_SETTINGS, type PaymentRecord, type SubscriptionItem, type VoiceFaceSettings } from "../fixtures/subscriptions";
import { Dashboard } from "./Dashboard";
import { FaceVerificationPanel } from "./FaceVerificationPanel";
import { GamifiedSettingsView } from "./GamifiedSettingsView";
import { bumpGamifyOnApproval } from "./gamifyStorage";
import {
  authHeaders,
  readJsonFromResponse,
  readSessionId,
  stitchFetch,
  writeDemoMagicAuth,
  writeSessionId,
} from "../lib/stitchBridge";
import { matchStitchVoiceCommand } from "./voiceCommands";

/** Demo auth: account email for local face DB + panels (replace with real auth when you wire it). */
const STITCH_AUTH_EMAIL_KEY = "stitch.userEmail";

function readAuthEmail(): string {
  if (typeof window === "undefined") return "";
  try {
    return (localStorage.getItem(STITCH_AUTH_EMAIL_KEY) || "").trim();
  } catch {
    return "";
  }
}

const STITCH_SIDEBAR_STORAGE_KEY = "stitch.subscriptions.sidebar.v1";
const DUE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

function readSidebarExpandedFromStorage(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(STITCH_SIDEBAR_STORAGE_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw) as { expanded?: boolean };
    return parsed.expanded !== false;
  } catch {
    return true;
  }
}

function persistSidebarExpanded(expanded: boolean) {
  try {
    window.localStorage.setItem(STITCH_SIDEBAR_STORAGE_KEY, JSON.stringify({ expanded }));
  } catch {
    // ignore persistence failures
  }
}

function friendlyErrorMessage(raw: string): string {
  const t = raw.toLowerCase();
  if (/oauth|google_oauth|not configured|client_id|client_secret/.test(t)) {
    return "🔧 Setup needed — let's connect Google in ~2 minutes (see the hero card).";
  }
  if (/network|failed to fetch|8765|html instead of json|bridge|could not reach/i.test(t)) {
    return "🔄 Something glitched — check the bridge, then try again?";
  }
  if (/sign in with google/.test(t)) {
    return "🔐 Link Google first to sync subscription quests.";
  }
  return raw;
}

type SessionProfile = { email: string; pictureUrl: string | null };

export function AppShell({
  onAuthGateRefresh,
  onLogoutSuccess,
}: {
  onAuthGateRefresh?: () => void | Promise<void>;
  onLogoutSuccess?: (message: string) => void;
}) {
  const [view, setView] = useState<"upcoming" | "history" | "settings">("upcoming");
  const [leftRailExpanded, setLeftRailExpanded] = useState(readSidebarExpandedFromStorage);
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [subscriptionsMutating, setSubscriptionsMutating] = useState(false);
  const [googleSignedIn, setGoogleSignedIn] = useState(() => Boolean(readSessionId()));
  const [history, setHistory] = useState<PaymentRecord[]>([]);
  const [settings, setSettings] = useState<VoiceFaceSettings>(DEFAULT_SETTINGS);
  const [statusText, setStatusText] = useState("Monitoring subscription renewals.");
  const [toastError, setToastError] = useState<string | null>(null);
  const [toastSuccess, setToastSuccess] = useState<string | null>(null);
  const [voiceListening, setVoiceListening] = useState(false);
  const [pendingApprovalId, setPendingApprovalId] = useState<string | null>(null);
  const [pingSubscriptionId, setPingSubscriptionId] = useState<string | null>(null);
  const [faceModalOpen, setFaceModalOpen] = useState(false);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [gamifyRefreshTick, setGamifyRefreshTick] = useState(0);
  const pendingApprovalRef = useRef<SubscriptionItem | null>(null);
  const startApprovalRef = useRef<(subscription: SubscriptionItem, source: "button" | "voice" | "auto") => Promise<void>>(
    async () => undefined,
  );
  const [displayYear, setDisplayYear] = useState(2026);
  const [displayMonthIndex, setDisplayMonthIndex] = useState(4);
  const [voiceSupported, setVoiceSupported] = useState(false);
  /** What the user is typing in Settings (do not pass live to FaceVerificationPanel — it would bootstrap / open camera every keystroke). */
  const [authEmailDraft, setAuthEmailDraft] = useState<string>(() => readAuthEmail());
  /** Last saved email; face panel + localStorage only update from this. */
  const [authEmailCommitted, setAuthEmailCommitted] = useState<string>(() => readAuthEmail());
  const [sessionProfile, setSessionProfile] = useState<SessionProfile | null>(null);
  const [settingsAccountTabSignal, setSettingsAccountTabSignal] = useState(0);
  const [settingsBillingTabSignal, setSettingsBillingTabSignal] = useState(0);
  const [gmailDiscoverSignal, setGmailDiscoverSignal] = useState(0);
  const [ragVoiceRun, setRagVoiceRun] = useState<{ id: number; query: string } | null>(null);

  const mapApiSubscription = useCallback((raw: unknown): SubscriptionItem | null => {
    if (!raw || typeof raw !== "object") return null;
    const row = raw as {
      id?: unknown;
      name?: unknown;
      category?: unknown;
      amountUsd?: unknown;
      dueDateIso?: unknown;
      status?: unknown;
      sourceEmail?: unknown;
    };
    const id = typeof row.id === "string" ? row.id : "";
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!id || !name) return null;
    const category = String(row.category || "software");
    const normalizedCategory: SubscriptionItem["category"] = (
      category === "streaming" || category === "music" || category === "fitness" || category === "shopping" ? category : "software"
    ) as SubscriptionItem["category"];
    const amount = Number(row.amountUsd ?? 0);
    const status = String(row.status || "pending");
    const normalizedStatus: SubscriptionItem["status"] = status === "paid" ? "paid" : "pending";
    return {
      id,
      name,
      category: normalizedCategory,
      amountUsd: Number.isFinite(amount) ? amount : 0,
      dueDateIso: typeof row.dueDateIso === "string" && row.dueDateIso ? row.dueDateIso : new Date().toISOString().slice(0, 10),
      status: normalizedStatus,
      sourceEmail: typeof row.sourceEmail === "string" ? row.sourceEmail : undefined,
    };
  }, []);

  const showErrorToast = useCallback((message: string) => {
    const text = friendlyErrorMessage(message);
    setToastError(text);
    window.setTimeout(() => setToastError((curr) => (curr === text ? null : curr)), 4500);
  }, []);

  const showSuccessToast = useCallback((message: string) => {
    setToastSuccess(message);
    window.setTimeout(() => setToastSuccess((curr) => (curr === message ? null : curr)), 4000);
  }, []);

  const loadSubscriptions = useCallback(
    async (opts?: { silent?: boolean }) => {
      const sid = readSessionId();
      if (!sid) {
        setSubscriptions([]);
        setGoogleSignedIn(false);
        return;
      }
      if (!opts?.silent) setSubscriptionsLoading(true);
      try {
        const res = await stitchFetch("/api/subscriptions/list", {
          method: "GET",
          headers: authHeaders(sid),
        });
        const { data, parseError } = await readJsonFromResponse(res);
        if (parseError) {
          showErrorToast(parseError);
          return;
        }
        if (!res.ok) {
          const err = (data as { error?: string } | null)?.error || "Failed to load subscriptions.";
          showErrorToast(err);
          return;
        }
        const rows = ((data as { subscriptions?: unknown[] } | null)?.subscriptions || [])
          .map(mapApiSubscription)
          .filter((r): r is SubscriptionItem => Boolean(r));
        setSubscriptions(rows);
        setGoogleSignedIn(true);
      } catch {
        showErrorToast("Could not reach Stitch bridge.");
      } finally {
        if (!opts?.silent) setSubscriptionsLoading(false);
      }
    },
    [mapApiSubscription, showErrorToast],
  );

  const upsertSubscriptions = useCallback(
    async (items: SubscriptionItem[]) => {
      const sid = readSessionId();
      if (!sid) {
        showErrorToast("Sign in with Google before editing subscriptions.");
        return false;
      }
      setSubscriptionsMutating(true);
      try {
        const res = await stitchFetch("/api/subscriptions/upsert", {
          method: "POST",
          headers: authHeaders(sid),
          body: JSON.stringify({ subscriptions: items }),
        });
        const { data, parseError } = await readJsonFromResponse(res);
        if (parseError || !res.ok) {
          const err = parseError || (data as { error?: string } | null)?.error || "Failed to save subscription.";
          showErrorToast(err);
          return false;
        }
        await loadSubscriptions({ silent: true });
        return true;
      } catch {
        showErrorToast("Subscription save failed.");
        return false;
      } finally {
        setSubscriptionsMutating(false);
      }
    },
    [loadSubscriptions, showErrorToast],
  );

  const deleteSubscription = useCallback(
    async (id: string) => {
      const sid = readSessionId();
      if (!sid) {
        showErrorToast("Sign in with Google before deleting subscriptions.");
        return;
      }
      setSubscriptionsMutating(true);
      try {
        const res = await stitchFetch("/api/subscriptions/delete", {
          method: "POST",
          headers: authHeaders(sid),
          body: JSON.stringify({ id }),
        });
        const { data, parseError } = await readJsonFromResponse(res);
        if (parseError || !res.ok) {
          const err = parseError || (data as { error?: string } | null)?.error || "Failed to delete subscription.";
          showErrorToast(err);
          return;
        }
        await loadSubscriptions({ silent: true });
        setStatusText("Subscription removed.");
      } catch {
        showErrorToast("Subscription delete failed.");
      } finally {
        setSubscriptionsMutating(false);
      }
    },
    [loadSubscriptions, showErrorToast],
  );

  const addSubscription = useCallback(
    async (item: SubscriptionItem) => {
      const ok = await upsertSubscriptions([item]);
      if (ok) setStatusText(`Added “${item.name}”.`);
    },
    [upsertSubscriptions],
  );

  const refreshSessionProfile = useCallback(async () => {
    const sid = readSessionId();
    if (!sid) {
      setSessionProfile(null);
      return;
    }
    try {
      const res = await stitchFetch("/api/auth/status", { headers: authHeaders(sid) });
      const { data, parseError } = await readJsonFromResponse(res);
      if (parseError || !data || typeof data !== "object") {
        setSessionProfile(null);
        return;
      }
      const d = data as {
        authenticated?: boolean;
        accounts?: Array<{ id: number; email: string; pictureUrl?: string | null }>;
        activeEmail?: string | null;
        invalidSession?: boolean;
      };
      if (d.invalidSession || !d.authenticated) {
        setSessionProfile(null);
        return;
      }
      const accounts = d.accounts || [];
      if (accounts.length === 0) {
        setSessionProfile(null);
        return;
      }
      const active = (d.activeEmail || "").trim() || accounts[0]!.email;
      const primary = accounts.find((a) => a.email === active) ?? accounts[0]!;
      setSessionProfile({ email: primary.email, pictureUrl: primary.pictureUrl ?? null });
    } catch {
      setSessionProfile(null);
    }
  }, []);

  const onAuthSessionChange = useCallback(() => {
    setGoogleSignedIn(Boolean(readSessionId()));
    void loadSubscriptions();
    void refreshSessionProfile();
    onAuthGateRefresh?.();
  }, [loadSubscriptions, onAuthGateRefresh, refreshSessionProfile]);

  const performLogout = useCallback(async () => {
    const sid = readSessionId();
    if (sid) {
      await stitchFetch("/api/auth/logout", { method: "POST", headers: authHeaders(sid) }).catch(() => undefined);
    }
    writeSessionId(null);
    writeDemoMagicAuth(false);
    try {
      window.localStorage.removeItem(STITCH_AUTH_EMAIL_KEY);
    } catch {
      /* ignore */
    }
    setAuthEmailDraft("");
    setAuthEmailCommitted("");
    setSessionProfile(null);
    setGoogleSignedIn(false);
    setSubscriptions([]);
    await onAuthGateRefresh?.();
    onLogoutSuccess?.("Signed out successfully.");
  }, [onAuthGateRefresh, onLogoutSuccess]);

  const commitAuthEmail = useCallback(() => {
    const trimmed = authEmailDraft.trim();
    setAuthEmailDraft(trimmed);
    setAuthEmailCommitted(trimmed);
    try {
      if (trimmed) window.localStorage.setItem(STITCH_AUTH_EMAIL_KEY, trimmed);
      else window.localStorage.removeItem(STITCH_AUTH_EMAIL_KEY);
    } catch {
      // ignore quota / private mode
    }
  }, [authEmailDraft]);

  const onGoogleLinkedEmail = useCallback((email: string) => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setAuthEmailDraft(trimmed);
    setAuthEmailCommitted(trimmed);
    try {
      window.localStorage.setItem(STITCH_AUTH_EMAIL_KEY, trimmed);
    } catch {
      /* ignore */
    }
    setGoogleSignedIn(Boolean(readSessionId()));
    void loadSubscriptions();
    void refreshSessionProfile();
  }, [loadSubscriptions, refreshSessionProfile]);

  useEffect(() => {
    void loadSubscriptions();
  }, [loadSubscriptions]);

  useEffect(() => {
    if (view !== "settings") setRagVoiceRun(null);
  }, [view]);

  useEffect(() => {
    if (googleSignedIn) void refreshSessionProfile();
    else setSessionProfile(null);
  }, [googleSignedIn, refreshSessionProfile]);

  const pendingApproval = useMemo(
    () => subscriptions.find((sub) => sub.id === pendingApprovalId) ?? null,
    [pendingApprovalId, subscriptions],
  );
  pendingApprovalRef.current = pendingApproval;
  const pingSubscription = useMemo(
    () => subscriptions.find((sub) => sub.id === pingSubscriptionId) ?? null,
    [pingSubscriptionId, subscriptions],
  );

  useEffect(() => {
    setVoiceSupported("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  }, []);

  useEffect(() => {
    const checkDuePayments = () => {
      const now = Date.now();
      const dueSoon = subscriptions.find((sub) => {
        if (sub.status !== "pending") return false;
        const dueAt = new Date(`${sub.dueDateIso}T00:00:00`).getTime();
        return (dueAt - now) / (24 * 60 * 60 * 1000) <= 1;
      });
      if (!dueSoon) return;
      setPingSubscriptionId(dueSoon.id);
      setStatusText(`${dueSoon.name} is due soon.`);
      void showDesktopPing(dueSoon);
    };
    checkDuePayments();
    const timer = window.setInterval(checkDuePayments, DUE_CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [subscriptions]);

  function cancelFaceApproval() {
    setFaceModalOpen(false);
    setPendingApprovalId(null);
    setStatusText("Face verification cancelled.");
  }

  async function showDesktopPing(subscription: SubscriptionItem) {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted") {
      new Notification(`${subscription.name} due soon`, {
        body: `$${subscription.amountUsd.toFixed(2)} due ${formatDate(subscription.dueDateIso)}.`,
      });
      return;
    }
    if (Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        new Notification(`${subscription.name} due soon`, {
          body: `$${subscription.amountUsd.toFixed(2)} due ${formatDate(subscription.dueDateIso)}.`,
        });
      }
    }
  }

  function runDueCheckNow() {
    const now = Date.now();
    const dueSoon = subscriptions.find((sub) => {
      if (sub.status !== "pending") return false;
      const dueAt = new Date(`${sub.dueDateIso}T00:00:00`).getTime();
      return (dueAt - now) / (24 * 60 * 60 * 1000) <= 1;
    });
    if (!dueSoon) {
      setStatusText("No charges due in the next 24 hours.");
      return;
    }
    setPingSubscriptionId(dueSoon.id);
    setStatusText(`Ping sent for ${dueSoon.name}.`);
  }

  async function startApproval(subscription: SubscriptionItem, source: "button" | "voice" | "auto") {
    if (subscription.status !== "pending") return;
    const threshold = settings.autoApproveUnderUsd;
    if (source !== "auto" && threshold != null && subscription.amountUsd < threshold) {
      await completeApproval(subscription, "auto");
      return;
    }
    setPendingApprovalId(subscription.id);
    if (settings.faceMfa) {
      setFaceModalOpen(true);
      return;
    }
    await completeApproval(subscription, source === "auto" ? "auto" : "manual");
  }

  async function completeApproval(subscription: SubscriptionItem, method: "auto" | "manual") {
    const updated = { ...subscription, status: "paid" as const };
    const ok = await upsertSubscriptions([updated]);
    if (!ok) return;
    setHistory((prev) => [
      {
        id: `payment-${Date.now()}`,
        subscriptionId: subscription.id,
        subscriptionName: subscription.name,
        amountUsd: subscription.amountUsd,
        approvedAtIso: new Date().toISOString(),
        method,
      },
      ...prev,
    ]);
    setPendingApprovalId(null);
    setPingSubscriptionId(null);
    setFaceModalOpen(false);
    bumpGamifyOnApproval();
    setGamifyRefreshTick((n) => n + 1);
    setConfettiTrigger((n) => n + 1);
    setStatusText(
      `${subscription.name} payment approved ${method === "auto" ? "automatically" : "with MFA"}.`,
    );
  }

  startApprovalRef.current = startApproval;

  useEffect(() => {
    if (!settings.voiceActivation || !voiceSupported) {
      setVoiceListening(false);
      return;
    }

    type SpeechCtor = new () => {
      continuous: boolean;
      lang: string;
      interimResults: boolean;
      onstart: (() => void) | null;
      onend: (() => void) | null;
      onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void) | null;
      start: () => void;
      stop: () => void;
    };
    const W = window as Window & {
      SpeechRecognition?: SpeechCtor;
      webkitSpeechRecognition?: SpeechCtor;
    };
    const Recognition = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.onstart = () => setVoiceListening(true);
    recognition.onend = () => setVoiceListening(false);
    recognition.onresult = (event) => {
      const raw = event.results[event.results.length - 1]?.[0]?.transcript ?? "";
      const transcriptLower = raw.toLowerCase();
      const pending = pendingApprovalRef.current;
      if (pending && transcriptLower.includes("approve")) {
        void startApprovalRef.current(pending, "voice");
        return;
      }
      const cmd = matchStitchVoiceCommand(raw);
      if (!cmd) return;

      switch (cmd.type) {
        case "open_rag":
          setRagVoiceRun(null);
          setView("settings");
          setSettingsBillingTabSignal((n) => n + 1);
          window.setTimeout(() => {
            document.getElementById("stitch-linkup-rag")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 120);
          setStatusText("Opened document brain (Settings → Billing).");
          break;
        case "rag_query":
          setView("settings");
          setSettingsBillingTabSignal((n) => n + 1);
          window.setTimeout(() => {
            setRagVoiceRun({ id: Date.now(), query: cmd.query });
            document.getElementById("stitch-linkup-rag")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 100);
          setStatusText("Running your document question…");
          break;
        case "open_settings":
          setView("settings");
          setStatusText("Settings.");
          break;
        case "open_account":
          setView("settings");
          setSettingsAccountTabSignal((n) => n + 1);
          window.requestAnimationFrame(() => {
            document.getElementById("settings-tab-account")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            document.getElementById("settings-panel-account")?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
          setStatusText("Account settings.");
          break;
        case "open_history":
          setView("history");
          setStatusText("Payment history.");
          break;
        case "open_upcoming":
          setView("upcoming");
          setStatusText("Upcoming renewals.");
          break;
        case "scan_gmail":
          if (!readSessionId()) {
            setStatusText("Sign in with Google to scan Gmail.");
            break;
          }
          setView("upcoming");
          window.setTimeout(() => {
            setGmailDiscoverSignal((n) => n + 1);
            document.getElementById("stitch-gmail-discovery")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 0);
          setStatusText("Scanning subscriptions from email…");
          break;
        default:
          break;
      }
    };
    recognition.start();
    return () => recognition.stop();
  }, [settings.voiceActivation, voiceSupported]);

  function toggleSetting<K extends keyof VoiceFaceSettings>(key: K, value: VoiceFaceSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  const openAccountSettings = useCallback(() => {
    setView("settings");
    setSettingsAccountTabSignal((n) => n + 1);
    window.requestAnimationFrame(() => {
      document.getElementById("settings-tab-account")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      document.getElementById("settings-panel-account")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const accountEmailDisplay = (sessionProfile?.email || authEmailCommitted.trim() || "").trim();
  const accountPictureUrl = sessionProfile?.pictureUrl ?? null;
  const showLeftRailAccount =
    googleSignedIn && Boolean(sessionProfile?.email || authEmailCommitted.trim());

  return (
    <div className="relative min-h-[100dvh] min-w-0 text-stitch-text">
      <div
        className={`relative z-10 flex min-h-[100dvh] min-w-0 flex-col overflow-x-hidden bg-transparent lg:grid lg:h-[100dvh] lg:max-h-[100dvh] lg:min-h-0 lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden lg:transition-[grid-template-columns] lg:duration-200 lg:ease-out ${
          leftRailExpanded
            ? "lg:grid-cols-[240px_minmax(0,1fr)_280px]"
            : "lg:grid-cols-[64px_minmax(0,1fr)_280px]"
        }`}
      >
      <LeftRail
        activeView={view}
        compact={!leftRailExpanded}
        onToggleCompact={() => {
          setLeftRailExpanded((prev) => {
            const next = !prev;
            persistSidebarExpanded(next);
            return next;
          });
        }}
        onCheckNow={runDueCheckNow}
        onSelectUpcoming={() => setView("upcoming")}
        onSelectHistory={() => setView("history")}
        onSelectSettings={() => setView("settings")}
        accountEmail={accountEmailDisplay}
        accountPictureUrl={accountPictureUrl}
        onOpenAccountSettings={openAccountSettings}
        onLogout={() => void performLogout()}
        showAccountMenu={showLeftRailAccount}
      />
      <CenterPane
        view={view}
        subscriptions={subscriptions}
        subscriptionsLoading={subscriptionsLoading}
        subscriptionsMutating={subscriptionsMutating}
        history={history}
        settings={settings}
        statusText={statusText}
        voiceListening={voiceListening}
        pendingApproval={pendingApproval}
        faceMfaOpen={faceModalOpen}
        onCancelFaceMfa={cancelFaceApproval}
        onFacePurchaseVerified={() => {
          const sub = pendingApprovalRef.current;
          if (sub) void completeApproval(sub, "manual");
        }}
        onApprove={(subscription) => void startApproval(subscription, "button")}
        onDeleteSubscription={(id) => void deleteSubscription(id)}
        onAddSubscription={(item) => void addSubscription(item)}
        googleSignedIn={googleSignedIn}
        onApproveByVoice={() => {
          if (pendingApproval) {
            void startApproval(pendingApproval, "voice");
          }
        }}
        onToggleSetting={toggleSetting}
        authEmailDraft={authEmailDraft}
        onAuthEmailDraftChange={setAuthEmailDraft}
        onAuthEmailCommit={commitAuthEmail}
        authEmailCommitted={authEmailCommitted}
        onGoogleLinkedEmail={onGoogleLinkedEmail}
        onAuthSessionChange={onAuthSessionChange}
        onGmailImportSuccess={showSuccessToast}
        onGmailImportError={showErrorToast}
        onSubscriptionsRefresh={() => void loadSubscriptions({ silent: true })}
        confettiTrigger={confettiTrigger}
        gamifyRefreshTick={gamifyRefreshTick}
        onRequestGoogleConnect={() => {
          setView("settings");
          setSettingsAccountTabSignal((n) => n + 1);
          window.requestAnimationFrame(() => {
            document.getElementById("stitch-google-signin")?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
        }}
        settingsAccountTabSignal={settingsAccountTabSignal}
        settingsBillingTabSignal={settingsBillingTabSignal}
        ragVoiceRun={ragVoiceRun}
        gmailDiscoverSignal={gmailDiscoverSignal}
      />
      <RightRail
        subscriptions={subscriptions}
        displayYear={displayYear}
        displayMonthIndex={displayMonthIndex}
        onPrevMonth={() => {
          if (displayMonthIndex === 0) {
            setDisplayMonthIndex(11);
            setDisplayYear((prev) => prev - 1);
            return;
          }
          setDisplayMonthIndex((prev) => prev - 1);
        }}
        onNextMonth={() => {
          if (displayMonthIndex === 11) {
            setDisplayMonthIndex(0);
            setDisplayYear((prev) => prev + 1);
            return;
          }
          setDisplayMonthIndex((prev) => prev + 1);
        }}
      />
      {pingSubscription ? (
        <PaymentPingPopup
          subscription={pingSubscription}
          onApproveByVoice={() => void startApproval(pingSubscription, "voice")}
          onApprove={() => void startApproval(pingSubscription, "button")}
          onSnooze={() => {
            setPingSubscriptionId(null);
            setStatusText("Ping snoozed.");
          }}
        />
      ) : null}
      {toastError ? (
        <div className="fixed right-4 top-4 z-50 max-w-sm rounded-sm border-2 border-black bg-stitch-card px-3 py-2 font-body text-xs font-semibold text-stitch-error shadow-[4px_4px_0_0_#000]">
          {toastError}
        </div>
      ) : null}
      {toastSuccess ? (
        <div className="fixed right-4 top-16 z-50 max-w-sm rounded-sm border-2 border-black bg-stitch-card px-3 py-2 font-body text-xs font-semibold text-stitch-success shadow-[4px_4px_0_0_#000]">
          {toastSuccess}
        </div>
      ) : null}
      </div>
    </div>
  );
}

function LeftRailAccountBlock({
  compact,
  email,
  pictureUrl,
  onOpenAccountSettings,
  onLogout,
}: {
  compact: boolean;
  email: string;
  pictureUrl: string | null;
  onOpenAccountSettings: () => void;
  onLogout: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const initial = email ? email[0]!.toUpperCase() : "?";

  useEffect(() => {
    if (!open) return;
    const updateMenuPosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuHeight = menuRef.current?.offsetHeight ?? 180;
      const preferredTop = rect.bottom - 8;
      const flippedTop = rect.top - menuHeight + 8;
      const top =
        preferredTop + menuHeight > window.innerHeight - 8
          ? Math.max(8, flippedTop)
          : Math.max(8, preferredTop);
      setMenuPos({
        top,
        left: Math.max(8, Math.min(rect.right + 12, window.innerWidth - 280)),
      });
    };
    updateMenuPosition();
    const raf = window.requestAnimationFrame(updateMenuPosition);
    const onDoc = (ev: MouseEvent) => {
      if (rootRef.current?.contains(ev.target as Node)) return;
      if (menuRef.current?.contains(ev.target as Node)) return;
      setOpen(false);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setOpen(false);
    };
    const onViewport = () => updateMenuPosition();
    document.addEventListener("mousedown", onDoc, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onViewport);
    window.addEventListener("scroll", onViewport, true);
    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", onDoc, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onViewport);
      window.removeEventListener("scroll", onViewport, true);
    };
  }, [open]);

  async function handleLogout() {
    await onLogout();
    setOpen(false);
  }

  function handleAccountSettings() {
    onOpenAccountSettings();
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu${email ? `, ${email}` : ""}`}
        className={
          compact
            ? "mx-auto flex h-10 w-10 items-center justify-center rounded-full border-2 border-black bg-stitch-elevated text-stitch-heading shadow-[2px_2px_0_0_#000] transition hover:bg-stitch-variant"
            : "flex w-full items-center gap-2 rounded-sm border-2 border-black bg-stitch-elevated p-2 text-left shadow-[2px_2px_0_0_#000] transition hover:bg-stitch-variant"
        }
      >
        {pictureUrl ? (
          <img
            src={pictureUrl}
            alt=""
            className={`shrink-0 rounded-full object-cover ring-1 ring-stitch-border/60 ${compact ? "h-8 w-8" : "h-9 w-9"}`}
          />
        ) : compact ? (
          <span className="font-body text-xs font-bold">{initial}</span>
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stitch-variant font-body text-xs font-bold text-stitch-heading">
            {initial}
          </div>
        )}
        {!compact ? (
          <div className="min-w-0 flex-1 text-left">
            <p className="font-body text-[10px] font-semibold uppercase tracking-wide text-stitch-muted">Account</p>
            <p className="truncate font-body text-xs font-semibold text-stitch-heading">{email || "Signed in"}</p>
          </div>
        ) : null}
      </button>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{ top: menuPos.top, left: menuPos.left }}
              className="fixed z-[120] w-[min(16rem,calc(100vw-1rem))]"
            >
              <div className="rounded-sm border-2 border-black bg-stitch-surface-low p-2 shadow-[6px_6px_0_0_var(--stitch-shadow-color)]">
                <p className="truncate px-2 py-1.5 font-body text-[11px] text-stitch-muted" title={email}>
                  {email}
                </p>
                <div className="my-1 border-t-2 border-black" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleAccountSettings}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left font-body text-xs font-semibold text-stitch-heading transition hover:bg-stitch-elevated"
                >
                  <span className="material-symbols-outlined text-[20px] leading-none" aria-hidden>
                    settings
                  </span>
                  Account Settings
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleLogout()}
                  className="mt-1 flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left font-body text-xs font-semibold text-stitch-heading transition hover:bg-red-950/50 hover:text-red-300"
                >
                  <span className="material-symbols-outlined text-[20px] leading-none" aria-hidden>
                    logout
                  </span>
                  Logout
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function LeftRail({
  activeView,
  compact,
  onToggleCompact,
  onCheckNow,
  onSelectUpcoming,
  onSelectHistory,
  onSelectSettings,
  accountEmail,
  accountPictureUrl,
  onOpenAccountSettings,
  onLogout,
  showAccountMenu,
}: {
  activeView: "upcoming" | "history" | "settings";
  compact: boolean;
  onToggleCompact: () => void;
  onCheckNow: () => void;
  onSelectUpcoming: () => void;
  onSelectHistory: () => void;
  onSelectSettings: () => void;
  accountEmail: string;
  accountPictureUrl: string | null;
  onOpenAccountSettings: () => void;
  onLogout: () => void | Promise<void>;
  showAccountMenu: boolean;
}) {
  return (
    <aside
      className={`order-2 flex min-h-0 min-w-0 flex-col overscroll-y-contain border-t-2 border-black bg-stitch-surface-lowest lg:relative lg:order-none lg:h-full lg:max-h-full lg:min-w-0 lg:overflow-x-hidden lg:overflow-y-visible lg:border-t-0 lg:border-r-2 lg:shadow-[4px_0_0_0_#000] ${
        compact ? "lg:px-2 lg:pt-3 lg:pb-4" : "lg:p-4 lg:pt-5"
      } overflow-x-hidden overflow-y-auto px-4 py-3`}
    >
      <div className="hidden lg:mb-2 lg:flex lg:justify-end">
        <button
          type="button"
          onClick={onToggleCompact}
          aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border-2 border-black bg-stitch-elevated text-stitch-heading shadow-[2px_2px_0_0_#000] transition hover:bg-stitch-variant"
        >
          {compact ? <IconChevronRight /> : <IconChevronLeft />}
        </button>
      </div>
      <div className={`flex flex-col gap-1 ${compact ? "lg:items-center" : ""}`}>
        <p
          className={`font-display font-black italic tracking-tight text-stitch-primary-container ${compact ? "lg:text-base" : "text-xl"}`}
        >
          {STITCH_APP_NAME}
        </p>
        <p className={`font-display text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 ${compact ? "lg:sr-only" : ""}`}>
          Billing · identity · automation
        </p>
      </div>
      <div className="pt-3 pb-4">
        <button
          type="button"
          onClick={onCheckNow}
          className="noir-cmd-primary font-body w-full rounded py-3 text-sm"
        >
          <span className={compact ? "lg:hidden" : ""}>Run due checks</span>
          <span className={compact ? "hidden lg:inline" : "hidden"}>+</span>
        </button>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto lg:min-h-0">
        <NavRow active={activeView === "upcoming"} compact={compact} icon={<NavMaterialIcon name="dashboard" />} label="Upcoming" onClick={onSelectUpcoming} />
        <NavRow active={activeView === "history"} compact={compact} icon={<NavMaterialIcon name="history" />} label="History" onClick={onSelectHistory} />
        <NavRow active={activeView === "settings"} compact={compact} icon={<NavMaterialIcon name="settings" />} label="Settings" onClick={onSelectSettings} />
      </nav>

      {showAccountMenu ? (
        <div className="mt-auto shrink-0 border-t-2 border-black pt-3">
          <LeftRailAccountBlock
            compact={compact}
            email={accountEmail}
            pictureUrl={accountPictureUrl}
            onOpenAccountSettings={onOpenAccountSettings}
            onLogout={onLogout}
          />
        </div>
      ) : null}
    </aside>
  );
}

function NavRow({
  label,
  icon,
  active,
  compact,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  compact?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "flex items-center gap-3 rounded-sm border-2 border-black bg-stitch-primary-container py-2.5 pl-2.5 pr-3 font-display text-sm font-bold tracking-tight text-stitch-on-primary-fixed shadow-[2px_2px_0_0_#000] translate-x-px"
          : "flex items-center gap-3 rounded-sm py-2.5 pl-2.5 pr-3 font-display text-sm font-bold tracking-tight text-zinc-500 transition duration-150 hover:translate-x-px hover:bg-zinc-900 hover:text-stitch-primary-container"
      }
    >
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center ${active ? "text-stitch-on-primary-fixed" : "text-current"}`}>{icon}</span>
      <span className={compact ? "lg:sr-only" : ""}>{label}</span>
    </button>
  );
}

function CenterPane({
  view,
  subscriptions,
  subscriptionsLoading,
  subscriptionsMutating,
  history,
  settings,
  statusText,
  voiceListening,
  pendingApproval,
  faceMfaOpen,
  onCancelFaceMfa,
  onFacePurchaseVerified,
  onApprove,
  onDeleteSubscription,
  onAddSubscription,
  googleSignedIn,
  onApproveByVoice,
  onToggleSetting,
  authEmailDraft,
  onAuthEmailDraftChange,
  onAuthEmailCommit,
  authEmailCommitted,
  onGoogleLinkedEmail,
  onAuthSessionChange,
  onGmailImportSuccess,
  onGmailImportError,
  onSubscriptionsRefresh,
  confettiTrigger,
  gamifyRefreshTick,
  onRequestGoogleConnect,
  settingsAccountTabSignal,
  settingsBillingTabSignal,
  ragVoiceRun,
  gmailDiscoverSignal,
}: {
  view: "upcoming" | "history" | "settings";
  subscriptions: SubscriptionItem[];
  subscriptionsLoading: boolean;
  subscriptionsMutating: boolean;
  history: PaymentRecord[];
  settings: VoiceFaceSettings;
  statusText: string;
  voiceListening: boolean;
  pendingApproval: SubscriptionItem | null;
  faceMfaOpen: boolean;
  onCancelFaceMfa: () => void;
  onFacePurchaseVerified: () => void;
  onApprove: (subscription: SubscriptionItem) => void;
  onDeleteSubscription: (id: string) => void;
  onAddSubscription: (item: SubscriptionItem) => void;
  googleSignedIn: boolean;
  onApproveByVoice: () => void;
  onToggleSetting: <K extends keyof VoiceFaceSettings>(key: K, value: VoiceFaceSettings[K]) => void;
  authEmailDraft: string;
  onAuthEmailDraftChange: (email: string) => void;
  onAuthEmailCommit: () => void;
  authEmailCommitted: string;
  onGoogleLinkedEmail: (email: string) => void;
  onAuthSessionChange: () => void;
  onGmailImportSuccess: (message: string) => void;
  onGmailImportError: (message: string) => void;
  onSubscriptionsRefresh: () => void;
  confettiTrigger: number;
  gamifyRefreshTick: number;
  onRequestGoogleConnect: () => void;
  settingsAccountTabSignal: number;
  settingsBillingTabSignal: number;
  ragVoiceRun: { id: number; query: string } | null;
  gmailDiscoverSignal: number;
}) {
  if (view === "upcoming") {
    return (
      <main className="order-1 flex min-h-0 min-w-0 w-full flex-1 flex-col bg-transparent lg:order-none lg:h-full">
        {faceMfaOpen && pendingApproval ? (
          <div className="shrink-0 border-b-2 border-black bg-stitch-card px-4 py-3 lg:px-5">
            <FaceVerificationPanel
              purpose="purchase"
              purchaseSubtitle={`${pendingApproval.name} · $${pendingApproval.amountUsd.toFixed(2)}`}
              initialEmail={authEmailCommitted}
              onPurchaseVerified={onFacePurchaseVerified}
              onPurchaseCancel={onCancelFaceMfa}
            />
          </div>
        ) : null}
        <Dashboard
          googleSignedIn={googleSignedIn}
          authEmailCommitted={authEmailCommitted}
          history={history}
          subscriptions={subscriptions}
          subscriptionsLoading={subscriptionsLoading}
          subscriptionsMutating={subscriptionsMutating}
          confettiTrigger={confettiTrigger}
          gamifyRefreshTick={gamifyRefreshTick}
          onApprove={onApprove}
          onDelete={onDeleteSubscription}
          onAdd={onAddSubscription}
          onGmailImportSuccess={onGmailImportSuccess}
          onGmailImportError={onGmailImportError}
          onSubscriptionsRefresh={onSubscriptionsRefresh}
          voiceListening={voiceListening}
          voiceActive={settings.voiceActivation}
          pendingLabel={pendingApproval?.name}
          onApproveByVoice={onApproveByVoice}
          onRequestGoogleConnect={onRequestGoogleConnect}
          gmailDiscoverSignal={gmailDiscoverSignal}
        />
      </main>
    );
  }

  return (
    <main className="order-1 flex min-h-0 min-w-0 w-full flex-1 flex-col bg-transparent lg:order-none lg:h-full">
      <header className="flex shrink-0 flex-col gap-2 border-b-2 border-black bg-stitch-topbar px-4 py-3 shadow-[0_4px_0_0_#000] lg:px-5">
        <h1 className="font-display text-lg font-bold uppercase tracking-tighter text-stitch-heading">
          {view === "history" ? "Payment history" : "Settings"}
        </h1>
        <p className="font-body text-xs text-stitch-text">{statusText}</p>
      </header>
      <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 lg:px-5">
        {faceMfaOpen && pendingApproval ? (
          <FaceVerificationPanel
            purpose="purchase"
            purchaseSubtitle={`${pendingApproval.name} · $${pendingApproval.amountUsd.toFixed(2)}`}
            initialEmail={authEmailCommitted}
            onPurchaseVerified={onFacePurchaseVerified}
            onPurchaseCancel={onCancelFaceMfa}
          />
        ) : null}
        {view === "history" ? <PaymentHistory records={history} /> : null}
        {view === "settings" ? (
          <GamifiedSettingsView
            settings={settings}
            onToggleSetting={onToggleSetting}
            accountEmailDraft={authEmailDraft}
            onAccountEmailDraftChange={onAuthEmailDraftChange}
            onAccountEmailCommit={onAuthEmailCommit}
            authEmailCommitted={authEmailCommitted}
            onGoogleLinkedEmail={onGoogleLinkedEmail}
            onAuthSessionChange={onAuthSessionChange}
            openAccountTabSignal={settingsAccountTabSignal}
            openBillingTabSignal={settingsBillingTabSignal}
            ragVoiceRunRequest={ragVoiceRun}
          />
        ) : null}
      </div>
    </main>
  );
}

function PaymentHistory({ records }: { records: PaymentRecord[] }) {
  const monthlyTotal = records.reduce((sum, item) => sum + item.amountUsd, 0);
  return (
    <section className="noir-card p-4 md:p-5">
      <div className="ink-line flex flex-wrap items-center justify-between gap-2 pb-4">
        <p className="font-display text-lg font-bold uppercase tracking-tight text-stitch-heading">Payment history</p>
        <span className="font-mono text-sm font-bold text-stitch-success">Σ ${monthlyTotal.toFixed(2)}</span>
      </div>
      {records.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-stitch-border bg-stitch-surface/80 p-6 text-center font-body text-sm text-stitch-text">
          No approved payments yet. Approve a renewal from Upcoming to see it here.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {records.map((record) => (
            <li key={record.id} className="noir-card-sm p-3">
              <p className="font-body text-sm font-semibold text-stitch-heading">
                {record.subscriptionName} · <span className="font-mono text-stitch-success">${record.amountUsd.toFixed(2)}</span>
              </p>
              <p className="font-body text-xs text-stitch-muted">
                {formatDateTime(record.approvedAtIso)} · {record.method}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PaymentPingPopup({
  subscription,
  onApproveByVoice,
  onApprove,
  onSnooze,
}: {
  subscription: SubscriptionItem;
  onApproveByVoice: () => void;
  onApprove: () => void;
  onSnooze: () => void;
}) {
  return (
    <div className="fixed right-4 bottom-24 z-40 w-[min(92vw,26rem)] rounded-sm border-2 border-black bg-stitch-surface-low p-4 shadow-[4px_4px_0_0_#000]">
      <p className="font-display text-sm font-bold text-stitch-heading">Payment due: {subscription.name}</p>
      <p className="mt-1 font-mono text-xs text-stitch-error">
        ${subscription.amountUsd.toFixed(2)} due {formatDate(subscription.dueDateIso)}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onApproveByVoice}
          className="rounded-sm border-2 border-black bg-stitch-elevated px-3 py-1.5 font-body text-xs font-semibold text-stitch-heading shadow-[2px_2px_0_0_#000] hover:bg-stitch-variant"
        >
          Approve by voice
        </button>
        <button type="button" onClick={onApprove} className="noir-cmd-primary rounded-sm px-3 py-1.5 font-body text-xs">
          Approve
        </button>
        <button
          type="button"
          onClick={onSnooze}
          className="rounded-sm border-2 border-black bg-transparent px-3 py-1.5 font-body text-xs font-semibold text-zinc-500 hover:text-stitch-heading"
        >
          Snooze
        </button>
      </div>
    </div>
  );
}

function RightRail({
  subscriptions,
  displayYear,
  displayMonthIndex,
  onPrevMonth,
  onNextMonth,
}: {
  subscriptions: SubscriptionItem[];
  displayYear: number;
  displayMonthIndex: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const month = getMonthLabel(displayYear, displayMonthIndex);
  const calendarCells = buildCalendarGrid(displayYear, displayMonthIndex);
  const dueDates = new Set(subscriptions.map((item) => item.dueDateIso));
  return (
    <aside className="order-3 flex min-h-0 min-w-0 w-full flex-col overflow-x-hidden border-t-2 border-black bg-stitch-surface-lowest lg:h-full lg:max-h-full lg:border-t-0 lg:border-l-2 lg:shadow-[-4px_0_0_0_#000] lg:p-4 lg:pt-5">
      <p className="font-display px-4 pt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-stitch-muted lg:px-0 lg:pt-0">
        Renewal calendar
      </p>
      <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 lg:px-0">
        <div className="noir-card p-4">
          <div className="mt-1 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onPrevMonth}
              className="flex h-7 w-7 items-center justify-center rounded-sm border-2 border-black bg-stitch-elevated text-sm font-semibold text-stitch-heading shadow-[2px_2px_0_0_#000] hover:bg-stitch-variant"
            >
              {"<"}
            </button>
            <p className="font-display text-sm font-bold text-stitch-heading">{month.label}</p>
            <button
              type="button"
              onClick={onNextMonth}
              className="flex h-7 w-7 items-center justify-center rounded-sm border-2 border-black bg-stitch-elevated text-sm font-semibold text-stitch-heading shadow-[2px_2px_0_0_#000] hover:bg-stitch-variant"
            >
              {">"}
            </button>
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {["M", "T", "W", "T", "F", "S", "S"].map((day, dowIdx) => (
              <span key={`cal-dow-${dowIdx}`} className="text-center font-body text-[10px] font-semibold text-stitch-muted">
                {day}
              </span>
            ))}
            {calendarCells.map((cell, index) => (
              <span
                key={`${cell.iso ?? "empty"}-${index}`}
                className={
                  cell.iso == null
                    ? "h-7"
                    : `flex h-7 items-center justify-center rounded text-xs font-body ${
                        dueDates.has(cell.iso)
                          ? "border-2 border-black bg-stitch-primary-container font-semibold text-stitch-on-primary-fixed shadow-[2px_2px_0_0_#000]"
                          : "bg-stitch-elevated/90 text-stitch-text"
                      }`
                }
              >
                {cell.day ?? ""}
              </span>
            ))}
          </div>
          <p className="mt-2 font-body text-xs text-stitch-muted">Highlighted dates have renewals due.</p>
        </div>
      </div>
    </aside>
  );
}

function getMonthLabel(year: number, monthIndex: number) {
  const source = new Date(year, monthIndex, 1);
  return { year, monthIndex, label: source.toLocaleString(undefined, { month: "long", year: "numeric" }) };
}

function buildCalendarGrid(year: number, monthIndex: number) {
  const first = new Date(year, monthIndex, 1);
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<{ day?: number; iso?: string }> = [];
  for (let i = 0; i < lead; i += 1) cells.push({});
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ day, iso });
  }
  return cells;
}

function formatDate(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function NavMaterialIcon({ name }: { name: "dashboard" | "history" | "settings" }) {
  return (
    <span className="material-symbols-outlined text-[22px] leading-none" aria-hidden>
      {name}
    </span>
  );
}

function IconChevronLeft() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path d="M14 6l-6 6 6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path d="M10 6l6 6-6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

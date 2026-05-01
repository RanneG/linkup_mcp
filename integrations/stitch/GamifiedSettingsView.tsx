import { useEffect, useRef, useState } from "react";
import type { VoiceFaceSettings } from "../fixtures/subscriptions";
import { AppearanceSection } from "./AppearanceSection";
import { FaceVerificationPanel } from "./FaceVerificationPanel";
import { GoogleSignInPanel } from "./GoogleSignInPanel";
import { LinkupRagPanel } from "./LinkupRagPanel";
import { SettingsPanel } from "./SettingsPanel";

type TabId = "appearance" | "faceVerification" | "billing" | "notifications" | "account";

const TABS: { id: TabId; label: string; emoji: string }[] = [
  { id: "appearance", label: "Appearance", emoji: "🎨" },
  { id: "faceVerification", label: "Face verification", emoji: "🛡️" },
  { id: "billing", label: "Billing", emoji: "💳" },
  { id: "notifications", label: "Notifications", emoji: "🔔" },
  { id: "account", label: "Account", emoji: "👤" },
];

export type GamifiedSettingsViewProps = {
  settings: VoiceFaceSettings;
  onToggleSetting: <K extends keyof VoiceFaceSettings>(key: K, value: VoiceFaceSettings[K]) => void;
  accountEmailDraft: string;
  onAccountEmailDraftChange: (email: string) => void;
  onAccountEmailCommit: () => void;
  authEmailCommitted: string;
  onGoogleLinkedEmail: (email: string) => void;
  onAuthSessionChange: () => void;
  /** Increment from parent to switch to Account tab (e.g. account dock). */
  openAccountTabSignal?: number;
};

export function GamifiedSettingsView({
  settings,
  onToggleSetting,
  accountEmailDraft,
  onAccountEmailDraftChange,
  onAccountEmailCommit,
  authEmailCommitted,
  onGoogleLinkedEmail,
  onAuthSessionChange,
  openAccountTabSignal = 0,
}: GamifiedSettingsViewProps) {
  const [tab, setTab] = useState<TabId>("appearance");
  const prevSignal = useRef(0);

  useEffect(() => {
    if (openAccountTabSignal > prevSignal.current) {
      prevSignal.current = openAccountTabSignal;
      setTab("account");
    }
  }, [openAccountTabSignal]);

  return (
    <section className="noir-card p-4 md:p-5" aria-label="Settings">
      <p className="font-display text-lg font-bold uppercase tracking-tighter text-stitch-heading">Settings</p>
      <p className="mt-1 font-body text-sm text-stitch-text">Manage settings by section instead of long scrolling.</p>

      <div className="mt-6 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-stretch">
        <div className="rounded-sm border border-stitch-border bg-stitch-surface/70 p-3 md:min-h-[24rem]">
          <div className="flex flex-wrap gap-3 overflow-x-auto pb-1 md:h-full md:flex-col md:overflow-visible md:pb-0" role="tablist" aria-label="Settings sections">
            {TABS.filter((t) => t.id !== "account").map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                id={`settings-tab-${t.id}`}
                aria-controls={`settings-panel-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 rounded-sm border-2 border-black px-4 py-3 text-left font-display text-sm font-bold uppercase tracking-tight transition md:w-full ${
                  tab === t.id
                    ? "bg-stitch-primary-container text-stitch-on-primary-fixed shadow-[4px_4px_0_0_#000] -translate-x-0.5 -translate-y-0.5"
                    : "bg-stitch-topbar text-stitch-text shadow-[2px_2px_0_0_#000] hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_0_#000]"
                }`}
              >
                <span aria-hidden>{t.emoji}</span> {t.label}
              </button>
            ))}
            <button
              type="button"
              role="tab"
              aria-selected={tab === "account"}
              id="settings-tab-account"
              aria-controls="settings-panel-account"
              onClick={() => setTab("account")}
              className={`flex items-center gap-2 rounded-sm border-2 border-black px-4 py-3 text-left font-display text-sm font-bold uppercase tracking-tight transition md:mt-auto md:w-full ${
                tab === "account"
                  ? "bg-stitch-primary-container text-stitch-on-primary-fixed shadow-[4px_4px_0_0_#000] -translate-x-0.5 -translate-y-0.5"
                  : "bg-stitch-topbar text-stitch-text shadow-[2px_2px_0_0_#000] hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_0_#000]"
              }`}
            >
              <span aria-hidden>👤</span> Account
            </button>
          </div>
        </div>

        <div className="min-h-[12rem]">
        {tab === "appearance" ? (
          <div id="settings-panel-appearance" role="tabpanel" aria-labelledby="settings-tab-appearance" className="space-y-4">
            <AppearanceSection />
          </div>
        ) : null}
        {tab === "faceVerification" ? (
          <div id="settings-panel-faceVerification" role="tabpanel" aria-labelledby="settings-tab-faceVerification" className="space-y-4">
            <div className="rounded-lg border border-stitch-border bg-stitch-surface/80 p-3 font-body text-sm text-stitch-text">
              <strong className="text-stitch-heading">Face verification</strong> — enroll once, then approve payments with a quick
              glance. Progress is shown in the panel below.
            </div>
            <FaceVerificationPanel initialEmail={authEmailCommitted} />
          </div>
        ) : null}
        {tab === "billing" ? (
          <div id="settings-panel-billing" role="tabpanel" aria-labelledby="settings-tab-billing" className="space-y-4">
            <div className="noir-card-sm p-4 font-body text-sm text-stitch-text">
              <p className="font-semibold text-stitch-heading">Billing</p>
              <p className="mt-1 text-xs text-stitch-muted">Demo billing only — no real charges in this build.</p>
            </div>
            <LinkupRagPanel />
          </div>
        ) : null}
        {tab === "notifications" ? (
          <div id="settings-panel-notifications" role="tabpanel" aria-labelledby="settings-tab-notifications" className="space-y-4">
            <div className="noir-card-sm p-4">
              <p className="font-body text-sm font-semibold text-stitch-heading">Notifications</p>
              <p className="mt-2 font-body text-sm text-stitch-text">
                Voice approvals live under <strong className="text-stitch-heading">Voice activation</strong>. Push and email are on
                the roadmap; for now, use in-app toasts after approvals.
              </p>
              <p className="mt-3 font-body text-xs font-semibold text-stitch-muted">Coming soon</p>
              <ul className="mt-2 list-inside list-disc font-body text-xs text-stitch-placeholder">
                <li>Weekly savings recap</li>
                <li>Renewal radar digest</li>
              </ul>
            </div>
          </div>
        ) : null}
        {tab === "account" ? (
          <div id="settings-panel-account" role="tabpanel" aria-labelledby="settings-tab-account" className="space-y-4">
            <GoogleSignInPanel onLinkedEmail={onGoogleLinkedEmail} onAuthSessionChange={onAuthSessionChange} />
            <SettingsPanel
              settings={settings}
              onToggleSetting={onToggleSetting}
              accountEmailDraft={accountEmailDraft}
              onAccountEmailDraftChange={onAccountEmailDraftChange}
              onAccountEmailCommit={onAccountEmailCommit}
            />
          </div>
        ) : null}
        </div>
      </div>
    </section>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";

type FaceStatus = { ok: boolean; enrolled: boolean; error?: string };
type VerifyResponse = {
  verified: boolean;
  match?: boolean;
  confidence: number;
  liveness_passed: boolean;
  liveness_detail?: string;
  error?: string;
  threshold?: number;
};

export type FaceVerificationPanelProps = {
  /**
   * Account email from app auth (e.g. localStorage via Settings).
   * When set, the panel pings `/api/face/status` after the bridge is up and jumps to enroll or verify.
   */
  initialEmail?: string;
  /** `purchase`: skip email/enroll UI; verify (or code fallback) then call `onPurchaseVerified`. */
  purpose?: "settings" | "purchase";
  /** Line shown under the title when `purpose="purchase"` (e.g. merchant · amount). */
  purchaseSubtitle?: string;
  onPurchaseVerified?: () => void;
  onPurchaseCancel?: () => void;
};

const SESSION_VERIFIED_KEY = "stitch.face_verified_email";
const VERIFY_TIMEOUT_MS = 30_000;
const LIVENESS_FPS = 8;
const LIVENESS_DURATION_MS = 2500;

/** Oval target in normalized video coordinates (0–100). */
const OVAL = { cx: 50, cy: 42, rx: 30, ry: 38 };
const AREA_MIN = 8;
const AREA_MAX = 44;
const LIGHT_MIN = 75;
const LIGHT_MAX = 225;
const ALIGN_HOLD_MS = 550;
const COUNTDOWN_STEP_MS = 850;
const GUIDE_DEBOUNCE_FRAMES = 10;

/**
 * In Vite dev, default to calling Flask on 127.0.0.1:8765 so large JSON POSTs are not mangled by the Vite proxy.
 */
function stitchRagApiOrigin(): string {
  if (import.meta.env.VITE_STITCH_RAG_USE_PROXY === "1") return "";
  const custom = (import.meta.env.VITE_STITCH_RAG_BRIDGE_ORIGIN as string | undefined)?.trim();
  if (custom) return custom.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://127.0.0.1:8765";
  if (typeof window !== "undefined") {
    const { hostname, port } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      if (port === "1420" || port === "5173") return "http://127.0.0.1:8765";
    }
  }
  return "";
}

function stitchRagApiUrl(path: string): string {
  const base = stitchRagApiOrigin();
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

function frameToJpegDataUrl(
  video: HTMLVideoElement,
  opts?: { quality?: number; maxWidth?: number },
): string {
  const quality = opts?.quality ?? 0.82;
  const cap = opts?.maxWidth ?? 640;
  const w = Math.max(1, Math.min(cap, video.videoWidth));
  const h = Math.max(1, Math.round((video.videoHeight / video.videoWidth) * w));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(video, 0, 0, w, h);
  return c.toDataURL("image/jpeg", quality);
}

function generateFallbackCode(email: string): string {
  const part = email.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 3) || "PAY";
  return `${part}-${String(Math.floor(1000 + Math.random() * 9000))}`;
}

function isNetworkError(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  if (e instanceof Error && /fetch|network|failed to load/i.test(e.message)) return true;
  return false;
}

const HTML_INSTEAD_OF_JSON_HINT =
  "Received a web page instead of API JSON. Stop and restart `npm run dev:browser` so Vite reloads the proxy, and ensure `vite.config.ts` maps `/api` to http://127.0.0.1:8765 (not only `/api/rag`).";

const HTML_WRONG_PORT_APP_HINT =
  "The server on port 8765 returned an HTML error page instead of JSON — often another process is using that port, or an older bridge without face routes. Stop it, then from the cursor_linkup_mcp repo run `stitch_rag_bridge.py` (default 8765). Quick check: `GET http://127.0.0.1:8765/api/health` should return JSON like {\"ok\":true}.";

async function readJsonFromResponse(res: Response): Promise<{ data: unknown; parseError: string | null }> {
  const text = await res.text();
  const trimmed = text.trimStart();
  if (trimmed.startsWith("<!") || trimmed.toLowerCase().startsWith("<!doctype") || trimmed.toLowerCase().startsWith("<html")) {
    if (res.status === 200) {
      return { data: null, parseError: HTML_INSTEAD_OF_JSON_HINT };
    }
    if (res.status === 404 || res.status === 405) {
      return { data: null, parseError: HTML_WRONG_PORT_APP_HINT };
    }
    return {
      data: null,
      parseError: `Server returned HTML (${res.status}) instead of JSON — almost always an old Python process still bound to port 8765 without the latest bridge code. Stop every stitch_rag_bridge / python on 8765, then start again from cursor_linkup_mcp: .\\.venv\\Scripts\\python.exe stitch_rag_bridge.py (watch the terminal for a traceback). After code changes, npm run dev:browser only matters for Vite/proxy; face calls already use 127.0.0.1:8765 in local dev.`,
    };
  }
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  const looksJson =
    ct.includes("application/json") || ct.includes("+json") || trimmed.startsWith("{") || trimmed.startsWith("[");
  if (!trimmed) {
    return { data: {}, parseError: null };
  }
  if (!looksJson) {
    return {
      data: null,
      parseError: `Expected JSON but got non-JSON (${res.status}): ${text.slice(0, 160)}${text.length > 160 ? "…" : ""}`,
    };
  }
  try {
    return { data: JSON.parse(text) as unknown, parseError: null };
  } catch {
    return {
      data: null,
      parseError: `Invalid JSON (${res.status}): ${text.slice(0, 160)}${text.length > 160 ? "…" : ""}`,
    };
  }
}

function insideOval(face: { left: number; top: number; width: number; height: number }): boolean {
  const cx = face.left + face.width / 2;
  const cy = face.top + face.height / 2;
  const dx = (cx - OVAL.cx) / OVAL.rx;
  const dy = (cy - OVAL.cy) / OVAL.ry;
  return dx * dx + dy * dy <= 1.05;
}

function faceAreaPercent(face: { left: number; top: number; width: number; height: number }): number {
  return (face.width * face.height) / 100;
}

function sampleVideoBrightness(video: HTMLVideoElement): number | null {
  if (video.videoWidth < 2 || video.videoHeight < 2) return null;
  const c = document.createElement("canvas");
  const s = 48;
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, s, s);
  const data = ctx.getImageData(0, 0, s, s).data;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += (data[i]! + data[i + 1]! + data[i + 2]!) / 3;
  }
  return sum / (data.length / 4);
}

/**
 * Local face verification: bridge `/api/face/*`.
 * Guided single-frame enrollment + optional legacy multi-angle + post-enroll test.
 */
export function FaceVerificationPanel({
  initialEmail = "",
  purpose = "settings",
  purchaseSubtitle,
  onPurchaseVerified,
  onPurchaseCancel,
}: FaceVerificationPanelProps) {
  type Step = "email" | "enroll" | "enroll_test" | "verify" | "success" | "code" | "purchase_need_enroll";
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(() => initialEmail.trim());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bridgeState, setBridgeState] = useState<"checking" | "up" | "down">("checking");
  const [confidence, setConfidence] = useState(0);
  const [livenessHint, setLivenessHint] = useState("Please blink naturally a few times, then hold still.");
  const [liveDetail, setLiveDetail] = useState<string | null>(null);
  const [, setLivenessFails] = useState(0);
  const [fallbackCode, setFallbackCode] = useState("");
  const [typedCode, setTypedCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  const [multiAdvanced, setMultiAdvanced] = useState(false);
  const [multiShots, setMultiShots] = useState<string[]>([]);

  const [enrollGuideStarted, setEnrollGuideStarted] = useState(false);
  const [guidanceText, setGuidanceText] = useState("Center your face in the oval.");
  const [enrollQualityPct, setEnrollQualityPct] = useState(0);
  const [ovalGood, setOvalGood] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [enrollProcessing, setEnrollProcessing] = useState(false);
  const [pendingCapture, setPendingCapture] = useState<string | null>(null);
  const [enrollTestBusy, setEnrollTestBusy] = useState(false);
  const [enrollTestResult, setEnrollTestResult] = useState<{
    ok: boolean;
    confidence: number;
    detail: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const enrollGuideRafRef = useRef<number>(0);
  const livenessFailRef = useRef(0);
  const bootstrapRef = useRef(false);
  const [streamEpoch, setStreamEpoch] = useState(0);
  const [faceBox, setFaceBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const faceBoxRef = useRef(faceBox);
  faceBoxRef.current = faceBox;

  const alignSinceRef = useRef<number | null>(null);
  const guideFrameRef = useRef(0);
  const countdownCaptureDoneRef = useRef(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    if (enrollGuideRafRef.current) cancelAnimationFrame(enrollGuideRafRef.current);
    enrollGuideRafRef.current = 0;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setFaceBox(null);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const checkBridge = useCallback(async () => {
    setBridgeState("checking");
    setError(null);
    const urls = [stitchRagApiUrl("/api/health"), stitchRagApiUrl("/health")];
    try {
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i]!;
        const res = await fetch(url, { method: "GET" });
        const { data, parseError } = await readJsonFromResponse(res);
        if (parseError) {
          if (i < urls.length - 1) continue;
          setError(parseError);
          setBridgeState("down");
          return false;
        }
        const payload = data as { ok?: boolean };
        if (res.ok && payload?.ok) {
          setBridgeState("up");
          return true;
        }
        if (res.status === 404 && i < urls.length - 1) continue;
        setError(`Health check failed (${res.status}) from ${url}`);
        setBridgeState("down");
        return false;
      }
      setError("Bridge returned 404 for /api/health and /health — restart stitch_rag_bridge.py so it picks up the latest routes.");
      setBridgeState("down");
      return false;
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const fetchFailed = /failed to fetch|networkerror|load failed/i.test(raw);
      setError(
        fetchFailed
          ? `${raw} — The UI calls relative URLs like /api/health; those only reach Flask when the Vite dev server is running (e.g. from Stitch apps/desktop: npm run dev:browser, usually http://localhost:1420). If the bridge is already up on 8765, start or restart Vite, then Retry.`
          : `${raw} (is the dev server proxy running?)`,
      );
      setBridgeState("down");
      return false;
    }
  }, []);

  useEffect(() => {
    void checkBridge();
  }, [checkBridge]);

  useEffect(() => {
    setEmail(initialEmail.trim());
    bootstrapRef.current = false;
    if (!initialEmail.trim()) {
      setStep("email");
    }
  }, [initialEmail]);

  useEffect(() => {
    if (bridgeState !== "up" || bootstrapRef.current) return;
    const em = initialEmail.trim();
    if (!em) return;
    bootstrapRef.current = true;
    let cancelled = false;
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(stitchRagApiUrl(`/api/face/status?email=${encodeURIComponent(em)}`));
        const { data: raw, parseError } = await readJsonFromResponse(res);
        if (cancelled) return;
        if (parseError) throw new Error(parseError);
        const data = raw as FaceStatus;
        if (!res.ok || !data.ok) throw new Error(data.error || res.statusText || `HTTP ${res.status}`);
        setEmail(em);
        if (purpose === "purchase") {
          setStep(data.enrolled ? "verify" : "purchase_need_enroll");
        } else {
          setStep(data.enrolled ? "verify" : "enroll");
        }
      } catch (e) {
        if (cancelled) return;
        bootstrapRef.current = false;
        if (isNetworkError(e)) {
          setBridgeState("down");
          setError("Cannot reach the bridge — is stitch_rag_bridge.py running on port 8765?");
        } else {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bridgeState, initialEmail, purpose]);

  async function startCamera(): Promise<boolean> {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setStreamEpoch((n) => n + 1);
      return true;
    } catch {
      setError("Camera permission denied — use the confirmation code fallback.");
      setStep("code");
      setFallbackCode(generateFallbackCode(email || initialEmail || "user"));
      return false;
    }
  }

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream || (step !== "verify" && step !== "enroll" && step !== "enroll_test")) return;

    let cancelled = false;
    let detector: {
      detectForVideo: (
        v: HTMLVideoElement,
        ts: number,
      ) => { detections?: Array<{ boundingBox?: { originX: number; originY: number; width: number; height: number } }> };
    } | null = null;

    const tick = async () => {
      if (cancelled || !video || !detector) return;
      if (video.readyState < 2 || video.videoWidth === 0) {
        rafRef.current = requestAnimationFrame(() => void tick());
        return;
      }
      try {
        const r = detector.detectForVideo(video, performance.now());
        const bb = r.detections?.[0]?.boundingBox;
        if (!bb) setFaceBox(null);
        else {
          const clamp = (n: number) => Math.max(0, Math.min(100, n));
          setFaceBox({
            left: clamp((bb.originX / video.videoWidth) * 100),
            top: clamp((bb.originY / video.videoHeight) * 100),
            width: clamp((bb.width / video.videoWidth) * 100),
            height: clamp((bb.height / video.videoHeight) * 100),
          });
        }
      } catch {
        setFaceBox(null);
      }
      rafRef.current = requestAnimationFrame(() => void tick());
    };

    const run = async () => {
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const filesetResolver = await vision.FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
        );
        detector = await vision.FaceDetector.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
          },
          runningMode: "VIDEO",
          minDetectionConfidence: 0.45,
          minSuppressionThreshold: 0.3,
        });
        if (!cancelled) rafRef.current = requestAnimationFrame(() => void tick());
      } catch {
        /* optional overlay */
      }
    };
    void run();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setFaceBox(null);
    };
  }, [step, streamEpoch]);

  useEffect(() => {
    if (step !== "enroll" || !enrollGuideStarted || multiAdvanced || countdown !== null || enrollProcessing) {
      if (enrollGuideRafRef.current) cancelAnimationFrame(enrollGuideRafRef.current);
      enrollGuideRafRef.current = 0;
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      guideFrameRef.current += 1;
      if (guideFrameRef.current % GUIDE_DEBOUNCE_FRAMES !== 0) {
        enrollGuideRafRef.current = requestAnimationFrame(tick);
        return;
      }

      const fb = faceBoxRef.current;
      const light = sampleVideoBrightness(video);

      if (!fb) {
        setOvalGood(false);
        setEnrollQualityPct(0);
        setGuidanceText("No face detected — center your face in the oval.");
        alignSinceRef.current = null;
        setCountdown(null);
      } else {
        const area = faceAreaPercent(fb);
        const inOval = insideOval(fb);
        setOvalGood(inOval);

        let msg = "Face detected — adjust position.";
        let q = 35;
        if (light != null && (light < LIGHT_MIN || light > LIGHT_MAX)) {
          msg = light < LIGHT_MIN ? "Poor lighting — turn on more light." : "Too bright — reduce glare on your face.";
          q = 25;
        } else if (area < AREA_MIN) {
          msg = "Face too small — move closer to the camera.";
          q = 30 + Math.min(40, (area / AREA_MIN) * 40);
        } else if (area > AREA_MAX) {
          msg = "Face too large — move back slightly.";
          q = 30 + Math.min(40, ((AREA_MAX + 8 - area) / 8) * 40);
        } else if (!inOval) {
          msg = "Center your face in the oval.";
          q = 45 + Math.min(35, area * 0.5);
        } else {
          msg = "Hold still — lining up…";
          q = 55 + Math.min(45, (area / AREA_MAX) * 45);
          if (light != null && light >= LIGHT_MIN && light <= LIGHT_MAX) q += 10;
        }
        setEnrollQualityPct(Math.round(Math.min(100, q)));
        setGuidanceText(msg);

        const ready =
          fb &&
          inOval &&
          area >= AREA_MIN &&
          area <= AREA_MAX &&
          light != null &&
          light >= LIGHT_MIN &&
          light <= LIGHT_MAX;

        const now = Date.now();
        if (ready) {
          if (alignSinceRef.current == null) alignSinceRef.current = now;
          else if (now - alignSinceRef.current >= ALIGN_HOLD_MS) {
            setGuidanceText("Good — hold still. Capturing in…");
            setCountdown(3);
          }
        } else {
          alignSinceRef.current = null;
          setCountdown(null);
        }
      }

      enrollGuideRafRef.current = requestAnimationFrame(tick);
    };

    guideFrameRef.current = 0;
    enrollGuideRafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (enrollGuideRafRef.current) cancelAnimationFrame(enrollGuideRafRef.current);
      enrollGuideRafRef.current = 0;
    };
  }, [step, enrollGuideStarted, multiAdvanced, countdown, enrollProcessing]);

  useEffect(() => {
    if (countdown === null || countdown === 0) return;
    const t = window.setTimeout(() => {
      setCountdown((c) => (c === null || c <= 1 ? 0 : c - 1));
    }, COUNTDOWN_STEP_MS);
    return () => clearTimeout(t);
  }, [countdown]);

  const submitSimpleEnrollment = useCallback(async (imageDataUrl: string) => {
    setEnrollProcessing(true);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(stitchRagApiUrl("/api/face/enroll"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          image: imageDataUrl,
          enroll_mode: "simple",
          quality_check: "lenient",
        }),
      });
      const { data: raw, parseError } = await readJsonFromResponse(res);
      if (parseError) throw new Error(parseError);
      const data = raw as { ok?: boolean; error?: string; confidence_score?: number };
      if (!res.ok || !data.ok) throw new Error(data.error || res.statusText || `HTTP ${res.status}`);
      setPendingCapture(null);
      setEnrollTestResult(null);
      setStep("enroll_test");
    } catch (e) {
      if (isNetworkError(e)) {
        setBridgeState("down");
        setError("Cannot reach the bridge while enrolling.");
      } else {
        setError(
          e instanceof Error
            ? `Processing failed — ${e.message}. You can retry with the same capture below.`
            : String(e),
        );
      }
    } finally {
      setEnrollProcessing(false);
      setBusy(false);
    }
  }, [email]);

  useEffect(() => {
    if (countdown !== 0) return;
    if (countdownCaptureDoneRef.current) return;
    const v = videoRef.current;
    if (!v || v.videoWidth < 2) {
      setCountdown(null);
      return;
    }
    countdownCaptureDoneRef.current = true;
    const dataUrl = frameToJpegDataUrl(v, { maxWidth: 640, quality: 0.82 });
    setPendingCapture(dataUrl);
    setCountdown(null);
    setEnrollGuideStarted(false);
    void submitSimpleEnrollment(dataUrl);
  }, [countdown, submitSimpleEnrollment]);

  async function retryEnrollmentFromPending() {
    if (!pendingCapture) return;
    await submitSimpleEnrollment(pendingCapture);
  }

  async function submitMultiEnrollment() {
    if (multiShots.length < 2) {
      setError("Capture at least two angles.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const maxShots = 5;
      const images = multiShots.length > maxShots ? multiShots.slice(-maxShots) : [...multiShots];
      const res = await fetch(stitchRagApiUrl("/api/face/enroll"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          images,
          enroll_mode: "multi",
          quality_check: "lenient",
        }),
      });
      const { data: raw, parseError } = await readJsonFromResponse(res);
      if (parseError) throw new Error(parseError);
      const data = raw as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || res.statusText || `HTTP ${res.status}`);
      setMultiShots([]);
      stopCamera();
      setStep("verify");
    } catch (e) {
      if (isNetworkError(e)) {
        setBridgeState("down");
        setError("Cannot reach the bridge while enrolling.");
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(false);
    }
  }

  async function runQuickEnrollTest() {
    const video = videoRef.current;
    if (!video || video.videoWidth < 2) {
      setError("Camera not ready.");
      return;
    }
    setEnrollTestBusy(true);
    setEnrollTestResult(null);
    setError(null);
    const frames: string[] = [];
    const interval = 1000 / 6;
    const start = performance.now();
    while (performance.now() - start < 1500) {
      frames.push(frameToJpegDataUrl(video));
      await new Promise((r) => setTimeout(r, interval));
    }
    const main = frameToJpegDataUrl(video);
    try {
      const res = await fetch(stitchRagApiUrl("/api/face/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          image: main,
          liveness_frames: frames.length ? frames : [main],
          threshold: 0.55,
        }),
      });
      const { data: raw, parseError } = await readJsonFromResponse(res);
      if (parseError) throw new Error(parseError);
      const data = raw as VerifyResponse;
      if (!res.ok && res.status !== 200) {
        throw new Error(data.error || res.statusText || `HTTP ${res.status}`);
      }
      const ok = Boolean(data.verified);
      const conf = data.confidence ?? 0;
      setEnrollTestResult({
        ok,
        confidence: conf,
        detail: data.liveness_detail || (ok ? "Match" : data.error || "No match"),
      });
    } catch (e) {
      setEnrollTestResult({
        ok: false,
        confidence: 0,
        detail: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setEnrollTestBusy(false);
    }
  }

  async function submitEmail() {
    const em = email.trim();
    if (!em) {
      setError("Enter your email.");
      return;
    }
    if (bridgeState !== "up") {
      setError("Bridge is offline — start stitch_rag_bridge.py or click Retry.");
      return;
    }
    setBusy(true);
    setError(null);
    livenessFailRef.current = 0;
    setLivenessFails(0);
    try {
      const res = await fetch(stitchRagApiUrl(`/api/face/status?email=${encodeURIComponent(em)}`));
      const { data: raw, parseError } = await readJsonFromResponse(res);
      if (parseError) throw new Error(parseError);
      const data = raw as FaceStatus;
      if (!res.ok || !data.ok) throw new Error(data.error || res.statusText || `HTTP ${res.status}`);
      if (purpose === "purchase") {
        setStep(data.enrolled ? "verify" : "purchase_need_enroll");
      } else {
        setStep(data.enrolled ? "verify" : "enroll");
      }
    } catch (e) {
      if (isNetworkError(e)) {
        setBridgeState("down");
        setError("Cannot reach the bridge — is stitch_rag_bridge.py running on port 8765?");
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(false);
    }
  }

  async function runVerification() {
    const video = videoRef.current;
    if (!video || video.videoWidth < 2) {
      setError("Camera not ready.");
      return;
    }
    setBusy(true);
    setError(null);
    setLiveDetail(null);
    setConfidence(0);

    const frames: string[] = [];
    const interval = 1000 / LIVENESS_FPS;
    const start = performance.now();
    while (performance.now() - start < LIVENESS_DURATION_MS) {
      frames.push(frameToJpegDataUrl(video));
      await new Promise((r) => setTimeout(r, interval));
    }
    const main = frameToJpegDataUrl(video);

    try {
      const res = await fetch(stitchRagApiUrl("/api/face/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          image: main,
          liveness_frames: frames,
          threshold: 0.6,
        }),
      });
      const { data: raw, parseError } = await readJsonFromResponse(res);
      if (parseError) throw new Error(parseError);
      const data = raw as VerifyResponse;
      if (!res.ok && res.status !== 200) {
        throw new Error(data.error || res.statusText || `HTTP ${res.status}`);
      }
      setConfidence(data.confidence ?? 0);
      setLiveDetail(data.liveness_detail ?? null);

      if (data.verified) {
        sessionStorage.setItem(SESSION_VERIFIED_KEY, email.trim());
        livenessFailRef.current = 0;
        stopCamera();
        if (purpose === "purchase" && onPurchaseVerified) {
          onPurchaseVerified();
          return;
        }
        setStep("success");
        return;
      }

      if (!data.liveness_passed) {
        livenessFailRef.current += 1;
        setLivenessFails(livenessFailRef.current);
        setLivenessHint("Please blink — I need to see you're real. Or slowly turn your head left and right.");
        if (livenessFailRef.current >= 2) {
          setFallbackCode(generateFallbackCode(email));
          stopCamera();
          setStep("code");
        }
      } else if (!data.match) {
        setLivenessHint("Face match was weak — try again or use the code.");
      }
    } catch (e) {
      if (isNetworkError(e)) {
        setBridgeState("down");
        setError("Cannot reach the bridge during verification.");
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (step !== "verify" && step !== "enroll" && step !== "enroll_test") return;
    if (bridgeState !== "up") return;
    void startCamera();
  }, [step, bridgeState]);

  useEffect(() => {
    if (step !== "enroll") {
      setEnrollGuideStarted(false);
      setCountdown(null);
      setPendingCapture(null);
      setEnrollQualityPct(0);
      alignSinceRef.current = null;
      countdownCaptureDoneRef.current = false;
    }
  }, [step]);

  const busyRef = useRef(false);
  busyRef.current = busy;
  const verifyDeadlineRef = useRef<number>(0);
  useEffect(() => {
    if (step !== "verify") return;
    verifyDeadlineRef.current = Date.now() + VERIFY_TIMEOUT_MS;
    const t = window.setInterval(() => {
      if (Date.now() > verifyDeadlineRef.current && !busyRef.current) {
        setFallbackCode(generateFallbackCode(email.trim() || initialEmail || "user"));
        setStep("code");
        setError("Timed out — use the confirmation code.");
        stopCamera();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [step, email, initialEmail, stopCamera]);

  const ringClass =
    ovalGood && enrollQualityPct >= 72
      ? "ring-4 ring-emerald-400 ring-offset-2 ring-offset-black/90"
      : "ring-2 ring-stitch-secondary/40";

  const panelTitle = purpose === "purchase" ? "Verify to approve this payment" : "Face verification (local)";

  return (
    <section className="rounded-2xl bg-white/90 p-4 shadow-sm ring-1 ring-stitch-neutral/40">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-base font-semibold text-stitch-action">{panelTitle}</p>
          {purpose === "purchase" && purchaseSubtitle ? (
            <p className="mt-1 font-body text-sm text-stitch-secondary">{purchaseSubtitle}</p>
          ) : null}
        </div>
        {purpose === "purchase" && onPurchaseCancel ? (
          <button
            type="button"
            onClick={onPurchaseCancel}
            className="shrink-0 rounded-full bg-white px-3 py-1.5 font-body text-xs font-semibold text-stitch-action ring-1 ring-stitch-secondary/45"
          >
            Cancel
          </button>
        ) : null}
      </div>

      {bridgeState === "checking" ? (
        <p className="mt-3 font-body text-sm text-stitch-secondary">Checking local bridge (/health)…</p>
      ) : null}

      {bridgeState === "down" ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 font-body text-sm text-amber-950">
          <p className="font-semibold">Bridge not reachable</p>
          <p className="mt-1 text-xs leading-relaxed">
            You need <strong>two</strong> processes: (1) Flask bridge in <code className="rounded bg-white/80 px-1">cursor_linkup_mcp</code>:{" "}
            <code className="rounded bg-white/80 px-1">.\.venv\Scripts\python.exe stitch_rag_bridge.py</code>{" "}
            (<code className="rounded bg-white/80 px-1">127.0.0.1:8765</code>). (2) Vite dev server for Stitch desktop (e.g.{" "}
            <code className="rounded bg-white/80 px-1">npm run dev:browser</code>, default{" "}
            <code className="rounded bg-white/80 px-1">http://localhost:1420</code>) so{" "}
            <code className="rounded bg-white/80 px-1">/api</code> is proxied to 8765. 'Failed to fetch' with the bridge running
            usually means Vite is not running or you opened the app outside that dev URL.
          </p>
          <button
            type="button"
            className="mt-2 rounded-full bg-stitch-action px-4 py-2 text-xs font-semibold text-white"
            onClick={() => void checkBridge()}
          >
            Retry connection
          </button>
          {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
        </div>
      ) : null}

      {bridgeState === "up" ? (
        <>
          {purpose === "settings" ? (
            <ul className="mt-2 list-inside list-disc font-body text-[11px] leading-relaxed text-stitch-secondary">
              <li>This is a demo of face verification — not high-security authentication.</li>
              <li>Your face data stays on this device (encrypted under ~/.stitch/face_db/), never uploaded by this bridge.</li>
              <li>When in doubt, use the code fallback.</li>
            </ul>
          ) : (
            <p className="mt-2 font-body text-[11px] leading-relaxed text-stitch-secondary">
              Uses the same local bridge as Settings. If verification fails, use the on-screen confirmation code.
            </p>
          )}

          {purpose === "purchase" && !initialEmail.trim() ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 font-body text-sm text-amber-950">
              <p className="font-semibold">Account email required</p>
              <p className="mt-1 text-xs leading-relaxed">
                Save your email in <strong>Settings</strong> (demo auth), enroll your face there, then approve this payment again.
              </p>
            </div>
          ) : null}

          {step === "email" && purpose === "settings" ? (
            <div className="mt-4 space-y-2">
              <label className="block font-body text-xs text-stitch-secondary">
                Step 1 — Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1 w-full rounded-xl border border-stitch-secondary/40 bg-white px-3 py-2 font-body text-sm text-stitch-action"
                />
              </label>
              <p className="font-body text-[11px] text-stitch-secondary">
                If you already set <strong>Account email</strong> above, you can still confirm or change it here.
              </p>
              {error ? <p className="font-body text-xs text-red-600">{error}</p> : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitEmail()}
                className="rounded-full bg-stitch-action px-4 py-2 font-body text-xs font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Checking…" : "Continue"}
              </button>
            </div>
          ) : null}

          {purpose === "purchase" && initialEmail.trim() && step === "email" && busy ? (
            <p className="mt-4 font-body text-sm text-stitch-secondary">Checking face enrollment…</p>
          ) : null}

          {step === "purchase_need_enroll" ? (
            <div className="mt-4 rounded-xl border border-stitch-secondary/30 bg-stitch-neutral/20 p-4">
              <p className="font-body text-sm font-semibold text-stitch-action">No face on file for this email</p>
              <p className="mt-2 font-body text-xs leading-relaxed text-stitch-secondary">
                Open <strong>Settings</strong>, confirm your account email, complete <strong>Face verification</strong> enrollment, then return here and tap Approve again.
              </p>
            </div>
          ) : null}

          {step === "enroll" ? (
            <div className="mt-4 space-y-3">
              <p className="font-body text-sm text-stitch-action">Enroll — {email}</p>
              <p className="font-body text-xs text-stitch-secondary">
                One guided capture: align in the oval, then we save a few augmented templates from that frame (like Face ID). This may take a few seconds while embeddings generate.
              </p>

              <label className="flex cursor-pointer items-center gap-2 font-body text-[11px] text-stitch-secondary">
                <input type="checkbox" checked={multiAdvanced} onChange={(e) => setMultiAdvanced(e.target.checked)} />
                Advanced: multi-angle capture (legacy)
              </label>

              {!multiAdvanced ? (
                <>
                  {!enrollGuideStarted && !enrollProcessing ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setError(null);
                        countdownCaptureDoneRef.current = false;
                        setEnrollGuideStarted(true);
                        setGuidanceText("Center your face in the oval.");
                        alignSinceRef.current = null;
                      }}
                      className="rounded-full bg-stitch-action px-4 py-2 font-body text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Start enrollment
                    </button>
                  ) : null}

                  <div className={`relative mx-auto aspect-video w-full max-w-md overflow-hidden rounded-xl bg-black/90 ${ringClass}`}>
                    <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                    <svg
                      className="pointer-events-none absolute inset-0 h-full w-full"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      <ellipse
                        cx={OVAL.cx}
                        cy={OVAL.cy}
                        rx={OVAL.rx}
                        ry={OVAL.ry}
                        fill="none"
                        stroke={ovalGood && enrollQualityPct >= 72 ? "rgba(52,211,153,0.95)" : "rgba(255,255,255,0.55)"}
                        strokeWidth="1.2"
                      />
                    </svg>
                    {faceBox ? (
                      <div
                        className={`pointer-events-none absolute border-2 ${ovalGood ? "border-emerald-300/90" : "border-white/50"}`}
                        style={{
                          left: `${faceBox.left}%`,
                          top: `${faceBox.top}%`,
                          width: `${faceBox.width}%`,
                          height: `${faceBox.height}%`,
                        }}
                      />
                    ) : null}
                    {countdown !== null && countdown > 0 ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/55">
                        <span className="font-display text-6xl font-bold text-white">{countdown}</span>
                      </div>
                    ) : null}
                  </div>

                  {enrollGuideStarted || enrollProcessing ? (
                    <div className="rounded-xl bg-stitch-neutral/20 p-3">
                      <p className="font-body text-xs font-semibold text-stitch-action">{guidanceText}</p>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-stitch-neutral/50">
                        <div
                          className="h-full rounded-full bg-stitch-primary transition-all"
                          style={{ width: `${enrollQualityPct}%` }}
                        />
                      </div>
                      <p className="mt-1 font-body text-[11px] text-stitch-secondary">Quality {enrollQualityPct}%</p>
                    </div>
                  ) : null}

                  {enrollProcessing ? (
                    <p className="font-body text-xs text-stitch-secondary">Saving face templates… this may take a few seconds.</p>
                  ) : null}

                  {pendingCapture && error ? (
                    <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/80 p-3">
                      <p className="font-body text-xs text-amber-950">{error}</p>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void retryEnrollmentFromPending()}
                        className="rounded-full bg-stitch-action px-4 py-2 font-body text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Retry embedding with same capture
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="font-body text-[11px] text-stitch-secondary">
                    Capture 2–3 angles; up to five images are sent. Lenient detection is used for enrollment.
                  </p>
                  <div className="relative mx-auto aspect-video w-full max-w-md overflow-hidden rounded-xl bg-black/90 ring-2 ring-stitch-secondary/40">
                    <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                    {faceBox ? (
                      <div
                        className="pointer-events-none absolute border-2 border-emerald-400/90"
                        style={{
                          left: `${faceBox.left}%`,
                          top: `${faceBox.top}%`,
                          width: `${faceBox.width}%`,
                          height: `${faceBox.height}%`,
                        }}
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy || !videoRef.current}
                      onClick={() => {
                        const v = videoRef.current;
                        if (!v) return;
                        setMultiShots((s) => [...s, frameToJpegDataUrl(v, { maxWidth: 480, quality: 0.72 })]);
                      }}
                      className="rounded-full bg-stitch-primary px-4 py-2 font-body text-xs font-semibold text-white"
                    >
                      Capture angle
                    </button>
                    <button
                      type="button"
                      disabled={busy || multiShots.length < 2}
                      onClick={() => void submitMultiEnrollment()}
                      className="rounded-full bg-stitch-action px-4 py-2 font-body text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {busy ? "Saving…" : "Save enrollment (multi)"}
                    </button>
                  </div>
                </>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setStep("code");
                    setFallbackCode(generateFallbackCode(email));
                  }}
                  className="rounded-full bg-white px-4 py-2 font-body text-xs font-semibold text-stitch-action ring-1 ring-stitch-secondary/45"
                >
                  Skip — use code only
                </button>
              </div>
              {error && !pendingCapture ? <p className="font-body text-xs text-red-600">{error}</p> : null}
            </div>
          ) : null}

          {step === "enroll_test" ? (
            <div className="mt-4 space-y-3">
              <p className="font-body text-sm font-semibold text-emerald-800">Face saved</p>
              <p className="font-body text-xs text-stitch-secondary">
                Test that the camera recognizes you before continuing to full verification.
              </p>
              <div className="relative mx-auto aspect-video w-full max-w-md overflow-hidden rounded-xl bg-black/90 ring-2 ring-stitch-secondary/40">
                <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
              </div>
              <button
                type="button"
                disabled={enrollTestBusy}
                onClick={() => void runQuickEnrollTest()}
                className="rounded-full bg-stitch-action px-4 py-2 font-body text-xs font-semibold text-white disabled:opacity-50"
              >
                {enrollTestBusy ? "Verifying…" : "Test verification"}
              </button>
              {enrollTestResult ? (
                <div
                  className={`rounded-xl p-3 font-body text-sm ${enrollTestResult.ok ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"}`}
                >
                  {enrollTestResult.ok ? (
                    <p>
                      Match — {(enrollTestResult.confidence * 100).toFixed(0)}% confidence. {enrollTestResult.detail}
                    </p>
                  ) : (
                    <p>
                      No match — {(enrollTestResult.confidence * 100).toFixed(0)}% confidence. {enrollTestResult.detail}
                    </p>
                  )}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setStep("verify");
                }}
                className="rounded-full bg-stitch-primary px-4 py-2 font-body text-xs font-semibold text-white"
              >
                Continue to sign-in verification
              </button>
              {error ? <p className="font-body text-xs text-red-600">{error}</p> : null}
            </div>
          ) : null}

          {step === "verify" ? (
            <div className="mt-4 space-y-3">
              <p className="font-body text-sm text-stitch-action">Verify — {email}</p>
              <p className="font-body text-xs text-amber-900">{livenessHint}</p>
              <div className="relative mx-auto aspect-video w-full max-w-md overflow-hidden rounded-xl bg-black/90 ring-2 ring-stitch-secondary/40">
                <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                {faceBox ? (
                  <div
                    className="pointer-events-none absolute border-2 border-emerald-400/90"
                    style={{
                      left: `${faceBox.left}%`,
                      top: `${faceBox.top}%`,
                      width: `${faceBox.width}%`,
                      height: `${faceBox.height}%`,
                    }}
                  />
                ) : null}
              </div>
              <div className="rounded-xl bg-stitch-neutral/25 p-3">
                <p className="font-body text-[11px] font-semibold text-stitch-action">Match confidence</p>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-stitch-neutral/50">
                  <div
                    className="h-full rounded-full bg-stitch-primary transition-all"
                    style={{ width: `${Math.min(100, confidence * 100)}%` }}
                  />
                </div>
                <p className="mt-1 font-mono text-xs text-stitch-secondary">
                  {(confidence * 100).toFixed(1)}% (threshold 60%)
                </p>
                {liveDetail ? <p className="mt-1 font-body text-[11px] text-stitch-secondary">{liveDetail}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runVerification()}
                  className="rounded-full bg-stitch-action px-4 py-2 font-body text-xs font-semibold text-white disabled:opacity-50"
                >
                  {busy ? "Verifying…" : "Run check (~2.5s capture)"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setFallbackCode(generateFallbackCode(email));
                    setStep("code");
                  }}
                  className="rounded-full bg-white px-4 py-2 font-body text-xs font-semibold text-stitch-action ring-2 ring-stitch-primary"
                >
                  Use confirmation code instead
                </button>
              </div>
              {error ? <p className="font-body text-xs text-red-600">{error}</p> : null}
            </div>
          ) : null}

          {step === "success" && purpose === "settings" ? (
            <div className="mt-4 rounded-xl bg-emerald-50 p-3 font-body text-sm text-stitch-action">
              Verified for this session. You can return to the dashboard.
              <button
                type="button"
                className="mt-2 block rounded-full bg-stitch-action px-4 py-2 text-xs font-semibold text-white"
                onClick={() => {
                  bootstrapRef.current = false;
                  stopCamera();
                  if (initialEmail.trim()) {
                    setEmail(initialEmail.trim());
                    setStep("verify");
                  } else {
                    setStep("email");
                  }
                }}
              >
                Done
              </button>
            </div>
          ) : null}

          {step === "code" ? (
            <div className="mt-4 space-y-2 border-stitch-neutral/40 border-t pt-3">
              <p className="font-body text-sm font-semibold text-stitch-action">Confirmation code fallback</p>
              <p className="font-mono text-lg font-bold tracking-wider text-stitch-action">{fallbackCode}</p>
              <input
                value={typedCode}
                onChange={(e) => setTypedCode(e.target.value)}
                placeholder="Type the code"
                className="w-full rounded-xl border border-stitch-secondary/40 px-3 py-2 font-mono text-sm"
              />
              {codeError ? <p className="text-xs text-red-600">{codeError}</p> : null}
              <button
                type="button"
                onClick={() => {
                  const ok = typedCode.trim().toUpperCase().replace(/\s+/g, "") === fallbackCode.toUpperCase();
                  if (!ok) {
                    setCodeError("Code does not match.");
                    return;
                  }
                  sessionStorage.setItem(SESSION_VERIFIED_KEY, email.trim());
                  if (purpose === "purchase" && onPurchaseVerified) {
                    stopCamera();
                    onPurchaseVerified();
                    return;
                  }
                  setStep("success");
                }}
                className="rounded-full bg-stitch-action px-4 py-2 font-body text-xs font-semibold text-white"
              >
                Confirm with code
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

# Stitch desktop — extra dependency for face MFA / FaceVerificationPanel

Optional **bounding-box overlay** (browser) uses **MediaPipe**:

```bash
npm install @mediapipe/tasks-vision -w @stitch/desktop
```

WASM and model assets load from HTTPS CDNs at runtime (see `FaceVerificationPanel.tsx` or `FaceMfaPanel` in `AppShell.tsx`).

**1:1 verification** itself runs in **Python** on the Flask bridge (`face_verification/*`, DeepFace + OpenCV liveness) — no MediaPipe required on the server.

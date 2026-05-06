"""
Global hotkey voice-to-prompt tool for coding workflows.

Features:
- One hotkey to start/stop microphone capture
- Offline transcription with faster-whisper
- Technical post-processing for file references and punctuation
- Clipboard output with prompt envelope
- Optional auto-paste into active app
- Tiny OSD status indicator

Install (recommended):
    pip install -e ".[voice-prompt,stitch-whisper]"

Run:
    python voice_prompt_tool.py
"""
from __future__ import annotations

import argparse
import atexit
import io
import json
import logging
import os
import platform
import queue
import re
import signal
import subprocess
import sys
import tempfile
import threading
import time
import wave
from dataclasses import dataclass
from pathlib import Path

import numpy as np

try:
    import pyperclip
except Exception:  # pragma: no cover - runtime dependency check
    pyperclip = None  # type: ignore[assignment]

try:
    import sounddevice as sd
except Exception:  # pragma: no cover - runtime dependency check
    sd = None  # type: ignore[assignment]

try:
    from pynput import keyboard
except Exception:  # pragma: no cover - runtime dependency check
    keyboard = None  # type: ignore[assignment]

try:
    from PIL import Image, ImageDraw
except Exception:  # pragma: no cover - runtime dependency check
    Image = None  # type: ignore[assignment]
    ImageDraw = None  # type: ignore[assignment]

try:
    import pystray  # type: ignore[reportMissingImports]
except Exception:  # pragma: no cover - runtime dependency check
    pystray = None  # type: ignore[assignment]

from local_whisper_stt import transcribe_wav_bytes

logger = logging.getLogger("voice_prompt_tool")
TEMPLATES_PATH = Path(__file__).resolve().parent / "config" / "templates.json"
INSTANCE_LOCK_PATH = Path(tempfile.gettempdir()) / "voice_prompt_tool.lock"


FILE_REF_RE = re.compile(
    r"\b([A-Za-z0-9_\-./]+(?:\.[A-Za-z0-9]{1,6}))\b"
)
CAMEL_CASE_RE = re.compile(r"\b[A-Za-z_][A-Za-z0-9_]*[A-Z][A-Za-z0-9_]*\b")
SNAKE_CASE_RE = re.compile(r"\b[a-z][a-z0-9_]*_[a-z0-9_]+\b")
MODIFIER_KEYS = {"ctrl", "control", "shift", "alt", "option", "cmd", "command"}


@dataclass
class PromptResult:
    raw_text: str
    normalized_text: str
    file_refs: list[str]
    formatted_prompt: str


class StatusOSD:
    def __init__(self) -> None:
        self._queue: queue.Queue[tuple[str, str]] = queue.Queue()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._ready = threading.Event()
        self._enabled = True
        self._thread.start()
        if not self._ready.wait(timeout=2):
            self._enabled = False

    def _run(self) -> None:
        try:
            import tkinter as tk
        except Exception:
            logger.warning("Tkinter unavailable; OSD disabled.")
            self._enabled = False
            self._ready.set()
            return

        root = tk.Tk()
        root.overrideredirect(True)
        root.attributes("-topmost", True)
        root.configure(bg="#161b22")
        label = tk.Label(
            root,
            text="VOICE READY",
            fg="white",
            bg="#238636",
            padx=14,
            pady=8,
            font=("Segoe UI", 10, "bold"),
        )
        label.pack()

        # place near top-right
        root.update_idletasks()
        width = 170
        height = 40
        screen_w = root.winfo_screenwidth()
        x = max(0, screen_w - width - 24)
        y = 24
        root.geometry(f"{width}x{height}+{x}+{y}")
        self._ready.set()

        def poll() -> None:
            try:
                while True:
                    text, bg = self._queue.get_nowait()
                    label.config(text=text, bg=bg)
            except queue.Empty:
                pass
            root.after(100, poll)

        poll()
        root.mainloop()

    def set_status(self, text: str, color_hex: str) -> None:
        if self._enabled:
            self._queue.put((text, color_hex))


class InstanceLock:
    def __init__(self, path: Path) -> None:
        self.path = path
        self._acquired = False

    def acquire(self, replace_existing: bool = True) -> bool:
        for _ in range(2):
            try:
                fd = os.open(str(self.path), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                with os.fdopen(fd, "w", encoding="utf-8") as f:
                    f.write(str(os.getpid()))
                self._acquired = True
                atexit.register(self.release)
                return True
            except FileExistsError:
                existing_pid = self._read_pid()
                if existing_pid is None:
                    self._safe_unlink()
                    continue
                if not _process_exists(existing_pid):
                    self._safe_unlink()
                    continue
                if replace_existing:
                    logger.warning("Existing voice prompt instance detected (pid=%s). Stopping it.", existing_pid)
                    _terminate_process(existing_pid)
                    time.sleep(0.25)
                    self._safe_unlink()
                    continue
                return False
            except Exception as exc:
                logger.error("Failed acquiring instance lock: %s", exc)
                return False
        return False

    def release(self) -> None:
        if not self._acquired:
            return
        self._safe_unlink()
        self._acquired = False

    def _read_pid(self) -> int | None:
        try:
            raw = self.path.read_text(encoding="utf-8").strip()
            return int(raw) if raw else None
        except Exception:
            return None

    def _safe_unlink(self) -> None:
        try:
            self.path.unlink(missing_ok=True)
        except Exception:
            pass


def _process_exists(pid: int) -> bool:
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except Exception:
        return False


def _terminate_process(pid: int) -> None:
    try:
        if platform.system() == "Windows":
            subprocess.run(
                ["taskkill", "/PID", str(pid), "/F", "/T"],
                check=False,
                capture_output=True,
                text=True,
            )
        else:
            os.kill(pid, signal.SIGTERM)
    except Exception as exc:
        logger.warning("Failed terminating pid=%s: %s", pid, exc)


class TrayController:
    def __init__(
        self,
        get_input_device,
        set_input_device,
        on_quit,
    ) -> None:
        self._get_input_device = get_input_device
        self._set_input_device = set_input_device
        self._on_quit = on_quit
        self._enabled = bool(pystray and Image and ImageDraw and sd)
        self._icon = None
        if not self._enabled:
            logger.warning("pystray/Pillow unavailable; tray icon disabled.")
            return
        self._icon = pystray.Icon("voice_prompt_tool")
        self._icon.title = "Voice Prompt Tool"
        self._set_state("idle")
        self._icon.menu = self._build_menu()
        try:
            self._icon.run_detached()
        except Exception as exc:
            logger.warning("Failed to start tray icon: %s", exc)
            self._enabled = False
            self._icon = None

    def _create_dot_icon(self, color: str):
        size = 64
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        draw.ellipse((10, 10, size - 10, size - 10), fill=color)
        return img

    def _set_state(self, state: str) -> None:
        if not self._enabled or self._icon is None:
            return
        color = "#2EA043" if state == "idle" else "#DA3633" if state == "recording" else "#1F6FEB"
        self._icon.icon = self._create_dot_icon(color)

    def _list_input_devices(self) -> list[tuple[int, str]]:
        if sd is None:
            return []
        out: list[tuple[int, str]] = []
        for i, d in enumerate(sd.query_devices()):
            max_in = int(d.get("max_input_channels", 0) or 0)
            if max_in > 0:
                out.append((i, str(d.get("name", "unknown"))))
        return out

    def _build_menu(self):
        if pystray is None:
            return None
        items = []
        for idx, name in self._list_input_devices():
            items.append(
                pystray.MenuItem(
                    f"{idx}: {name}",
                    lambda _icon, _item, device_idx=idx: self._handle_device_select(device_idx),
                    checked=lambda _item, device_idx=idx: self._get_input_device() == device_idx,
                    radio=True,
                )
            )

        return pystray.Menu(
            pystray.MenuItem("Input Device", pystray.Menu(*items)) if items else pystray.MenuItem("Input Device", lambda *_: None, enabled=False),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Quit", self._handle_quit),
        )

    def _handle_device_select(self, device_idx: int) -> None:
        self._set_input_device(device_idx)
        if self._icon is not None:
            self._icon.menu = self._build_menu()
            self._icon.update_menu()

    def _handle_quit(self, icon, item) -> None:
        self._on_quit()
        self.stop()

    def set_state(self, state: str) -> None:
        self._set_state(state)

    def stop(self) -> None:
        if self._icon is not None:
            try:
                self._icon.stop()
            except Exception:
                pass


class VoicePromptTool:
    def __init__(
        self,
        hotkey: str,
        sample_rate: int = 16000,
        channels: int = 1,
        autopaste: bool = False,
        input_device: str | int | None = None,
        system_instruction: str | None = None,
        continuation_mode: bool = False,
        continuation_window_seconds: int = 30,
    ) -> None:
        if keyboard is None or sd is None or pyperclip is None:
            raise RuntimeError(
                "Missing dependencies. Install extras with: pip install -e \".[voice-prompt,stitch-whisper]\""
            )
        self.sample_rate = sample_rate
        self.channels = channels
        self.autopaste = autopaste
        self.input_device = input_device
        self.system_instruction = system_instruction.strip() if system_instruction else None
        self.continuation_mode = continuation_mode
        self.continuation_window_seconds = max(1, continuation_window_seconds)
        self._last_prompt_copied_at: float | None = None
        self._clipboard_buffer: str | None = None
        self.is_recording = False
        self._recording_frames: list[np.ndarray] = []
        self._stream: sd.InputStream | None = None
        self._recording_lock = threading.Lock()
        self.hotkey = hotkey
        hotkey_spec = _to_pynput_hotkey_spec(hotkey)
        self._hotkey = keyboard.HotKey(
            keyboard.HotKey.parse(hotkey_spec),
            self._on_hotkey,
        )
        self._listener: keyboard.Listener | None = None
        self._stop_event = threading.Event()
        self.osd = StatusOSD()
        self.tray = TrayController(
            get_input_device=self.get_input_device,
            set_input_device=self.set_input_device,
            on_quit=self.shutdown,
        )
        self.osd.set_status("VOICE READY", "#238636")
        self.tray.set_state("idle")

    def get_input_device(self) -> str | int | None:
        return self.input_device

    def set_input_device(self, device: str | int | None) -> None:
        with self._recording_lock:
            if self.is_recording:
                logger.warning("Ignoring tray device change while recording.")
                return
            self.input_device = device
            logger.info("Input device changed from tray to: %s", device)

    def _canonical(self, key: keyboard.Key | keyboard.KeyCode):
        if self._listener is None:
            return key
        return self._listener.canonical(key)

    def _on_hotkey(self) -> None:
        if self.is_recording:
            self.stop_recording()
        else:
            self.start_recording()
        # debounce repeated toggles while held down
        time.sleep(0.2)

    def _on_press(self, key: keyboard.Key | keyboard.KeyCode) -> None:
        self._hotkey.press(self._canonical(key))

    def _on_release(self, key: keyboard.Key | keyboard.KeyCode) -> None:
        self._hotkey.release(self._canonical(key))

    def start_recording(self) -> None:
        with self._recording_lock:
            if self.is_recording:
                return
            self._recording_frames.clear()
            try:
                stream_device, stream_channels, stream_rate = self._resolve_stream_settings()
                self._stream = sd.InputStream(
                    samplerate=stream_rate,
                    channels=stream_channels,
                    dtype="float32",
                    device=stream_device,
                    callback=self._audio_callback,
                )
                self._stream.start()
            except Exception as exc:
                logger.error("Microphone access failed: %s", exc)
                if "PaError" in str(exc):
                    logger.error(
                        "PORTAUDIO_ERROR device=%s channels=%s sample_rate=%s error=%s",
                        self.input_device,
                        self.channels,
                        self.sample_rate,
                        exc,
                    )
                self.osd.set_status("MIC ERROR", "#da3633")
                self.tray.set_state("idle")
                return
            self.is_recording = True
            self.osd.set_status("RECORDING", "#da3633")
            self.tray.set_state("recording")
            logger.info(
                "Recording started (device=%s, channels=%s, sample_rate=%s).",
                stream_device,
                stream_channels,
                stream_rate,
            )

    def _resolve_stream_settings(self) -> tuple[str | int | None, int, int]:
        device = self.input_device
        channels = self.channels
        samplerate = self.sample_rate

        try:
            info = sd.query_devices(device, "input")
            max_in = int(info.get("max_input_channels", 0) or 0)
            default_rate = int(float(info.get("default_samplerate", samplerate) or samplerate))
            if max_in > 0:
                channels = min(max(1, channels), max_in)
            try:
                sd.check_input_settings(device=device, channels=channels, samplerate=samplerate)
            except Exception:
                samplerate = default_rate
                sd.check_input_settings(device=device, channels=channels, samplerate=samplerate)
        except Exception:
            # If probing fails, keep original args and let InputStream raise the concrete error.
            pass
        return device, channels, samplerate

    def _audio_callback(self, indata, frames, time_info, status) -> None:
        if status:
            logger.warning("Input stream status: %s", status)
        self._recording_frames.append(indata.copy())

    def stop_recording(self) -> None:
        with self._recording_lock:
            if not self.is_recording:
                return
            self.is_recording = False
            if self._stream is not None:
                try:
                    self._stream.stop()
                    self._stream.close()
                except Exception as exc:
                    logger.warning("Error closing mic stream: %s", exc)
                self._stream = None
            self.osd.set_status("TRANSCRIBING", "#1f6feb")
            self.tray.set_state("processing")
            logger.info("Recording stopped. Processing transcription...")

        threading.Thread(target=self._transcribe_and_emit, daemon=True).start()

    def _wav_bytes_from_frames(self, frames: list[np.ndarray]) -> bytes:
        if not frames:
            return b""
        audio = np.concatenate(frames, axis=0)
        audio = np.clip(audio, -1.0, 1.0)
        pcm = (audio * 32767).astype(np.int16)
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wf:
            wf.setnchannels(self.channels)
            wf.setsampwidth(2)
            wf.setframerate(self.sample_rate)
            wf.writeframes(pcm.tobytes())
        return buffer.getvalue()

    def _transcribe_and_emit(self) -> None:
        frames = self._recording_frames.copy()
        if not frames:
            self.osd.set_status("NO AUDIO", "#d29922")
            self.tray.set_state("idle")
            return
        wav_bytes = self._wav_bytes_from_frames(frames)
        if not wav_bytes:
            self.osd.set_status("AUDIO ERROR", "#da3633")
            self.tray.set_state("idle")
            return

        try:
            raw_text = transcribe_wav_bytes(wav_bytes, language="en")
        except Exception as exc:
            logger.exception("Transcription failed")
            self.osd.set_status("STT ERROR", "#da3633")
            logger.error("Transcription failed: %s", exc)
            if "PaError" in str(exc):
                logger.error("PORTAUDIO_ERROR during transcription: %s", exc)
            self.tray.set_state("idle")
            return

        logger.info("Transcription length chars=%s words=%s", len(raw_text), len(raw_text.split()))
        if not raw_text.strip():
            self.osd.set_status("NO SPEECH", "#d29922")
            logger.info("No speech detected; clipboard not updated.")
            self.tray.set_state("idle")
            return

        result = format_prompt(raw_text, system_instruction=self.system_instruction)
        if not result.normalized_text.strip():
            self.osd.set_status("NO SPEECH", "#d29922")
            logger.info("No usable text after normalization; clipboard not updated.")
            self.tray.set_state("idle")
            return

        clipboard_text = self._build_clipboard_output(result.formatted_prompt)
        pyperclip.copy(clipboard_text)

        if self.autopaste:
            self._attempt_autopaste()

        self.osd.set_status("COPIED", "#238636")
        self.tray.set_state("idle")
        logger.info("Prompt copied to clipboard:\n%s", clipboard_text)

    def _build_clipboard_output(self, new_prompt: str) -> str:
        if not self.continuation_mode:
            self._clipboard_buffer = new_prompt
            self._last_prompt_copied_at = time.time()
            return new_prompt

        now = time.time()
        should_continue = (
            self._clipboard_buffer is not None
            and self._last_prompt_copied_at is not None
            and (now - self._last_prompt_copied_at) <= self.continuation_window_seconds
        )
        if should_continue:
            combined = f"{self._clipboard_buffer}\n\nCONTINUATION:\n{new_prompt}"
            self._clipboard_buffer = combined
            self._last_prompt_copied_at = now
            return combined

        self._clipboard_buffer = new_prompt
        self._last_prompt_copied_at = now
        return new_prompt

    def _attempt_autopaste(self) -> None:
        try:
            import pyautogui

            modifier = "command" if platform.system() == "Darwin" else "ctrl"
            pyautogui.hotkey(modifier, "v")
        except Exception as exc:
            logger.warning("Auto-paste failed: %s", exc)

    def run(self) -> None:
        logger.info("Hotkey active. Press %s to start/stop recording.", self.hotkey)
        self._listener = keyboard.Listener(on_press=self._on_press, on_release=self._on_release)
        self._listener.start()

        while not self._stop_event.is_set():
            time.sleep(0.1)

    def shutdown(self) -> None:
        self._stop_event.set()
        if self._listener:
            self._listener.stop()
        if self.is_recording:
            self.stop_recording()
        self.osd.set_status("STOPPED", "#57606a")
        self.tray.stop()

def normalize_technical_text(text: str) -> tuple[str, list[str]]:
    stripped = " ".join(text.strip().split())
    if not stripped:
        return "", []

    files = _extract_file_refs(stripped)
    normalized = _ensure_sentence_case(stripped)
    normalized = _ensure_terminal_punctuation(normalized)
    normalized = _promote_file_refs(normalized, files)
    return normalized, files


def _extract_file_refs(text: str) -> list[str]:
    found: list[str] = []
    for match in FILE_REF_RE.finditer(text):
        token = match.group(1).strip(".,;:!?")
        if "/" in token or "." in token:
            found.append(token)
    deduped = []
    seen = set()
    for item in found:
        key = item.lower()
        if key not in seen:
            deduped.append(item)
            seen.add(key)
    return deduped


def _ensure_sentence_case(text: str) -> str:
    chunks = re.split(r"([.!?]\s+)", text)
    rebuilt: list[str] = []
    for i in range(0, len(chunks), 2):
        sentence = chunks[i].strip()
        if not sentence:
            continue
        sep = chunks[i + 1] if i + 1 < len(chunks) else " "
        sentence = sentence[0].upper() + sentence[1:] if sentence else sentence
        sentence = re.sub(r"\bi\b", "I", sentence)
        rebuilt.append(sentence + (sep if sep else " "))
    output = "".join(rebuilt).strip()
    return output


def _ensure_terminal_punctuation(text: str) -> str:
    if not text:
        return text
    if text[-1] not in ".!?":
        return text + "."
    return text


def _promote_file_refs(text: str, file_refs: list[str]) -> str:
    out = text
    for ref in sorted(file_refs, key=len, reverse=True):
        escaped = re.escape(ref)
        out = re.sub(rf"\b{escaped}\b", f"@{ref}", out)
    return out


def _detect_function_like_tokens(text: str) -> list[str]:
    tokens = set(CAMEL_CASE_RE.findall(text))
    tokens.update(SNAKE_CASE_RE.findall(text))
    return sorted(tokens)


def format_prompt(transcribed_text: str, system_instruction: str | None = None) -> PromptResult:
    normalized, files = normalize_technical_text(transcribed_text)
    primary_file = files[0] if files else "none"
    function_refs = _detect_function_like_tokens(normalized)

    file_line = f"[FILE REFERENCE: {primary_file}]"
    task_line = f"[TASK: {normalized}]"
    fn_line = f"[FUNCTIONS: {', '.join(function_refs)}]" if function_refs else ""
    sys_line = f"[SYSTEM INSTRUCTION: {system_instruction}]" if system_instruction else ""
    envelope = "\n".join(line for line in [sys_line, file_line, fn_line, task_line] if line).strip()
    return PromptResult(
        raw_text=transcribed_text,
        normalized_text=normalized,
        file_refs=files,
        formatted_prompt=envelope,
    )


def _default_hotkey() -> str:
    return "cmd+shift+v" if platform.system() == "Darwin" else "ctrl+shift+v"


def _to_pynput_hotkey_spec(hotkey: str) -> str:
    parts = [p.strip().lower() for p in hotkey.split("+") if p.strip()]
    if not parts:
        raise ValueError("Hotkey cannot be empty")
    normalized: list[str] = []
    for p in parts:
        if p in MODIFIER_KEYS:
            mapped = "cmd" if p == "command" else "ctrl" if p == "control" else "alt" if p == "option" else p
            normalized.append(f"<{mapped}>")
        elif len(p) == 1:
            normalized.append(p)
        else:
            raise ValueError(f"Unsupported key in hotkey: {p}")
    return "+".join(normalized)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Local voice-to-prompt hotkey tool")
    parser.add_argument("--hotkey", default=_default_hotkey(), help="Hotkey combo, e.g. ctrl+shift+v")
    parser.add_argument("--autopaste", action="store_true", help="Auto-paste after copying")
    parser.add_argument("--sample-rate", type=int, default=16000)
    parser.add_argument(
        "--input-device",
        default=None,
        help="Input device index or name substring (e.g. 'Arctis Nova Pro Wireless')",
    )
    parser.add_argument("--list-devices", action="store_true", help="List audio devices and exit")
    parser.add_argument("--template", default=None, help="Template key from config/templates.json")
    parser.add_argument(
        "--continuation-mode",
        action="store_true",
        help="Append prompts within the continuation window instead of overwriting clipboard",
    )
    parser.add_argument(
        "--continuation-window-seconds",
        type=int,
        default=30,
        help="Continuation append window in seconds (default: 30)",
    )
    parser.add_argument(
        "--log-file",
        default=None,
        help="Optional path to log file for timestamped diagnostics",
    )
    return parser.parse_args()


def configure_file_logging(log_file: str | None) -> None:
    if not log_file:
        return
    log_path = Path(log_file).expanduser()
    if not log_path.is_absolute():
        log_path = Path.cwd() / log_path
    log_path.parent.mkdir(parents=True, exist_ok=True)
    file_handler = logging.FileHandler(log_path, encoding="utf-8")
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
    )
    logging.getLogger().addHandler(file_handler)
    logger.info("File logging enabled at %s", log_path)


def load_templates(path: Path = TEMPLATES_PATH) -> dict[str, str]:
    if not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.warning("Failed reading templates file %s: %s", path, exc)
        return {}
    if not isinstance(data, dict):
        logger.warning("Template file %s must be a JSON object.", path)
        return {}
    templates: dict[str, str] = {}
    for key, value in data.items():
        if isinstance(key, str) and isinstance(value, str):
            cleaned_key = key.strip()
            cleaned_value = value.strip()
            if cleaned_key and cleaned_value:
                templates[cleaned_key] = cleaned_value
    return templates


def resolve_input_device(device_arg: str | None) -> str | int | None:
    if not device_arg:
        return _auto_pick_input_device()
    if sd is None:
        raise RuntimeError("sounddevice is unavailable")

    raw = device_arg.strip()
    if not raw:
        return None
    if raw.isdigit():
        return int(raw)

    target = raw.lower()
    devices = sd.query_devices()
    # prefer input-capable devices with exact-ish substring match
    for i, d in enumerate(devices):
        name = str(d.get("name", ""))
        max_in = int(d.get("max_input_channels", 0) or 0)
        if max_in > 0 and target in name.lower():
            return i
    raise ValueError(f"No input device matched: {raw}")


def _auto_pick_input_device() -> str | int | None:
    """Pick a sensible coding-mic default on Windows before generic default."""
    if sd is None:
        return None
    try:
        devices = sd.query_devices()
    except Exception:
        return None

    preferred_markers = [
        "arctis nova pro wireless",
        "arctis nova pro",
        "steelseries sonar - microphone",
    ]
    backend_preference = ["windows directsound", "mme", "windows wasapi", "windows wdm-ks"]

    candidates: list[tuple[int, int, int]] = []
    for i, d in enumerate(devices):
        name = str(d.get("name", ""))
        lowered = name.lower()
        max_in = int(d.get("max_input_channels", 0) or 0)
        if max_in <= 0:
            continue

        marker_rank = next((idx for idx, m in enumerate(preferred_markers) if m in lowered), None)
        if marker_rank is None:
            continue
        backend_rank = next((idx for idx, b in enumerate(backend_preference) if b in lowered), len(backend_preference))
        candidates.append((marker_rank, backend_rank, i))

    if candidates:
        candidates.sort()
        return candidates[0][2]
    return None


def list_input_devices() -> str:
    if sd is None:
        return "sounddevice unavailable."
    lines = []
    default_in = None
    try:
        default_in = sd.default.device[0]
    except Exception:
        pass
    for i, d in enumerate(sd.query_devices()):
        max_in = int(d.get("max_input_channels", 0) or 0)
        if max_in <= 0:
            continue
        marker = " (default)" if default_in == i else ""
        lines.append(f"{i}: {d.get('name', 'unknown')}{marker}")
    return "\n".join(lines) if lines else "No input-capable devices found."


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    args = parse_args()
    configure_file_logging(args.log_file)
    instance_lock = InstanceLock(INSTANCE_LOCK_PATH)
    if not instance_lock.acquire(replace_existing=True):
        logger.error("Another voice_prompt_tool instance is already running.")
        return 2
    if args.list_devices:
        print(list_input_devices())
        return 0

    templates = load_templates()
    selected_instruction: str | None = None
    if args.template:
        selected_instruction = templates.get(args.template)
        if not selected_instruction:
            keys = ", ".join(sorted(templates.keys())) or "(none configured)"
            logger.error("Unknown template '%s'. Available templates: %s", args.template, keys)
            return 2
        logger.info("Using template: %s", args.template)

    resolved_device: str | int | None
    try:
        resolved_device = resolve_input_device(args.input_device)
    except ValueError as exc:
        logger.error(str(exc))
        print(list_input_devices())
        return 2

    if resolved_device is not None:
        logger.info("Using input device: %s", resolved_device)
    else:
        logger.info("Using system default input device.")

    try:
        tool = VoicePromptTool(
            hotkey=args.hotkey,
            sample_rate=args.sample_rate,
            autopaste=args.autopaste,
            input_device=resolved_device,
            system_instruction=selected_instruction,
            continuation_mode=args.continuation_mode,
            continuation_window_seconds=args.continuation_window_seconds,
        )
    except RuntimeError as exc:
        logger.error(str(exc))
        return 2

    def _handle_signal(sig, frame) -> None:
        logger.info("Shutting down on signal %s", sig)
        tool.shutdown()

    signal.signal(signal.SIGINT, _handle_signal)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, _handle_signal)

    try:
        tool.run()
    except KeyboardInterrupt:
        pass
    finally:
        tool.shutdown()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

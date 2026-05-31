import unittest

try:
    from voice_prompt_tool import _log_prompt_copied, format_prompt
except Exception as exc:  # pragma: no cover - optional voice deps may be absent in default installs
    _IMPORT_ERROR = exc
    _log_prompt_copied = None
    format_prompt = None
else:
    _IMPORT_ERROR = None


@unittest.skipIf(_IMPORT_ERROR is not None, f"voice prompt dependencies unavailable: {_IMPORT_ERROR}")
class VoicePromptToolLoggingTests(unittest.TestCase):
    def test_prompt_copy_log_excludes_prompt_text(self) -> None:
        secret = "sk-live-super-secret"
        result = format_prompt(f"use the API key {secret} in server.py")

        with self.assertLogs("voice_prompt_tool", level="INFO") as captured:
            _log_prompt_copied(
                result.formatted_prompt,
                result,
                continuation_mode=False,
                autopaste=False,
            )

        logs = "\n".join(captured.output)
        self.assertIn("Prompt copied to clipboard", logs)
        self.assertIn("chars=", logs)
        self.assertIn("file_refs=", logs)
        self.assertNotIn(secret, logs)
        self.assertNotIn(result.formatted_prompt, logs)


if __name__ == "__main__":
    unittest.main()

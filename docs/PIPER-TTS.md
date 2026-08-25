# Piper TTS (local DE)

JARVIS defaults to browser `speechSynthesis`. Piper is an optional local neural TTS.

## Install (Windows)

```powershell
pwsh -File scripts/install-piper.ps1
```

This downloads Piper into `%LOCALAPPDATA%\jarvis-piper\` and a German voice model when available.

## Configure

| Key / Env             | Meaning               |
| --------------------- | --------------------- |
| `PIPER_PATH`          | Path to `piper.exe`   |
| `PIPER_MODEL`         | Path to `.onnx` voice |
| Flag `voice.piperTts` | Enable IPC speak path |

## Fallback

If Piper is missing, `voice:piper-status` reports unavailable and the renderer keeps SpeechSynthesis — no fake audio.

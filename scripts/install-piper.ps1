# Install Piper TTS for JARVIS (Windows)

$ErrorActionPreference = 'Stop'
$root = Join-Path $env:LOCALAPPDATA 'jarvis-piper'
$binDir = Join-Path $root 'piper'
$voiceDir = Join-Path $root 'voices'
New-Item -ItemType Directory -Force -Path $binDir, $voiceDir | Out-Null

Write-Host "Piper install root: $root"
Write-Host @"

Manual steps (release URLs change):
1. Download Windows x64 Piper release from https://github.com/rhasspy/piper/releases
2. Extract piper.exe into: $binDir
3. Download a German voice (e.g. de_DE-thorsten-medium) from https://huggingface.co/rhasspy/piper-voices
4. Place the .onnx (+ .json) into: $voiceDir
5. In JARVIS Setup / config keys set:
   PIPER_PATH = $binDir\piper.exe
   PIPER_MODEL = $voiceDir\de_DE-thorsten-medium.onnx
6. Enable feature flag voice.piperTts

Until binaries exist, JARVIS keeps SpeechSynthesis as the working TTS path.
"@

# Scaffold marker so status can detect intent directory
Set-Content -Path (Join-Path $root 'INSTALL.txt') -Value "See docs/PIPER-TTS.md — place piper.exe and voice model here."
Write-Host "Wrote $root\INSTALL.txt"

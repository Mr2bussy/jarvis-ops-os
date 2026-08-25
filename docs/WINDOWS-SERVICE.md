# Windows Service (NSSM)

JARVIS can run as a Windows service for headless gateway / cron workloads.

## Recommended (desktop)

Use `JARVIS-Launch.bat` / `JARVIS.lnk` for the full Electron UI.

## Service install (NSSM)

1. Build once: `pnpm run build`
2. Install [NSSM](https://nssm.cc/download) and add `nssm.exe` to PATH
3. Elevated PowerShell:

```powershell
cd "G:\JAvis og rn"
.\scripts\install-jarvis-service.ps1
nssm start JarvisOpsOS
```

Uninstall:

```powershell
.\scripts\install-jarvis-service.ps1 -Uninstall
```

## Notes

- Session 0 isolation: the Electron UI may not appear when run as a service. Prefer the launcher for interactive use; use the service for Hermes Router / scheduled jobs if you headless-run the main process.
- Logs: `logs/service-stdout.log`, `logs/service-stderr.log`
- Fallback: the script prints a `node-windows` scaffold if NSSM is missing.

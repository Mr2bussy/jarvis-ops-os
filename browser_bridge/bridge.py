"""
JARVIS Browser Bridge — a local sidecar around browser-use.

Mirrors the MT5 bridge design deliberately: a loopback-only HTTP server with
shared-secret auth, spawned by the Electron main process, never reachable from
the renderer. Only the main process holds the token, and only the harness tool
layer is allowed to call it — so a browser task always passes the risk gate and,
when armed, human approval.

  python bridge.py            (port 1237)
  python bridge.py 8099       (custom port)

Install the dependency with:  pip install browser-use

Honesty rule, same as the rest of the app: if browser-use or a browser binary is
missing, every endpoint says so plainly. Nothing here simulates a browser run.
"""

import sys
import os
import hmac
import json
import uuid
import asyncio
import threading
import traceback
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 1237
HOST = "127.0.0.1"

# Shared secret, set by the Electron main process when it spawns this file.
# Enforce-if-set: configured -> unauthenticated requests get 401; unset (manual
# standalone run) -> open, but the startup banner warns loudly.
AUTH_TOKEN = os.environ.get("JARVIS_BRIDGE_TOKEN", "")

MAX_TASK_CHARS = 4000
MAX_STEPS_CAP = 40

# ── Optional dependency ─────────────────────────────────────────────────────
_IMPORT_ERROR = ""
Agent = None
ChatOpenAI = None
try:
    from browser_use import Agent as _Agent  # type: ignore
    Agent = _Agent
except Exception as exc:  # pragma: no cover - depends on host environment
    _IMPORT_ERROR = f"{type(exc).__name__}: {exc}"


# ── Job registry ────────────────────────────────────────────────────────────
# Browser tasks take minutes, far longer than a sane HTTP timeout, so POST
# /task returns a job id immediately and the caller polls /task/<id>.
_jobs = {}
_jobs_lock = threading.Lock()


def _new_job(task: str):
    job_id = uuid.uuid4().hex
    with _jobs_lock:
        _jobs[job_id] = {
            "id": job_id,
            "task": task[:MAX_TASK_CHARS],
            "state": "running",
            "result": None,
            "error": None,
            "steps": [],
        }
    return job_id


def _update_job(job_id, **patch):
    with _jobs_lock:
        job = _jobs.get(job_id)
        if job:
            job.update(patch)


def _get_job(job_id):
    with _jobs_lock:
        job = _jobs.get(job_id)
        return dict(job) if job else None


def _run_task(job_id, task, max_steps, headless):
    """Execute one browser-use agent run on its own event loop, in its own thread."""
    if Agent is None:
        _update_job(job_id, state="error", error=f"browser-use not installed ({_IMPORT_ERROR})")
        return

    async def _go():
        agent = Agent(task=task, headless=headless)
        return await agent.run(max_steps=max_steps)

    loop = asyncio.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        history = loop.run_until_complete(_go())
        # browser-use returns an AgentHistoryList; reduce it to plain JSON.
        final = None
        for attr in ("final_result", "extracted_content"):
            fn = getattr(history, attr, None)
            if callable(fn):
                try:
                    final = fn()
                    break
                except Exception:
                    continue
        _update_job(
            job_id,
            state="done",
            result=str(final) if final is not None else str(history)[:20000],
        )
    except Exception as exc:
        _update_job(
            job_id,
            state="error",
            error=f"{type(exc).__name__}: {exc}",
            result=traceback.format_exc()[-4000:],
        )
    finally:
        try:
            loop.close()
        except Exception:
            pass


class Handler(BaseHTTPRequestHandler):
    server_version = "JarvisBrowserBridge/1.0"

    def log_message(self, fmt, *args):  # keep stdout clean for the parent process
        pass

    def send_json(self, code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        # No CORS headers on purpose: only the Electron main process calls this,
        # and it is not subject to the same-origin policy. Permissive CORS here
        # would open a browser-driven CSRF path into local browser automation.
        self.end_headers()
        self.wfile.write(body)

    def _authorized(self) -> bool:
        if not AUTH_TOKEN:
            return True  # standalone/manual run — see startup warning
        return hmac.compare_digest(self.headers.get("X-JARVIS-Token", ""), AUTH_TOKEN)

    def _status_payload(self):
        return {
            "ok": Agent is not None,
            "installed": Agent is not None,
            "detail": "ready" if Agent is not None else f"browser-use not installed ({_IMPORT_ERROR})",
            "version": "1.0",
            "jobs": len(_jobs),
        }

    def do_GET(self):
        if not self._authorized():
            return self.send_json(401, {"error": "unauthorized"})
        path = urlparse(self.path).path.rstrip("/")

        if path in ("/api/v1/ping", "/api/v1/status"):
            return self.send_json(200, self._status_payload())

        if path.startswith("/api/v1/task/"):
            job = _get_job(path.rsplit("/", 1)[-1])
            if not job:
                return self.send_json(404, {"error": "unknown job"})
            return self.send_json(200, job)

        return self.send_json(404, {"error": "unknown endpoint"})

    def do_POST(self):
        if not self._authorized():
            return self.send_json(401, {"error": "unauthorized"})
        path = urlparse(self.path).path.rstrip("/")

        if path == "/api/v1/shutdown":
            # Authenticated, deliberate stop. The Electron app calls this on
            # startup with the *previous* session's token so a bridge left over
            # from that session can be retired before the secret is rotated.
            self.send_json(200, {"ok": True, "stopping": True})
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return

        if path != "/api/v1/task":
            return self.send_json(404, {"error": "unknown endpoint"})

        try:
            length = int(self.headers.get("Content-Length") or 0)
            payload = json.loads(self.rfile.read(length) or b"{}")
        except Exception as exc:
            return self.send_json(400, {"error": f"bad json: {exc}"})

        task = str(payload.get("task") or "").strip()
        if not task:
            return self.send_json(400, {"error": "task is required"})
        if len(task) > MAX_TASK_CHARS:
            return self.send_json(400, {"error": f"task exceeds {MAX_TASK_CHARS} chars"})
        if Agent is None:
            return self.send_json(
                503, {"error": f"browser-use not installed ({_IMPORT_ERROR})", "installed": False}
            )

        max_steps = min(int(payload.get("maxSteps") or 12), MAX_STEPS_CAP)
        headless = bool(payload.get("headless", True))

        job_id = _new_job(task)
        threading.Thread(
            target=_run_task, args=(job_id, task, max_steps, headless), daemon=True
        ).start()
        return self.send_json(202, {"id": job_id, "state": "running"})


def main():
    if not AUTH_TOKEN:
        print("[JARVIS Browser Bridge] WARNING: running UNAUTHENTICATED (JARVIS_BRIDGE_TOKEN not set)")
    if Agent is None:
        print(f"[JARVIS Browser Bridge] browser-use unavailable: {_IMPORT_ERROR}")
        print("[JARVIS Browser Bridge] install with: pip install browser-use")
    print(f"[JARVIS Browser Bridge] listening on http://{HOST}:{PORT}")
    HTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()

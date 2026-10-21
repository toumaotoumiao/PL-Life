#!/usr/bin/env python3
"""Give full-app synthetic Playwright pages a same-machine HTTP origin.

Playwright page.set_content() on a new page normally executes on about:blank
(opaque origin). IndexedDB APIs reject there, generating startup exceptions
which can both fail unrelated UI assertions and block click targets.

Call prepare_synthetic_origin(page) immediately before page.set_content(html).
All data stays in the ephemeral Playwright context on 127.0.0.1.
"""
from __future__ import annotations

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import atexit

_ROOT = Path(__file__).resolve().parents[2]
_server = None
_BOOTSTRAP = "/__pl_synthetic_origin_bootstrap__.html"


class _Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(_ROOT), **kwargs)

    def do_GET(self):
        if self.path.split("?", 1)[0] == _BOOTSTRAP:
            payload = b"<!doctype html><html lang='zh-CN'><head><meta charset='utf-8'></head><body></body></html>"
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(payload)
            return
        super().do_GET()

    def log_message(self, fmt, *args):
        pass


def prepare_synthetic_origin(page):
    """Establish a storage-capable origin, preserving each test's real assertions."""
    global _server
    if _server is None:
        _server = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
        Thread(target=_server.serve_forever, name="synthetic-origin", daemon=True).start()
        atexit.register(_server.server_close)
    origin = f"http://127.0.0.1:{_server.server_port}"
    page.goto(origin + _BOOTSTRAP, wait_until="domcontentloaded", timeout=30000)
    observed = page.evaluate("location.origin")
    if observed != origin:
        raise RuntimeError("Synthetic browser origin mismatch; refusing untrusted test setup")
    return origin

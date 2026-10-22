#!/usr/bin/env python3
# 把 docs/tech-stack.html 渲染成 assets/tech-stack.png（README 用）
# 用法：python build/render-stack.py
from __future__ import annotations

import functools
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
Handler.log_message = lambda *a, **k: None
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", 0), Handler)
port = httpd.server_address[1]
threading.Thread(target=httpd.serve_forever, daemon=True).start()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 900, "height": 1200}, device_scale_factor=2)
    page.goto(f"http://127.0.0.1:{port}/docs/tech-stack.html", wait_until="networkidle")
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(200)
    h = page.evaluate("document.body.getBoundingClientRect().height")
    page.screenshot(
        path=str(ROOT / "assets" / "tech-stack.png"),
        clip={"x": 0, "y": 0, "width": 900, "height": round(h)},
    )
    browser.close()
httpd.shutdown()
print(f"wrote assets/tech-stack.png  (body height {h:.0f}px)")

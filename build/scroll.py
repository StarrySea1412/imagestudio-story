#!/usr/bin/env python3
"""逐屏截图：按视口滚动抓取，并报告每屏是否真有内容（用于发现真实空白）。
用法：python build/scroll.py
"""
from __future__ import annotations

import functools
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "shots" / "scroll"
OUT.mkdir(parents=True, exist_ok=True)

Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
Handler.log_message = lambda *a, **k: None
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", 0), Handler)
port = httpd.server_address[1]
threading.Thread(target=httpd.serve_forever, daemon=True).start()

errors: list[str] = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(f"http://127.0.0.1:{port}/", wait_until="networkidle")
    page.evaluate("document.fonts.ready")
    total = page.evaluate("document.documentElement.scrollHeight")
    steps = (total + 899) // 900
    print(f"page height {total}px → {steps} screens")
    for i in range(steps):
        y = i * 900
        page.evaluate(f"window.scrollTo(0, {y})")
        page.wait_for_timeout(140)
        # 空白检测：统计该视口内文本节点与图片的覆盖
        info = page.evaluate(
            "() => { const vh = innerHeight; const r = [];"
            " const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);"
            " let n, chars = 0; while ((n = walker.nextNode())) {"
            "   if (!n.textContent.trim()) continue;"
            "   const range = document.createRange(); range.selectNodeContents(n);"
            "   const b = range.getBoundingClientRect();"
            "   if (b.bottom > 0 && b.top < vh && b.width > 0) chars += n.textContent.trim().length; }"
            " const imgs = [...document.images].filter(im => { const b = im.getBoundingClientRect();"
            "   return b.bottom > 0 && b.top < vh && b.width > 0; }).length;"
            " return { chars, imgs }; }"
        )
        flag = "BLANK?" if info["chars"] < 40 and info["imgs"] == 0 else ""
        print(f"  screen {i+1:02d} y={y:6d}  text={info['chars']:5d} images={info['imgs']}  {flag}")
        page.screenshot(path=str(OUT / f"s{i+1:02d}.png"))
    browser.close()
httpd.shutdown()
print("errors:", errors or "none")

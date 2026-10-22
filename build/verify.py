#!/usr/bin/env python3
"""本地无头验收：起静态服务 → 逐小样推状态 → 截图 + 收集 pageerror / console error / 破图。
用法：python build/verify.py
"""
from __future__ import annotations

import functools
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "shots"
SHOTS.mkdir(exist_ok=True)

Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", 0), Handler)
port = httpd.server_address[1]
threading.Thread(target=httpd.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{port}/"
print("serving", base)

errors: list[str] = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("console", lambda m: errors.append(f"console: {m.text}") if m.type == "error" else None)
    page.on("requestfailed", lambda r: errors.append(f"requestfailed: {r.url}"))

    page.goto(base, wait_until="networkidle")
    page.evaluate("document.fonts.ready")

    font_ok = page.evaluate("document.fonts.check('16px \"LXGW WenKai\"')")
    imgs = page.evaluate(
        "[...document.images].map(i => ({src: i.getAttribute('src'), ok: i.naturalWidth > 0, w: i.naturalWidth}))"
    )
    broken = [i["src"] for i in imgs if not i["ok"]]
    print(f"font loaded: {font_ok} | images: {len(imgs)} | broken: {','.join(broken) or 'none'}")

    # 章节目录与锚点
    ids = page.evaluate("[...document.querySelectorAll('section[id]')].map(s => s.id)")
    toc = page.evaluate("[...document.querySelectorAll('.toc a')].map(a => a.getAttribute('href').slice(1))")
    missing = [t for t in toc if t not in ids]
    print(f"sections: {len(ids)} | toc links: {len(toc)} | missing anchors: {', '.join(missing) or 'none'}")

    # 横向溢出检查（桌面 + 移动）
    for w, h, tag in [(1440, 900, "desktop"), (390, 844, "mobile")]:
        page.set_viewport_size({"width": w, "height": h})
        page.wait_for_timeout(250)
        overflow = page.evaluate(
            "() => { const d = document.documentElement;"
            " const scrollable = (el) => { let p = el.parentElement;"
            "   while (p) { const s = getComputedStyle(p);"
            "     if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && p.scrollWidth > p.clientWidth) return true;"
            "     p = p.parentElement; } return false; };"
            " const wide = [...document.querySelectorAll('body *')].filter(el => {"
            "   const r = el.getBoundingClientRect();"
            "   return r.width > 0 && (r.right > d.clientWidth + 2 || r.left < -2) && !scrollable(el);"
            " }).slice(0, 6).map(el => el.tagName + '.' + (el.className || '').toString().slice(0, 40));"
            " return { scrollW: d.scrollWidth, clientW: d.clientWidth, wide }; }"
        )
        print(f"[{tag}] scrollWidth={overflow['scrollW']} clientWidth={overflow['clientW']} offenders={overflow['wide']}")
        page.screenshot(path=str(SHOTS / f"hero-{tag}.png"), clip={"x": 0, "y": 0, "width": w, "height": min(h, 900)})

    page.set_viewport_size({"width": 1440, "height": 900})

    def shot(selector: str, name: str):
        el = page.query_selector(selector)
        if not el:
            errors.append(f"missing demo: {selector}")
            return
        el.scroll_into_view_if_needed()
        page.wait_for_timeout(180)
        el.screenshot(path=str(SHOTS / name))

    # DEMO 01 · 渠道体检台
    shot("#demo-clinic", "01-clinic-default.png")
    page.click('#cl-list .ch-row[data-id="local"]')
    page.click("#cl-kill")
    page.wait_for_timeout(150)
    shot("#demo-clinic", "01-clinic-failover.png")
    page.check("#cl-lock")
    page.wait_for_timeout(150)
    shot("#demo-clinic", "01-clinic-locked.png")
    page.uncheck("#cl-lock")
    page.check("#cl-paid")
    page.wait_for_timeout(150)
    shot("#demo-clinic", "01-clinic-manual.png")
    page.uncheck("#cl-paid")
    page.click("#cl-kill")
    page.click('#cl-list .ch-row[data-id="lupi"]')

    # DEMO 02 · 队列预算台
    shot("#demo-queue", "02-queue-default.png")
    page.eval_on_selector(
        "#q-count", "el => { el.value = 12; el.dispatchEvent(new Event('input', {bubbles:true})); }"
    )
    page.eval_on_selector(
        "#q-conc", "el => { el.value = 3; el.dispatchEvent(new Event('input', {bubbles:true})); }"
    )
    page.wait_for_timeout(150)
    shot("#demo-queue", "02-queue-12x3.png")
    # 取消两个任务：总时长必须不变（每次点击都会重绘，必须重新取元素）
    total_before = page.inner_text("#q-total")
    if len(page.query_selector_all("#q-gantt .qbar")) >= 3:
        page.query_selector_all("#q-gantt .qbar")[1].click()
        page.wait_for_timeout(80)
        page.query_selector_all("#q-gantt .qbar")[2].click()
    page.wait_for_timeout(150)
    total_after = page.inner_text("#q-total")
    print(f"cancel keeps makespan: before={total_before}s after={total_after}s -> {'OK' if total_before == total_after else 'CHANGED!'}")
    shot("#demo-queue", "02-queue-cancelled.png")
    page.check("#q-limit1")
    page.wait_for_timeout(150)
    shot("#demo-queue", "02-queue-limited.png")
    page.uncheck("#q-limit1")

    # DEMO 03 · 降级链
    shot("#demo-fallback", "03-fallback-429.png")
    for code in ["401", "404", "200"]:
        page.click(f'#fb-status button[data-s="{code}"]')
        page.wait_for_timeout(120)
        shot("#demo-fallback", f"03-fallback-{code}.png")
    # 200 + 蒙版 → 白名单死路
    page.click('#fb-status button[data-s="200"]')
    page.check("#fb-mask")
    page.wait_for_timeout(150)
    verdict = page.inner_text("#fb-verdict")
    print("200+mask verdict:", verdict.splitlines()[0])
    shot("#demo-fallback", "03-fallback-200-mask.png")
    page.uncheck("#fb-mask")
    page.uncheck("#fb-chatfails")
    page.wait_for_timeout(150)
    shot("#demo-fallback", "03-fallback-chat-ok.png")
    page.check("#fb-chatfails")

    # DEMO 04 · 元数据账本
    shot("#demo-ledger", "04-ledger-a1111.png")
    page.click('#lg-src button[data-s="comfy"]')
    page.wait_for_timeout(120)
    shot("#demo-ledger", "04-ledger-comfy.png")
    page.click('#lg-src button[data-s="none"]')
    page.wait_for_timeout(120)
    shot("#demo-ledger", "04-ledger-none.png")
    page.check("#lg-vision")
    page.wait_for_timeout(120)
    shot("#demo-ledger", "04-ledger-inferred.png")
    page.uncheck("#lg-vision")
    page.click('#lg-mode button[data-m="polish"]')
    for shape in ["clean", "fence", "chatty", "prose"]:
        page.click(f'#lg-shape button[data-s="{shape}"]')
        page.wait_for_timeout(120)
        shot("#demo-ledger", f"04-polish-{shape}.png")

    browser.close()

httpd.shutdown()

print("\n--- errors ---")
if errors:
    for e in errors:
        print(e)
else:
    print("none")

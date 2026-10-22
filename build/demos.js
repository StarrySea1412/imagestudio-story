/* 四枚确定性小样 + 阅读进度条。零依赖，全部原生 DOM。 */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (t) => {
    t = Math.max(0, Math.round(t));
    return t >= 60 ? Math.floor(t / 60) + "m" + String(t % 60).padStart(2, "0") + "s" : t + "s";
  };

  /* ── 阅读进度 ───────────────────────────── */
  const prog = $("#progress");
  if (prog) {
    const paint = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      prog.style.transform = "scaleX(" + (max > 0 ? h.scrollTop / max : 0) + ")";
    };
    addEventListener("scroll", paint, { passive: true });
    addEventListener("resize", paint, { passive: true });
    paint();
  }

  /* ══════════════════════════════════════════
     DEMO 01 · 渠道体检台
     能力判定直接照抄 src/provider-service.js 的四张关键词表
     ══════════════════════════════════════════ */
  (() => {
    const root = $("#demo-clinic");
    if (!root) return;

    const IMAGE_HINTS = ["image", "dall", "flux", "stable-diffusion", "sdxl", "sd3", "imagen", "ideogram", "kolors", "qwen-image", "seedream"];
    const TEXT_HINTS = ["gpt", "claude", "gemini", "qwen", "deepseek", "llama", "mistral", "chat"];
    const VISION_HINTS = ["vision", "vl", "gpt-4o", "gpt-4.1", "gemini", "qwen-vl", "qwen2.5-vl", "llava"];
    const VIDEO_HINTS = ["sora", "video", "cogvideo", "kling", "seedance", "hailuo", "vidu", "veo", "hunyuan", "wanx", "wan2", "pika", "luma", "runway", "ltx", "mochi"];

    function capsOf(id) {
      const v = String(id).toLowerCase();
      const out = [];
      const videoCapable = VIDEO_HINTS.some((h) => v.includes(h));
      if (videoCapable) out.push("video");
      const imageCapable = IMAGE_HINTS.some((h) => v.includes(h));
      if (imageCapable) out.push("image");
      if (!imageCapable && !videoCapable && (TEXT_HINTS.some((h) => v.includes(h)) || !out.length)) out.push("text");
      if (VISION_HINTS.some((h) => v.includes(h))) out.push("vision");
      return [...new Set(out)];
    }

    const CHANNELS = [
      { id: "lupi", name: "噜皮生图", host: "image.mlgb7.com", models: ["gpt-image-2", "gpt-image-1.5", "gpt-4o"] },
      { id: "imghub", name: "IMG Hub", host: "aiddup.com", models: ["auto", "seedream-4.0", "nano-banana"] },
      { id: "relayx", name: "中转 X", host: "relay.example.net", models: ["sora-2", "gpt-4o"] },
      { id: "local", name: "本地 ComfyUI", host: "127.0.0.1:8188", models: ["sd3.5-large", "flux-schnell"] },
      { id: "cloud", name: "某云", host: "api.example.cn", models: ["qwen-image", "qwen-vl-max"] },
      { id: "pool", name: "免费池", host: "free.example.org", models: ["auto"] }
    ];

    const state = { main: "lupi", dead: false, overrideAuto: false, locked: false };
    const elList = $("#cl-list");
    const elMain = $("#cl-main");
    const elMainModels = $("#cl-main-models");
    const elCand = $("#cl-cand");
    const elEvents = $("#cl-events");
    const elPaid = $("#cl-paid");
    const elLock = $("#cl-lock");
    const elKill = $("#cl-kill");

    const capsFor = (ch) =>
      ch.models.map((m) => {
        let caps = capsOf(m);
        // 「手动标成生图」：真实系统里靠模型下拉直接选它来绕过能力推断的自动筛选
        if (state.overrideAuto && m === "auto") caps = [...new Set(["image", "text"])];
        return { model: m, caps };
      });

    const imageModels = (ch) => capsFor(ch).filter((x) => x.caps.includes("image")).map((x) => x.model);

    function candidates() {
      return CHANNELS
        .filter((c) => c.id !== state.main)
        .map((c) => ({ ch: c, imgs: imageModels(c) }))
        .filter((x) => x.imgs.length > 0)
        .sort((a, b) => b.imgs.length - a.imgs.length); // 稳定排序：数量相同保持原顺序
    }

    function render() {
      const main = CHANNELS.find((c) => c.id === state.main);
      const cands = candidates();
      elMain.textContent = main.name;
      elMainModels.textContent = imageModels(main).length;
      elCand.textContent = cands.length;

      elList.innerHTML = CHANNELS.map((ch) => {
        const isMain = ch.id === state.main;
        const isDead = isMain && state.dead;
        const caps = capsFor(ch);
        const tags = caps
          .flatMap((x) => x.caps.map((c) => ({ c, m: x.model })))
          .filter((x, i, arr) => arr.findIndex((y) => y.c === x.c) === i)
          .map((x) => `<span class="cap ${x.c === "image" ? "img" : x.c === "video" ? "vid" : x.c === "vision" ? "vis" : "txt"}">${
            x.c === "image" ? "生图" : x.c === "video" ? "视频" : x.c === "vision" ? "视觉" : "文本"
          }</span>`)
          .join("");
        return `<button type="button" class="ch-row" data-id="${ch.id}" data-main="${isMain}" data-dead="${isDead}">
          <span class="nm">${esc(ch.name)}${isMain ? '<i class="role">主力</i>' : ""}${isDead ? '<i class="role" style="color:#e88b7b;border-color:rgba(207,91,69,.5)">已挂</i>' : ""}</span>
          <span class="caps">${tags}</span>
          <span class="md">${esc(ch.host)} · ${esc(ch.models.join(" / "))}</span>
        </button>`;
      }).join("");

      const events = [];
      if (!state.dead) {
        events.push(`<div class="evtrow ok"><b>patrol.ok</b> 主力「${esc(main.name)}」/models 返回 200，生图模型 ${imageModels(main).length} 个，不动作</div>`);
      } else if (state.locked) {
        events.push(`<div class="evtrow bad"><b>patrol.locked</b> 主力生图「${esc(main.name)}」检测失败，但已锁定不自动切换</div>`);
      } else if (cands.length) {
        const next = cands[0];
        events.push(`<div class="evtrow ok"><b>patrol.switch</b> 主力生图已从「${esc(main.name)}」自动切到「${esc(next.ch.name)}」，模型 <code>${esc(next.imgs[0])}</code></div>`);
        events.push(`<div class="evtrow"><b>roles.image</b> ${esc((next.ch.id === "imghub") ? "注意：并列时按数组顺序取第一个——IMG Hub 与本地 ComfyUI 都是 2 个生图模型，先出现的赢。" : "切换的代价是图风会变：新渠道的默认模型未必和原来一致。")}</div>`);
      } else {
        events.push(`<div class="evtrow bad"><b>patrol.empty</b> 找不到任何含生图模型的接替渠道，主力保持「${esc(main.name)}」，任务会继续失败</div>`);
      }
      if (state.overrideAuto) {
        events.push(`<div class="evtrow"><b>manual</b> auto 被人工标成生图：它其实一直能出图，只是名字里没有关键词，自动候选池永远看不见它。</div>`);
      }
      elEvents.innerHTML = events.join("");
    }

    elList.addEventListener("click", (e) => {
      const row = e.target.closest(".ch-row");
      if (!row) return;
      state.main = row.dataset.id;
      state.dead = false;
      render();
    });
    elPaid.addEventListener("input", () => { state.overrideAuto = elPaid.checked; render(); });
    elLock.addEventListener("input", () => { state.locked = elLock.checked; render(); });
    elKill.addEventListener("click", () => {
      state.dead = !state.dead;
      elKill.textContent = state.dead ? "恢复主力" : "模拟主力挂掉";
      render();
    });
    render();
  })();

  /* ══════════════════════════════════════════
     DEMO 02 · 队列预算台
     贪心列表调度：每个任务放进最早空出的槽位
     ══════════════════════════════════════════ */
  (() => {
    const root = $("#demo-queue");
    if (!root) return;
    const state = { cancelled: new Set() };
    const elCount = $("#q-count"), elConc = $("#q-conc"), elBase = $("#q-base"), elLimit = $("#q-limit1");
    const elGantt = $("#q-gantt"), elTotal = $("#q-total"), elPeak = $("#q-peak"), elWait = $("#q-wait"), elCancel = $("#q-cancel"), elNote = $("#q-note");

    // 固定种子抖动：同一组参数每次结果一致（这是小样，不是压测）
    function rnd(seed) {
      let s = seed | 0;
      s = Math.imul(s ^ (s >>> 15), 1 | s);
      s ^= s + Math.imul(s ^ (s >>> 7), 61 | s);
      return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
    }

    function schedule() {
      const n = +elCount.value;
      const conc = elLimit.checked ? 1 : +elConc.value;
      const base = +elBase.value;
      const tasks = [];
      for (let i = 0; i < n; i++) {
        const dur = Math.round(base * (0.6 + 0.8 * rnd(1013 + i * 7919)));
        tasks.push({ id: i, dur, start: 0, end: 0, waited: false });
      }
      const slots = new Array(conc).fill(0);
      for (const t of tasks) {
        let idx = 0;
        for (let i = 1; i < slots.length; i++) if (slots[i] < slots[idx]) idx = i;
        t.start = slots[idx];
        t.end = t.start + t.dur;
        t.waited = t.start > 0;
        slots[idx] = t.end;
      }
      const total = Math.max(...tasks.map((t) => t.end));
      // 峰值在途：扫描所有起止事件
      const events = [];
      tasks.forEach((t) => { events.push([t.start, 1]); events.push([t.end, -1]); });
      events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      let cur = 0, peak = 0;
      events.forEach((e) => { cur += e[1]; peak = Math.max(peak, cur); });
      return { n, conc, base, tasks, total, peak, lastWait: tasks[tasks.length - 1].start };
    }

    function render() {
      $("#q-count-v").textContent = elCount.value;
      $("#q-conc-v").textContent = elConc.value;
      $("#q-base-v").textContent = elBase.value + "s";
      const s = schedule();
      elGantt.innerHTML = s.tasks.map((t) => {
        const left = (t.start / s.total) * 100;
        const width = Math.max(1.2, (t.dur / s.total) * 100);
        const cancelled = state.cancelled.has(t.id);
        const st = cancelled ? "cancelled" : t.waited ? "queued" : "immediate";
        const tip = `#${t.id + 1} · ${fmt(t.start)} 开始 · 耗时 ${t.dur}s${cancelled ? " · 已取消（结果丢弃）" : ""}`;
        return `<div class="qtrack"><div class="qbar" data-state="${st}" data-id="${t.id}" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%" title="${esc(tip)}"></div></div>`;
      }).join("") + `<div class="qaxis"><span>0s</span><span>${fmt(s.total / 2)}</span><span>${fmt(s.total)}</span></div>`;

      elTotal.textContent = Math.round(s.total);
      elPeak.textContent = s.peak;
      elWait.textContent = Math.round(s.lastWait) + "s";
      elCancel.textContent = state.cancelled.size;

      const notes = [];
      if (elLimit.checked && +elConc.value > 1) {
        notes.push(`渠道限 1 并发：并发拖到 ${elConc.value} 也没用，多出来的 ${+elConc.value - 1} 个槽位永远是空的——真实世界里的它们会被 429 打发回来。`);
      }
      if (+elConc.value > s.n) {
        notes.push("并发比任务还多：所有任务一开工就全速跑完，没有排队。");
      }
      if (state.cancelled.size) {
        notes.push(`取消 ${state.cancelled.size} 个任务，总时长一格没变——槽位仍被上游占着，只是结果被丢弃。取消省的是你的注意力，不是机器时间。`);
      }
      elNote.textContent = notes.length ? notes.join(" ") : "横轴是时间；每行一个任务。琥珀 = 立刻开始，青 = 排过队，斜纹 = 已取消但结果丢弃。";
    }

    elGantt.addEventListener("click", (e) => {
      const bar = e.target.closest(".qbar");
      if (!bar) return;
      const id = +bar.dataset.id;
      if (state.cancelled.has(id)) state.cancelled.delete(id);
      else state.cancelled.add(id);
      render();
    });
    [elCount, elConc, elBase, elLimit].forEach((el) => el.addEventListener("input", () => {
      state.cancelled.clear();
      render();
    }));
    render();
  })();

  /* ══════════════════════════════════════════
     DEMO 03 · 降级链
     照抄 generateImageOnce / generateImage 的两张判定表
     ══════════════════════════════════════════ */
  (() => {
    const root = $("#demo-fallback");
    if (!root) return;
    const NO_FAILOVER = ["PROVIDER_REQUIRED", "MODEL_REQUIRED", "PROVIDER_NOT_CONFIGURED", "IMAGE_TOO_LARGE",
      "IMAGE_RESPONSE_UNSUPPORTED", "IMAGE_MIME_INVALID", "IMAGE_URL_INVALID", "PROVIDER_AUTH_FAILED"];
    const state = { status: "429", mask: false, backup: true, chatFails: true };
    const elStatus = $("#fb-status"), elMask = $("#fb-mask"), elBackup = $("#fb-backup"), elChatFails = $("#fb-chatfails");
    const elChain = $("#fb-chain"), elVerdict = $("#fb-verdict");

    function chip(ix, title, note, v) {
      const label = { run: "执行", pass: "通过", stop: "终止", skip: "跳过", wait: "等待" }[v] || "";
      return `<div class="chip" data-v="${v}"><span class="ix">${ix}</span><span class="tt"><b>${title}</b><small>${note}</small></span><span class="vd">${label}</span></div>`;
    }

    function render() {
      const st = state.status;
      const isAuth = ["401", "402", "403"].includes(st);
      const is200 = st === "200";
      const steps = [];
      let code = "";
      let success = false;
      let route = "";
      let i = 1;

      steps.push(chip(i++, `主力 /v1/images/generations`, is200 ? "HTTP 200，但 data[0] 不存在" : `HTTP ${st}${st === "429" ? "（并发限流）" : ""}`, "run"));

      if (isAuth) {
        steps.push(chip(i++, "跳过 chat 型降级", "401/402/403 换接口格式也没用，直接抛", "skip"));
        code = "IMAGE_GENERATION_FAILED";
      } else if (is200) {
        if (state.mask) {
          steps.push(chip(i++, "跳过 chat 型降级", "带蒙版：chat 接口没地方放 mask", "skip"));
          code = "IMAGE_RESPONSE_UNSUPPORTED";
        } else if (state.chatFails) {
          steps.push(chip(i++, "尝试 chat 型生图", "images[] / Markdown / data URI / 裸 URL 四种解析，都没有图", "stop"));
          code = "IMAGE_RESPONSE_UNSUPPORTED";
        } else {
          steps.push(chip(i++, "尝试 chat 型生图", "从 message.images[].image_url.url 拿到图，仍走同一套 mime 与大小检查", "pass"));
          success = true;
          route = "remote-chat";
        }
      } else {
        if (state.mask) {
          steps.push(chip(i++, "跳过 chat 型降级", "带蒙版：局部重绘只能走 /images/edits", "skip"));
        } else if (state.chatFails) {
          steps.push(chip(i++, "尝试 chat 型生图", "这条渠道的 chat 也没有图，以原始错误为准", "stop"));
        } else {
          steps.push(chip(i++, "尝试 chat 型生图", `HTTP ${st} 之后仍从 chat 拿到了图；尺寸只能靠提示词附带，seed 丢失`, "pass"));
          success = true;
          route = "remote-chat";
        }
        code = "IMAGE_GENERATION_FAILED";
      }

      if (!success) {
        if (NO_FAILOVER.includes(code)) {
          steps.push(chip(i++, "外层：不换渠道", `<code>${code}</code> 在白名单里——判定为配置/内容问题，换渠道也不会更好`, "stop"));
        } else if (!state.backup) {
          steps.push(chip(i++, "外层：无渠道可换", "没有其它含生图模型的启用渠道，只能把原错误抛给用户", "stop"));
        } else {
          steps.push(chip(i++, "外层：换一条渠道", "按生图模型数量降序取第一个备用渠道，带上同样的参数重试<strong>一次</strong>", "pass"));
          success = true;
          route = "remote-fallback";
        }
      }

      elChain.innerHTML = steps.join("");

      if (success) {
        elVerdict.innerHTML = `结局：<b>出图了</b>。记录里的 <code>source</code> 会被标成 <code>${route}</code>${
          route === "remote-fallback" ? "，并附一个 <code>fallbackFrom</code> 指回失败的那条渠道" : ""
        }。<div class="code-line">成功不等于没出错：错误码、失败渠道、降级路径都该进日志。</div>`;
      } else {
        elVerdict.innerHTML = `结局：<b>失败</b>，抛给用户 <code>${code}</code>。<div class="code-line">${
          code === "IMAGE_RESPONSE_UNSUPPORTED"
            ? "这是整张表里唯一的死路：200 + 无图 被判成「模型不支持」，白名单拦住了换渠道，哪怕你有五条健康渠道。"
            : "这条错误码不在白名单里时，只要还有备用渠道，任务就还有一次机会。"
        }</div>`;
      }
    }

    elStatus.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-s]");
      if (!btn) return;
      state.status = btn.dataset.s;
      $$("button[data-s]", elStatus).forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      render();
    });
    elMask.addEventListener("input", () => { state.mask = elMask.checked; render(); });
    elBackup.addEventListener("input", () => { state.backup = elBackup.checked; render(); });
    if (elChatFails) elChatFails.addEventListener("input", () => { state.chatFails = elChatFails.checked; render(); });
    render();
  })();

  /* ══════════════════════════════════════════
     DEMO 04 · 元数据账本
     ══════════════════════════════════════════ */
  (() => {
    const root = $("#demo-ledger");
    if (!root) return;
    const state = { mode: "read", src: "a1111", shape: "clean", vision: false };

    const SRC = {
      a1111: {
        label: "AUTOMATIC1111 PNG Info",
        raw: "a serene lakeside at dawn, 35mm film still, soft haze over the water,\nwarm rim light on the reeds, muted teal and amber palette\nNegative prompt: lowres, blurry, watermark, extra fingers\nSteps: 28, Sampler: DPM++ 2M, CFG scale: 7, Seed: 8123477, Size: 1024x1024",
        rawNote: "tEXt 块 · parameters 字段；三段结构：正向 → Negative prompt: → 参数行",
        prompt: "a serene lakeside at dawn, 35mm film still, soft haze over the water, warm rim light on the reeds, muted teal and amber palette",
        negative: "lowres, blurry, watermark, extra fingers",
        params: "Steps 28 · DPM++ 2M · CFG 7 · Seed 8123477 · 1024x1024",
        exact: true, inferred: false, usable: true
      },
      comfy: {
        label: "ComfyUI workflow",
        raw: '{"3":{"class_type":"KSampler","inputs":{"positive":["6",0],"negative":["7",0],"seed":448812,"steps":24}},\n"6":{"class_type":"CLIPTextEncode","inputs":{"text":"harbor at dusk, wet cobblestone, gas lamp glow, 50mm"}},\n"7":{"class_type":"CLIPTextEncode","inputs":{"text":"text, watermark, deformed"}}}',
        rawNote: "prompt 字段是一整张节点图；要顺着 KSampler 的 positive/negative 输入往上游追",
        prompt: "harbor at dusk, wet cobblestone, gas lamp glow, 50mm",
        negative: "text, watermark, deformed",
        params: "KSampler · steps 24 · seed 448812",
        exact: true, inferred: false, usable: true
      },
      invoke: {
        label: "InvokeAI metadata",
        raw: '{"sd-metadata":{"model":"sd-1.5","image":{"prompt":[{"prompt":"foggy pine ridge at first light, long lens, cold air"}],"width":768,"height":1024,"seed":99123,"cfg_scale":7.5}}}',
        rawNote: "sd-metadata / invokeai_metadata；字段名与 A1111 完全不同，正负向藏在 image.prompt[] 里",
        prompt: "foggy pine ridge at first light, long lens, cold air",
        negative: "",
        params: "sd-1.5 · 768×1024 · seed 99123 · CFG 7.5",
        exact: true, inferred: false, usable: true
      },
      desc: {
        label: "图片文本元数据",
        raw: "Description: 海边黄昏，暖色逆光，胶片颗粒，远处有一艘小船",
        rawNote: "没有 Parameters，只有一段人写的说明——它可能是作者写的，也可能不是",
        prompt: "海边黄昏，暖色逆光，胶片颗粒，远处有一艘小船",
        negative: "",
        params: "—",
        exact: true, inferred: false, usable: true
      },
      none: {
        label: "（无）",
        raw: "（这个 PNG 里没有任何文本块：截图、二次压缩、格式转换都会把它们抹掉）",
        rawNote: "读取结果为 null，进入反推分支",
        prompt: "",
        negative: "",
        params: "—",
        exact: false, inferred: false, usable: false
      }
    };

    const SHAPES = {
      clean: {
        raw: '{"polishedPrompt":"a lone lighthouse on a basalt cliff at blue hour, long exposure sea mist, cold teal shadows with a single warm window light, 24mm wide angle, fine film grain","negativePrompt":"text, watermark, oversharpened","keywords":["lighthouse","blue hour","long exposure"]}',
        note: "一次 JSON.parse 成功",
        source: "remote-text",
        prompt: "a lone lighthouse on a basalt cliff at blue hour, long exposure sea mist, cold teal shadows with a single warm window light, 24mm wide angle, fine film grain"
      },
      fence: {
        raw: "```json\n{\"polishedPrompt\":\"a lone lighthouse on a basalt cliff at blue hour, long exposure sea mist, cold teal shadows with a single warm window light, 24mm wide angle, fine film grain\",\"negativePrompt\":\"text, watermark, oversharpened\",\"keywords\":[\"lighthouse\",\"blue hour\",\"long exposure\"]}\n```",
        note: "剥掉 Markdown 围栏后，第二次 parse 成功",
        source: "remote-text",
        prompt: "a lone lighthouse on a basalt cliff at blue hour, long exposure sea mist, cold teal shadows with a single warm window light, 24mm wide angle, fine film grain"
      },
      chatty: {
        raw: "好的，以下是润色结果：\n{\"polishedPrompt\":\"a lone lighthouse on a basalt cliff at blue hour, long exposure sea mist, cold teal shadows with a single warm window light, 24mm wide angle, fine film grain\",\"negativePrompt\":\"text, watermark, oversharpened\",\"keywords\":[\"lighthouse\",\"blue hour\",\"long exposure\"]}\n希望这个版本符合你的预期。",
        note: "从第一个 { 截到最后一个 }，第三次 parse 成功",
        source: "remote-text",
        prompt: "a lone lighthouse on a basalt cliff at blue hour, long exposure sea mist, cold teal shadows with a single warm window light, 24mm wide angle, fine film grain"
      },
      prose: {
        raw: "这幅画面应该描绘蓝调时刻的一座灯塔，孤零零地立在玄武岩悬崖上。长曝光让海雾呈现出丝绸般的质感，冷青色的阴影里只有一扇窗透出暖光。建议使用 24mm 广角，并保留胶片颗粒……",
        note: "三层都没接住（无围栏可剥、没有花括号）→ 退回本地规则",
        source: "local-rules",
        prompt: "海边孤立的灯塔，蓝调时刻，长曝光海雾，冷青阴影与一扇暖窗，24mm 广角，胶片颗粒，构图明确，主体突出，光线、材质、色彩和镜头信息完整，细节丰富，画面统一，高质量"
      }
    };

    const elMode = $("#lg-mode"), elSrc = $("#lg-src"), elShape = $("#lg-shape");
    const elSrcWrap = $("#lg-src-wrap"), elShapeWrap = $("#lg-shape-wrap"), elVisionWrap = $("#lg-vision-wrap");
    const elVision = $("#lg-vision");
    const elRaw = $("#lg-raw"), elRawNote = $("#lg-raw-note"), elRawLabel = $("#lg-raw-label");
    const elFlag = $("#lg-flag"), elRows = $("#lg-rows"), elNotice = $("#lg-notice");

    const row = (k, v, hot) => `<div class="ledger-row"><span>${k}</span><b class="${hot ? "hot" : ""}">${esc(v)}</b></div>`;

    function renderRead() {
      const s = SRC[state.src];
      elRawLabel.textContent = "文件里的原始文本（节选）";
      elRaw.textContent = s.raw;
      elRawNote.textContent = s.rawNote;

      let rec = s;
      let notice = "";
      if (state.src === "none") {
        if (state.vision) {
          rec = {
            label: "视觉模型反推",
            prompt: "a quiet harbor at dusk, moored fishing boats, wet stone quay, warm lamp reflections on black water, soft rain haze, 35mm",
            negative: "text, logo, watermark",
            params: "—",
            exact: false, inferred: true, usable: true
          };
          notice = "这张图没有可读取的生成元数据。以下提示词由视觉模型看图反推，不是作者原始提示词。";
        } else {
          rec = { label: "（不可用）", prompt: "", negative: "", params: "—", exact: false, inferred: true, usable: false };
          notice = "图片中没有可读取的生成元数据，且当前服务没有配置可用的视觉模型。请在「服务与模型」中设置 vision 模型后再试。";
        }
      }

      elFlag.innerHTML = rec.usable
        ? (rec.inferred ? '<span class="tag warn">推测 · inferred</span>' : '<span class="tag ok">读自文件 · exact</span>')
        : '<span class="tag bad">不可用</span>';

      elRows.innerHTML =
        row("来源", rec.label, true) +
        row("exact", String(rec.exact)) +
        row("inferred", String(rec.inferred)) +
        row("usable", String(rec.usable)) +
        row("提示词", rec.prompt || "（空）") +
        row("负向词", rec.negative || "（无）") +
        row("参数", rec.params);
      elNotice.style.display = notice ? "block" : "none";
      elNotice.textContent = notice;
    }

    function renderPolish() {
      const s = SHAPES[state.shape];
      elRawLabel.textContent = "文本模型的原文（节选）";
      elRaw.textContent = s.raw;
      elRawNote.textContent = s.note;
      elFlag.innerHTML = s.source === "local-rules"
        ? '<span class="tag warn">本地规则 · local-rules</span>'
        : '<span class="tag ok">模型返回 · remote-text</span>';
      elRows.innerHTML =
        row("source", s.source, true) +
        row("polishedPrompt", s.prompt) +
        row("negativePrompt", "text, watermark, oversharpened") +
        row("keywords", "lighthouse / blue hour / long exposure") +
        row("model", s.source === "local-rules" ? "demo-prompt-polisher" : "gpt-4.1-mini");
      elNotice.style.display = "block";
      elNotice.textContent = s.source === "local-rules"
        ? "模型没给出可用 JSON，系统退回本地模板。这条记录仍然可用，但 source 明确写着它不是模型写的——所以它算不上「润色」，只是「补全」。"
        : "解析成功。注意 polishedPrompt 是一段可直接提交的完整提示词，不是标题或关键词摘要——这条约束写在 system 提示里，也是润色最常失败的地方。";
    }

    function render() {
      const read = state.mode === "read";
      elSrcWrap.style.display = read ? "" : "none";
      elVisionWrap.style.display = read ? "" : "none";
      elShapeWrap.style.display = read ? "none" : "";
      if (read) renderRead();
      else renderPolish();
    }

    elMode.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-m]");
      if (!btn) return;
      state.mode = btn.dataset.m;
      $$("button[data-m]", elMode).forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      render();
    });
    elSrc.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-s]");
      if (!btn) return;
      state.src = btn.dataset.s;
      $$("button[data-s]", elSrc).forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      render();
    });
    elShape.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-s]");
      if (!btn) return;
      state.shape = btn.dataset.s;
      $$("button[data-s]", elShape).forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      render();
    });
    elVision.addEventListener("input", () => { state.vision = elVision.checked; render(); });
    render();
  })();
})();

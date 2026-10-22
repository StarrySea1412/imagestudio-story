// 拼接单文件站点：head + style + hero + 七章 + 结语 + footer + demos.js
// 用法：node build/build.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const style = read("build/style.css");
const hero = read("build/hero.html");
const chapters = ["ch1", "ch2", "ch3", "ch4", "ch5", "ch6", "ch7", "closing"]
  .map((n) => read(`build/${n}.html`)).join("\n");
const footer = read("build/footer.html");
const js = read("build/demos.js");

const head = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="dark"/>
<meta name="theme-color" content="#0c0a09"/>
<link rel="preload" href="assets/fonts/wenkai-regular.woff2" as="font" type="font/woff2" crossorigin/>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='4' fill='%230c0a09'/%3E%3Crect x='4' y='6' width='16' height='12' rx='1.6' fill='none' stroke='%23e6a33b' stroke-width='1.3'/%3E%3Ccircle cx='12' cy='11' r='2.2' fill='%2379b3a6'/%3E%3Cpath d='M7 15.2h10' stroke='%23e6a33b' stroke-width='.9' opacity='.7'/%3E%3C/svg%3E"/>
<meta name="description" content="等一张图显影：一个 AI 生图工作台的解剖报告。渠道体检、队列预算、降级链与元数据账本——从一次点按到一张可复查的图，附四枚可玩小样。"/>
<meta name="author" content="StarrySea1412"/>
<meta property="og:title" content="等一张图显影 · 造物手记 VOL.06"/>
<meta property="og:description" content="生图工具都在比谁的模型多。可真用起来，先坏掉的是那条把「一次点按」翻译成「排队、降级、落盘、记账」的流水线。"/>
<meta property="og:type" content="article"/>
<meta property="og:image" content="assets/art/hero.webp"/>
<title>等一张图显影 · 造物手记 VOL.06</title>
<style>
${style}
</style>
</head>
<body>
<div class="progress" id="progress"></div>
`;

const tail = `
<script>
${js}
</script>
</body>
</html>
`;

const html = head + hero + "\n<main>\n" + chapters + "\n</main>\n" + footer + tail;
writeFileSync(join(root, "index.html"), html, "utf8");
console.log(`built index.html  ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);

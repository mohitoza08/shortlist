/**
 * docs/TDD.md -> docs/TDD.html -> docs/TDD.pdf. Needs pandoc on PATH and Playwright Chromium.
 * Mermaid diagrams are rendered in the browser from a pinned CDN build; offline they fall back to their source.
 * Run: npm run pdf
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const docs = path.join(process.cwd(), "docs");
const body = path.join(docs, ".tdd-body.html");
execFileSync("pandoc", [path.join(docs, "TDD.md"), "-f", "markdown+pipe_tables", "-t", "html5", "--no-highlight", "-o", body]);

const css = `
@page { size: A4; margin: 18mm 16mm; }
body { font: 10.5pt/1.5 Inter, "Segoe UI", system-ui, sans-serif; color: #161615; background: #fff; max-width: 780px; margin: 0 auto; }
h1 { font: 400 24pt/1.2 "Instrument Serif", Georgia, serif; margin: 28pt 0 8pt; border-top: 1px solid #e6e4dd; padding-top: 14pt; page-break-after: avoid; }
h1:first-of-type { border: 0; font-size: 30pt; }
h2, h3 { page-break-after: avoid; }
table { border-collapse: collapse; width: 100%; margin: 10pt 0; font-size: 9.5pt; page-break-inside: avoid; }
th, td { border: 1px solid #e6e4dd; padding: 5pt 7pt; text-align: left; vertical-align: top; }
th { background: #f4f3ef; }
code { font: 9pt Consolas, monospace; background: #f4f3ef; padding: 1pt 3pt; border-radius: 3px; }
pre { background: #f4f3ef; padding: 8pt; border-radius: 6px; overflow: auto; font-size: 8.5pt; page-break-inside: avoid; }
blockquote { border-left: 3px solid #1f5c4a; background: #eaf1ee; margin: 10pt 0; padding: 6pt 12pt; }
img { max-width: 100%; border: 1px solid #e6e4dd; border-radius: 6px; }
pre.mermaid { background: #fff; text-align: center; }
a { color: #1f5c4a; }
`;

const shots = fs.existsSync(path.join(docs, "screenshots"))
  ? fs.readdirSync(path.join(docs, "screenshots")).filter((f) => f.endsWith(".png")).sort()
  : [];
const gallery = shots.length
  ? `<h1>Appendix: screenshots</h1>${shots
      .map((f) => `<figure style="page-break-inside:avoid;margin:0 0 14pt"><img src="screenshots/${f}" alt="${f}"/><figcaption style="font-size:9pt;color:#6e6e68">${f.replace(/^\d+-|\.png$/g, "").replace(/-/g, " ")}</figcaption></figure>`)
      .join("")}`
  : "";

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Shortlist — Technical Design Document</title><style>${css}</style></head><body>
${fs.readFileSync(body, "utf8")}
${gallery}
<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.esm.min.mjs";
  document.querySelectorAll("pre.mermaid").forEach((pre) => { pre.textContent = pre.textContent; });
  mermaid.initialize({ startOnLoad: false, theme: "neutral" });
  await mermaid.run({ querySelector: "pre.mermaid" }).catch(() => {});
  document.body.dataset.ready = "1";
</script></body></html>`;
const unwrapped = html.replace(/<pre class="mermaid"><code>([\s\S]*?)<\/code><\/pre>/g, (_m, inner: string) => `<pre class="mermaid">${inner}</pre>`);
fs.writeFileSync(path.join(docs, "TDD.html"), unwrapped);
fs.rmSync(body);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("file:///" + path.join(docs, "TDD.html").replace(/\\/g, "/"), { waitUntil: "networkidle" });
  await page.waitForSelector("body[data-ready='1']", { timeout: 20_000 }).catch(() => console.warn("Mermaid did not render; diagrams fall back to source."));
  await page.pdf({ path: path.join(docs, "TDD.pdf"), format: "A4", printBackground: true, margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" } });
  await browser.close();
  console.log("Wrote docs/TDD.html and docs/TDD.pdf");
})();

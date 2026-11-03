/**
 * Writes the synthetic seed CVs to prisma/seed-data/resumes (committed, small, no real people).
 * Run: npm run seed:resumes
 */
import fs from "node:fs";
import path from "node:path";
import { BRIEF, generated } from "./lib/cv-data";
import { render, type Cv } from "./lib/render";

const out = path.join(process.cwd(), "prisma", "seed-data", "resumes");
fs.mkdirSync(out, { recursive: true });

(async () => {
  const all: (Cv & { req: string })[] = [...BRIEF, ...generated()];
  const manifest: { file: string; req: string; kind: string }[] = [];
  for (const [i, cv] of all.entries()) {
    fs.writeFileSync(path.join(out, cv.file), await render(cv, i));
    manifest.push({ file: cv.file, req: cv.req, kind: cv.format ?? "pdf" });
  }
  // Two exact duplicates: same bytes, different filenames.
  for (const [src, dst] of [["ritika-bansal.pdf", "R_Bansal_CV_final.pdf"], ["arjun-rawat.pdf", "arjun_cv_2024.pdf"]]) {
    fs.copyFileSync(path.join(out, src), path.join(out, dst));
    manifest.push({ file: dst, req: BRIEF.find((b) => b.file === src)!.req, kind: "exact-duplicate" });
  }
  // One near-duplicate: same person (same email), updated CV.
  const near: Cv & { req: string } = { ...BRIEF[0], file: "ritika-bansal-updated.pdf", company: "Meridian Fintech", years: 7, notice: 45,
    bullets: [...BRIEF[0].bullets, "Introduced contract testing between payment services"] };
  fs.writeFileSync(path.join(out, near.file), await render(near, 40));
  manifest.push({ file: near.file, req: near.req, kind: "near-duplicate" });

  fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`Wrote ${manifest.length} seed CVs to ${out}`);
})();

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Document, Packer, Paragraph, TextRun } from "docx";
import sharp from "sharp";

export type Cv = {
  file: string;
  name: string;
  role: string;
  company: string;
  years: number;
  notice: number;
  ctc: number;
  location: string;
  skills: string[];
  bullets: string[];
  extra?: string[];
  twoColumn?: boolean;
  format?: "pdf" | "docx" | "scan" | "lowtext";
};

const email = (n: string) => `${n.toLowerCase().replace(/\s+/g, ".")}@example.com`;
const phone = (i: number) => `+91 9${String(100000000 + i * 7919).slice(0, 4)} ${String(10000 + i * 137).slice(0, 5)}`;

export function lines(cv: Cv, i: number) {
  if (cv.format === "lowtext") return [cv.name, `${cv.role}`];
  return [
    cv.name,
    `${email(cv.name)} | ${phone(i)}`,
    `Current Role: ${cv.role}`,
    `Current Company: ${cv.company}`,
    `Location: ${cv.location}`,
    `Notice Period: ${cv.notice} days`,
    `Expected CTC: ${cv.ctc} LPA`,
    "",
    "SUMMARY",
    `${cv.years} years of experience in ${cv.role.toLowerCase()} roles.`,
    "",
    "SKILLS",
    cv.skills.join(", "),
    "",
    "EXPERIENCE",
    ...cv.bullets.map((b) => `- ${b}`),
    ...(cv.extra ?? []),
    "",
    "PERSONAL DETAILS",
    "Date of Birth: 14 May 1992",
    "Gender: Not disclosed",
    "Marital Status: Single",
    "Nationality: Indian",
  ];
}

export async function renderPdf(cv: Cv, i: number) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595, 842]);
  const all = lines(cv, i);
  let y = 790;
  const x0 = cv.twoColumn ? 40 : 50;
  const width = cv.twoColumn ? 250 : 495;
  all.forEach((l, idx) => {
    const isHead = /^[A-Z ]{4,}$/.test(l) || idx === 0;
    if (cv.twoColumn && idx === Math.floor(all.length / 2)) y = 790;
    const x = cv.twoColumn && idx >= Math.floor(all.length / 2) ? 310 : x0;
    const f = isHead ? bold : font;
    const size = idx === 0 ? 18 : isHead ? 11 : 10;
    let line = "";
    for (const w of l.split(" ")) {
      const t = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(t, size) > width) {
        page.drawText(line, { x, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
        y -= 14;
        line = w;
      } else line = t;
    }
    page.drawText(line, { x, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
    y -= idx === 0 ? 24 : 15;
  });
  return Buffer.from(await doc.save());
}

export async function renderDocx(cv: Cv, i: number) {
  const d = new Document({ sections: [{ children: lines(cv, i).map((l) => new Paragraph({ children: [new TextRun(l)] })) }] });
  return Buffer.from(await Packer.toBuffer(d));
}

/** Image-only PDF (no text layer), like a scanned CV. */
export async function renderScan(cv: Cv, i: number) {
  const rows = lines(cv, i);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="794" height="1123"><rect width="100%" height="100%" fill="#f3f1ea"/>${rows
    .map((l, k) => `<text x="60" y="${80 + k * 26}" font-family="Arial" font-size="${k === 0 ? 26 : 16}" fill="#222">${esc(l)}</text>`)
    .join("")}</svg>`;
  const png = await sharp(Buffer.from(svg)).png({ palette: true }).toBuffer();
  const doc = await PDFDocument.create();
  const img = await doc.embedPng(png);
  const page = doc.addPage([595, 842]);
  page.drawImage(img, { x: 0, y: 0, width: 595, height: 842 });
  return Buffer.from(await doc.save());
}

export async function render(cv: Cv, i: number) {
  if (cv.format === "docx") return renderDocx(cv, i);
  if (cv.format === "scan") return renderScan(cv, i);
  return renderPdf(cv, i);
}

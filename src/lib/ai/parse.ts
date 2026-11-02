import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

export type Extracted = { text: string; pages: number; lowText: boolean };

export function sniffMime(buf: Buffer): "pdf" | "docx" | null {
  if (buf.length > 4 && buf.subarray(0, 4).toString("latin1") === "%PDF") return "pdf";
  if (buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return "docx";
  return null;
}

/** Normalise unicode, drop page numbers and repeated headers/footers, keep bullets. */
export function cleanText(raw: string) {
  const lines = raw
    .normalize("NFKC")
    .replace(/[​-‍﻿]/g, "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim());
  const counts = new Map<string, number>();
  for (const l of lines) if (l) counts.set(l, (counts.get(l) ?? 0) + 1);
  const out = lines.filter((l) => {
    if (/^(page\s*)?\d+\s*(of|\/)\s*\d+$/i.test(l)) return false;
    if (/^\d{1,2}$/.test(l)) return false;
    if (l.length < 60 && (counts.get(l) ?? 0) >= 3) return false;
    return true;
  });
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function extractFromBuffer(buf: Buffer, kind: "pdf" | "docx"): Promise<Extracted> {
  if (kind === "docx") {
    const { value } = await mammoth.extractRawText({ buffer: buf });
    const text = cleanText(value);
    return { text, pages: 1, lowText: text.length < 120 };
  }
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  const merged = Array.isArray(text) ? text.join("\n") : text;
  const cleaned = cleanText(merged);
  return { text: cleaned, pages: totalPages, lowText: cleaned.length < 120 * Math.max(1, totalPages) };
}

const NAME_LINE = /^[A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+){1,3}$/;

/** Contact details are read from the raw text only to populate the Candidate record. */
export function extractContact(text: string) {
  const email = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0] ?? "";
  const phone = text.match(/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/)?.[0] ?? "";
  const name =
    text
      .split("\n")
      .slice(0, 8)
      .map((l) => l.trim())
      .find((l) => NAME_LINE.test(l) && !/curriculum|resume|vitae/i.test(l)) ?? "";
  return { name, email, phone };
}

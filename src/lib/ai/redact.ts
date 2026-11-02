const PROTECTED_LINE =
  /\b(date of birth|d\.?o\.?b\.?|age|gender|sex|marital status|married|unmarried|single|religion|caste|nationality|passport|photo|father'?s name|mother'?s name|husband|wife)\b\s*[:\-–]?/i;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const URL_RE = /\b(?:https?:\/\/|www\.|linkedin\.com|github\.com)[^\s,;)]*/gi;
const PHONE = /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3,5}\)?[\s-]?)?\d{3,5}[\s-]?\d{4,5}\b/g;
const ADDRESS_LINE = /\b(address|permanent address|residential address|house no|flat no|pin\s*code|pincode)\b/i;

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function nameVariants(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter((p) => p.length > 1);
  return Array.from(new Set([fullName.trim(), ...parts]));
}

/**
 * Remove protected attributes and contact details before any scoring prompt.
 * City/region survive because the location criterion needs them; full addresses do not.
 */
export function redact(text: string, candidateName: string) {
  const lines = text.split(/\r?\n/).filter((l) => !PROTECTED_LINE.test(l) && !ADDRESS_LINE.test(l));
  let out = lines.join("\n");
  out = out.replace(EMAIL, "[EMAIL]").replace(URL_RE, "[LINK]");
  out = out.replace(PHONE, (m) => (m.replace(/\D/g, "").length >= 8 ? "[PHONE]" : m));
  for (const v of nameVariants(candidateName)) {
    out = out.replace(new RegExp(`\\b${escapeRe(v)}\\b`, "gi"), "[CANDIDATE]");
  }
  return out
    .replace(/[​-‍﻿\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Rule-based extraction. Used when AI_MOCK=1 or no API key, and as the manual-entry fallback for the JD.
 * It only ever quotes lines that exist in the text, so grounding still holds. It is labelled
 * "heuristic" in AiRun and is never presented as model output.
 */
import type { CvExtraction, JdExtraction } from "./schema";

export const KNOWN_SKILLS = [
  "Java", "Spring Boot", "Microservices", "Hibernate", "REST APIs", "Kafka", "Docker", "Kubernetes", "AWS",
  "KYC", "AML", "Excel", "Compliance", "Transaction Monitoring",
  "React", "TypeScript", "JavaScript", "Next.js", "Node.js", "Redux", "HTML", "CSS",
  "Python", "SQL", "Airflow", "Spark", "PostgreSQL", "ETL", "Data Modeling",
  "Selenium", "Playwright", "API Testing", "Cypress", "Postman", "JIRA", "Test Automation",
];

const CITIES = [
  "Noida", "Gurgaon", "Gurugram", "Delhi", "Bengaluru", "Bangalore", "Pune", "Mumbai", "Hyderabad", "Chennai", "Remote",
];

/** Prefer a real experience bullet over a header, "Key: value" line or a bare skills list. */
export function lineContaining(text: string, terms: string[]) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const hits: { line: string; rank: number }[] = [];
  for (const t of terms) {
    const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, "i");
    for (const l of lines) {
      if (!re.test(l)) continue;
      const bullet = /^[-•*]\s/.test(l);
      const keyValue = /^[A-Za-z ]{3,24}:\s/.test(l);
      const list = (l.match(/,/g) ?? []).length >= 3 && !bullet;
      hits.push({ line: l.replace(/^[-•*]\s+/, ""), rank: bullet ? 0 : list ? 2 : keyValue ? 3 : 1 });
    }
  }
  hits.sort((a, b) => a.rank - b.rank);
  const best = hits[0]?.line;
  return best ? (best.length > 220 ? best.slice(0, 220) : best) : null;
}

export const skillTerms = (label: string) => {
  const l = label.toLowerCase();
  const extra: Record<string, string[]> = {
    "spring boot": ["springboot", "spring-boot"],
    microservices: ["microservice", "micro-services"],
    "rest apis": ["rest api", "restful", "rest"],
    aml: ["anti-money laundering", "anti money laundering"],
    kyc: ["know your customer"],
    "next.js": ["nextjs"],
    "api testing": ["api test", "rest assured", "postman"],
  };
  return [label, ...(extra[l] ?? [])];
};

function quoteOf(text: string, re: RegExp) {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const line = lines.find((l) => re.test(l));
  return line && line.length >= 12 ? line : null;
}

export function heuristicCv(text: string, criteria: { label: string; type: string }[]): CvExtraction {
  const years = [...text.matchAll(/(\d+(?:\.\d+)?)\s*\+?\s*(?:years|yrs)/gi)].map((m) => Number(m[1]));
  const notice = text.match(/notice(?:\s*period)?\s*[:\-–]?\s*(?:up to\s*)?(\d+)\s*days/i);
  const immediate = /immediate(?:ly)? (?:joiner|available)|notice[^\n]*immediate/i.test(text);
  const ctc = text.match(/expected\s*ctc\s*[:\-–]?\s*(?:₹|inr|rs\.?)?\s*(\d+(?:\.\d+)?)/i);
  const loc = text.match(/location\s*[:\-–]\s*([A-Za-z ]+)/i) ?? text.match(new RegExp(`\\b(${CITIES.join("|")})\\b`, "i"));
  const role = text.match(/(?:current role|designation)\s*[:\-–]\s*(.+)/i);
  const company = text.match(/(?:current company|employer)\s*[:\-–]\s*(.+)/i);

  const skills = KNOWN_SKILLS.filter((s) => lineContaining(text, skillTerms(s)));
  const yearsExperience = years.length ? Math.max(...years) : null;

  const items = criteria
    .filter((c) => c.type === "SKILL" || c.type === "CUSTOM")
    .map((c) => {
      const quote = lineContaining(text, skillTerms(c.label));
      return {
        label: c.label,
        found: !!quote && quote.length >= 12,
        related: false,
        score: undefined as number | undefined,
        quote: quote && quote.length >= 12 ? quote : null,
        confidence: quote ? 0.85 : 0.4,
      };
    });

  const strengths = items.filter((i) => i.found).slice(0, 3).map((i) => `${i.label} mentioned in the CV`);
  const gaps = items.filter((i) => !i.found).slice(0, 3).map((i) => `No mention of ${i.label}`);

  return {
    currentRole: role?.[1]?.trim() ?? null,
    currentCompany: company?.[1]?.trim() ?? null,
    yearsExperience,
    noticeDays: notice ? Number(notice[1]) : immediate ? 0 : null,
    expectedCtcLpa: ctc ? Number(ctc[1]) : null,
    location: loc ? (loc[1] ?? loc[0]).trim() : null,
    skills,
    summary: `${yearsExperience != null ? `${yearsExperience} years of experience stated. ` : ""}${
      skills.length ? `Skills mentioned: ${skills.slice(0, 6).join(", ")}.` : "No listed skills were detected."
    }`,
    experienceEvidence: { quote: quoteOf(text, /(\d+(?:\.\d+)?)\s*\+?\s*(?:years|yrs)/i), confidence: years.length ? 0.8 : 0.3 },
    noticeEvidence: { quote: quoteOf(text, /notice/i), confidence: notice || immediate ? 0.85 : 0.3 },
    locationEvidence: { quote: quoteOf(text, /location|\b(?:noida|gurgaon|bengaluru|bangalore|pune|delhi|remote)\b/i), confidence: loc ? 0.8 : 0.3 },
    ctcEvidence: { quote: quoteOf(text, /ctc/i), confidence: ctc ? 0.85 : 0.3 },
    criteria: items,
    strengths,
    gaps,
  };
}

export function heuristicJd(jd: string): JdExtraction {
  const first = jd.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
  const titleMatch = first.match(/^([^,:\n]{3,60}?)(?:,|:|\s+-\s|$)/);
  const range = jd.match(/(\d+)\s*(?:-|–|to)\s*(\d+)\s*(?:\+\s*)?(?:years|yrs)/i);
  const single = jd.match(/(\d+)\s*\+?\s*(?:years|yrs)/i);
  const notice = jd.match(/notice[^\d]{0,30}(\d+)\s*days/i);
  const ctc = jd.match(/(?:ctc|budget|salary)[^\d]{0,20}(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?)/i);
  const city = CITIES.find((c) => new RegExp(`\\b${c}\\b`, "i").test(jd));
  const found = KNOWN_SKILLS.filter((s) => lineContaining(jd, skillTerms(s)));
  const niceLine = jd.split(/\r?\n/).find((l) => /nice to have|good to have|preferred|bonus/i.test(l)) ?? "";
  const nice = found.filter((s) => new RegExp(s.replace(/[.+]/g, "\\$&"), "i").test(niceLine));
  const must = found.filter((s) => !nice.includes(s));
  const minExp = range ? Number(range[1]) : single ? Number(single[1]) : 0;
  return {
    title: titleMatch?.[1]?.trim() || "Untitled role",
    location: city ?? "",
    minExpYears: minExp,
    maxExpYears: range ? Number(range[2]) : minExp + 3,
    noticeMaxDays: notice ? Number(notice[1]) : 60,
    ctcMaxLpa: ctc ? Number(ctc[1]) : null,
    mustHaveSkills: must.slice(0, 8),
    niceToHaveSkills: nice.slice(0, 6),
  };
}

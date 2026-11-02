import { round } from "../utils";

export type CriterionType = "SKILL" | "EXPERIENCE" | "NOTICE" | "LOCATION" | "CTC" | "CUSTOM";

export type Reqmt = {
  minExp: number;
  maxExp: number;
  noticeMax: number;
  ctcMax: number | null;
  location: string;
};

export type Profile = {
  yearsExperience: number | null;
  noticeDays: number | null;
  expectedCtcLpa: number | null;
  location: string | null;
  willingToRelocate?: boolean;
};

/** Skill synonyms; each group is treated as equivalent. */
const SYNONYMS: string[][] = [
  ["spring boot", "springboot", "spring-boot"],
  ["microservices", "micro services", "micro-services", "microservice"],
  ["rest apis", "rest api", "restful apis", "restful services", "rest"],
  ["javascript", "js", "ecmascript"],
  ["typescript", "ts"],
  ["react", "reactjs", "react.js"],
  ["next.js", "nextjs", "next js"],
  ["kyc", "know your customer"],
  ["aml", "aml checks", "anti money laundering", "anti-money laundering"],
  ["airflow", "apache airflow"],
  ["postgresql", "postgres"],
  ["playwright", "playwright test"],
  ["selenium", "selenium webdriver"],
];

const RELATED: Record<string, string[]> = {
  java: ["kotlin", "scala", "j2ee"],
  "spring boot": ["spring", "spring mvc", "jakarta ee"],
  microservices: ["distributed systems", "service oriented", "soa"],
  react: ["angular", "vue"],
  typescript: ["javascript"],
  kyc: ["customer due diligence", "cdd", "onboarding"],
  aml: ["compliance", "transaction monitoring"],
  airflow: ["luigi", "prefect", "dagster"],
  sql: ["mysql", "postgresql", "oracle"],
  selenium: ["cypress", "webdriver"],
  playwright: ["cypress", "puppeteer"],
};

function canon(s: string) {
  const t = s.toLowerCase().trim();
  for (const g of SYNONYMS) if (g.includes(t)) return g[0];
  return t;
}

export function skillMatch(skill: string, candidateSkills: string[]): 0 | 50 | 100 {
  const want = canon(skill);
  const have = candidateSkills.map(canon);
  if (have.includes(want)) return 100;
  const related = RELATED[want] ?? [];
  if (have.some((h) => related.includes(h))) return 50;
  return 0;
}

export function scoreExperience(years: number, min: number, max: number) {
  if (min <= 0) return 100;
  if (years >= min) return round(Math.min(100, 70 + (30 * (years - min)) / Math.max(1, max - min)));
  return round(Math.max(0, (years / min) * 60));
}

export function scoreNotice(days: number, max: number) {
  return days <= max ? 100 : round(Math.max(0, 100 - (days - max) * 2));
}

export function scoreLocation(candidate: string | null, wanted: string, relocate = false) {
  if (!candidate) return 30;
  const a = candidate.toLowerCase();
  const b = wanted.toLowerCase();
  if (b === "remote" || b === "") return 100;
  if (a.includes(b) || b.includes(a)) return 100;
  const ncr = ["noida", "gurgaon", "gurugram", "delhi", "new delhi", "ghaziabad", "faridabad", "greater noida"];
  if (ncr.includes(a) && ncr.includes(b)) return 70;
  if (a.includes("remote") || relocate) return 70;
  return 30;
}

export function scoreCtc(expected: number, max: number | null) {
  if (max == null || expected <= max) return 100;
  return round(Math.max(0, 100 - ((expected - max) / max) * 100));
}

export function bandFor(score: number): "Strong" | "Good" | "Partial" | "Weak" {
  if (score >= 85) return "Strong";
  if (score >= 65) return "Good";
  if (score >= 40) return "Partial";
  return "Weak";
}

export function overall(items: { weight: number; score: number }[]) {
  const w = items.reduce((a, i) => a + i.weight, 0);
  if (w === 0) return 0;
  return round(items.reduce((a, i) => a + i.weight * i.score, 0) / w);
}

export function overallConfidence(items: { weight: number; confidence: number }[]) {
  const w = items.reduce((a, i) => a + i.weight, 0);
  if (w === 0) return 0;
  return Math.round((items.reduce((a, i) => a + i.weight * i.confidence, 0) / w) * 100) / 100;
}

/** Default weights for a skills-heavy JD: skills 60 split equally, exp 20, notice 10, location 5, CTC 5. */
export function defaultWeights(skillCount: number) {
  const each = skillCount > 0 ? Math.floor(60 / skillCount) : 0;
  const remainder = skillCount > 0 ? 60 - each * skillCount : 0;
  return { skill: each, firstSkillExtra: remainder, experience: 20, notice: 10, location: 5, ctc: 5 };
}

export function normaliseWeights<T extends { weight: number }>(items: T[]): T[] {
  const total = items.reduce((a, i) => a + i.weight, 0);
  if (total === 0) return items;
  const scaled = items.map((i) => ({ ...i, weight: Math.round((i.weight / total) * 100) }));
  const diff = 100 - scaled.reduce((a, i) => a + i.weight, 0);
  if (diff !== 0) {
    const idx = scaled.reduce((m, it, i, arr) => (it.weight > arr[m].weight ? i : m), 0);
    scaled[idx] = { ...scaled[idx], weight: scaled[idx].weight + diff };
  }
  return scaled;
}

/** Deterministic score for the non-LLM criteria. Returns null for SKILL/CUSTOM (need evidence). */
export function scoreStructured(type: CriterionType, p: Profile, r: Reqmt): number | null {
  switch (type) {
    case "EXPERIENCE":
      return p.yearsExperience == null ? 0 : scoreExperience(p.yearsExperience, r.minExp, r.maxExp);
    case "NOTICE":
      return p.noticeDays == null ? 50 : scoreNotice(p.noticeDays, r.noticeMax);
    case "LOCATION":
      return scoreLocation(p.location, r.location, p.willingToRelocate);
    case "CTC":
      return p.expectedCtcLpa == null ? 100 : scoreCtc(p.expectedCtcLpa, r.ctcMax);
    default:
      return null;
  }
}

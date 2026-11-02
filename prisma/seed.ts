import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

type C = { label: string; type: "SKILL" | "EXPERIENCE" | "NOTICE" | "LOCATION" | "CTC"; weight: number; mustHave: boolean };

function criteria(skills: string[], nice: string[], exp: [number, number], notice: number, loc: string, ctc: number): C[] {
  const each = Math.floor(60 / skills.length);
  const rem = 60 - each * skills.length;
  return [
    ...skills.map((s, i) => ({ label: s, type: "SKILL" as const, weight: each + (i === 0 ? rem : 0), mustHave: true })),
    { label: `Experience ${exp[0]}–${exp[1]} years`, type: "EXPERIENCE", weight: 20, mustHave: true },
    { label: `Notice up to ${notice} days`, type: "NOTICE", weight: 10, mustHave: false },
    { label: `Location ${loc}`, type: "LOCATION", weight: 5, mustHave: false },
    { label: `CTC up to ${ctc} LPA`, type: "CTC", weight: 5, mustHave: false },
    ...nice.map((s) => ({ label: s, type: "SKILL" as const, weight: 0, mustHave: false })),
  ];
}

async function main() {
  const password = process.env.SEED_DEMO_PASSWORD || "Demo1234!";
  const hash = await bcrypt.hash(password, 10);

  const names = [
    ["Ashford Bank", "ashfordbank.example"],
    ["Vela Retail", "velaretail.example"],
    ["Orbit IT Services", "orbitit.example"],
  ];
  const clients: Record<string, string> = {};
  for (const [name, domain] of names) {
    const existing = await db.client.findFirst({ where: { name } });
    const c = existing ?? (await db.client.create({ data: { name, domain } }));
    clients[name] = c.id;
  }

  const users = [
    { email: "recruiter@meridian.example", name: "Priya Kapoor", role: "RECRUITER" as const },
    { email: "lead@meridian.example", name: "Rahul Mehta", role: "RECRUITER" as const },
    { email: "hiring@ashfordbank.example", name: "Neha Arora", role: "CLIENT" as const, client: "Ashford Bank" },
    { email: "hiring@velaretail.example", name: "Karan Shah", role: "CLIENT" as const, client: "Vela Retail" },
    { email: "hiring@orbitit.example", name: "Meera Iyer", role: "CLIENT" as const, client: "Orbit IT Services" },
  ];
  for (const u of users) {
    await db.user.upsert({
      where: { email: u.email },
      update: { passwordHash: hash },
      create: { email: u.email, name: u.name, role: u.role, passwordHash: hash, clientId: (u as { client?: string }).client ? clients[(u as { client: string }).client] : null },
    });
  }
  const owner = await db.user.findUniqueOrThrow({ where: { email: "recruiter@meridian.example" } });

  const reqs = [
    { title: "Senior Java Developer", client: "Ashford Bank", location: "Noida", exp: [5, 8] as [number, number], notice: 60, ctc: 28,
      must: ["Java", "Spring Boot", "Microservices"], nice: ["Hibernate", "REST APIs"] },
    { title: "KYC Analyst", client: "Ashford Bank", location: "Noida", exp: [2, 4] as [number, number], notice: 30, ctc: 8,
      must: ["KYC", "AML", "Excel"], nice: [] },
    { title: "React Developer", client: "Orbit IT Services", location: "Remote", exp: [3, 5] as [number, number], notice: 45, ctc: 18,
      must: ["React", "TypeScript", "Next.js"], nice: [] },
    { title: "Data Engineer", client: "Vela Retail", location: "Bengaluru", exp: [4, 6] as [number, number], notice: 60, ctc: 22,
      must: ["Python", "SQL", "Airflow"], nice: [] },
    { title: "QA Engineer", client: "Orbit IT Services", location: "Pune", exp: [2, 4] as [number, number], notice: 30, ctc: 10,
      must: ["Selenium", "Playwright", "API Testing"], nice: [] },
  ];
  for (const r of reqs) {
    const exists = await db.requisition.findFirst({ where: { title: r.title, clientId: clients[r.client] } });
    if (exists) continue;
    await db.requisition.create({
      data: {
        clientId: clients[r.client],
        createdById: owner.id,
        title: r.title,
        jdText: `${r.title}, ${r.exp[0]}-${r.exp[1]} years, ${r.must.join(", ")}, ${r.location}, notice up to ${r.notice} days`,
        location: r.location,
        minExpYears: r.exp[0],
        maxExpYears: r.exp[1],
        noticeMaxDays: r.notice,
        ctcMaxLpa: r.ctc,
        criteria: {
          create: criteria(r.must, r.nice, r.exp, r.notice, r.location, r.ctc).map((c, i) => ({ ...c, order: i })),
        },
      },
    });
  }
  console.log("Seeded users, clients and 5 requisitions.");
}

main().finally(() => db.$disconnect());

# Demo script (about 8 minutes)

Setup: `npm run seed:demo -- --reset`, then `npm run start`. Use two browser windows, one normal and one at 390 px wide (or a phone).

1. **Login.** Open `/login`. Click the Recruiter chip, sign in. Point out: no default shadcn look, serif title, one green accent.
2. **Requisitions.** The impact strip shows time saved, 48-hour share, client acceptance and CVs processed. Hover a tile to show the formula. These numbers come from seeded timestamps and are not real-world results.
3. **New requisition.** Click New requisition, "Use sample JD", "Extract scorecard". Edit a weight, watch the total turn amber, click Normalise. Choose Ashford Bank. Click Extract again to show the confirmation that protects edits. (Without a Groq key this runs the rule-based extractor and says so.)
4. **Upload.** Save, then on Upload tick the consent box. Click "Try 3 sample CVs". Watch the queue move through Uploading, Parsing, Ready. Mention that processing runs while the page is open.
5. **Ranked list.** Open the Senior Java Developer requisition. Each row shows a score, must-haves met, notice, and one quoted line. Open a candidate. On Scorecard, show that each score has the line that earned it. Point at a Needs review candidate and its reason.
6. **The gate.** In the drawer, Submit is disabled with an explanation. Open the Resume tab, and Submit becomes enabled. Say that the server enforces this too.
7. **Fairness.** Mention that the name, gender, age and marital status in the CV are removed before scoring, and that the prompt-injection CV scores low.
8. **Client on a phone.** In the narrow window sign in as the Ashford client. Show masked contact, evidence highlights, View CV (view-only). Shortlist one, Propose slot for another, Reject a third with a reason.
9. **Pipeline.** Back as recruiter open Pipeline: the client's decisions appear on the cards. Drag a card, or use the Move select.
10. **DPDP.** In a drawer open Consent, withdraw with a note, and show the candidate disappear from the default list. Open Request deletion, record it, delete, and show the anonymised result. Open Requisitions, Fairness and audit, and show the access log.

Say plainly at the end: live AI scoring is unverified, scans are not OCR'd, and nothing is deployed yet.

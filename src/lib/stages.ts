export const STAGES = ["SOURCED", "SCREENED", "SHORTLISTED", "SUBMITTED", "CLIENT_REVIEW", "INTERVIEW", "OFFERED", "JOINED"] as const;
export type PipelineStage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<string, string> = {
  SOURCED: "Sourced", SCREENED: "Screened", SHORTLISTED: "Shortlisted", SUBMITTED: "Submitted", CLIENT_REVIEW: "Client review",
  INTERVIEW: "Interview", OFFERED: "Offered", JOINED: "Joined", REJECTED: "Rejected",
};

export const REJECT_REASONS = [
  "Skills mismatch", "Experience below requirement", "Notice period too long", "CTC above budget", "Location mismatch", "Other",
] as const;

/** Stages a recruiter may move to by hand. Submitting goes through /submit so the viewedAt gate always applies. */
export function canMoveManually(to: string) {
  return to !== "SUBMITTED" && to !== "REJECTED";
}

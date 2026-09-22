// Talent Bench fields (candidates.employment_status/notice_period) — same
// shared-plain-module shape as source-platforms.ts: a "use server" file
// can only export async functions, so these const arrays/label maps live
// here instead of alongside the Server Actions that also validate against
// them, and are imported by both.

export const EMPLOYMENT_STATUSES = [
  "employed",
  "open_to_opportunities",
  "immediately_available",
  "freelance_contract",
] as const;

export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  employed: "Employed",
  open_to_opportunities: "Open to opportunities",
  immediately_available: "Immediately available",
  freelance_contract: "Freelance / contract",
};

export const NOTICE_PERIODS = [
  "immediate",
  "2_weeks",
  "1_month",
  "2_plus_months",
] as const;

export type NoticePeriod = (typeof NOTICE_PERIODS)[number];

export const NOTICE_PERIOD_LABELS: Record<NoticePeriod, string> = {
  immediate: "Immediate",
  "2_weeks": "2 weeks",
  "1_month": "1 month",
  "2_plus_months": "2+ months",
};

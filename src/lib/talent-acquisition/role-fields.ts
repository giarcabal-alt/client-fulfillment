// Job Openings expansion: label maps for roles' new enum-ish fields, same
// shared-plain-module shape as employment-fields.ts/source-platforms.ts —
// a "use server" file can only export async functions, so these live
// here instead of alongside the Server Actions that also validate
// against them, imported by both the create form and the role detail
// page's edit controls.

export const PAYMENT_TERMS = [
  "full_time_salary",
  "hourly",
  "project_based",
  "monthly_retainer",
] as const;

export type PaymentTerms = (typeof PAYMENT_TERMS)[number];

export const PAYMENT_TERMS_LABELS: Record<PaymentTerms, string> = {
  full_time_salary: "Full-time salary",
  hourly: "Hourly",
  project_based: "Project-based",
  monthly_retainer: "Monthly retainer",
};

export const SENIORITY_LEVELS = ["entry", "mid", "senior", "lead"] as const;

export type SeniorityLevel = (typeof SENIORITY_LEVELS)[number];

export const SENIORITY_LEVEL_LABELS: Record<SeniorityLevel, string> = {
  entry: "Entry",
  mid: "Mid",
  senior: "Senior",
  lead: "Lead",
};

export const WORK_ARRANGEMENTS = ["fully_remote", "hybrid", "onsite"] as const;

export type WorkArrangement = (typeof WORK_ARRANGEMENTS)[number];

export const WORK_ARRANGEMENT_LABELS: Record<WorkArrangement, string> = {
  fully_remote: "Fully remote",
  hybrid: "Hybrid",
  onsite: "Onsite",
};

export const ROLE_PRIORITIES = ["standard", "urgent", "on_hold"] as const;

export type RolePriority = (typeof ROLE_PRIORITIES)[number];

export const ROLE_PRIORITY_LABELS: Record<RolePriority, string> = {
  standard: "Standard",
  urgent: "Urgent",
  on_hold: "On hold",
};

// Same "none"/"create new" sentinel pattern as role-classifications.ts's
// NO_CLASSIFICATION_VALUE and new-candidate-form.tsx's NO_ROLE_VALUE/
// NEW_ROLE_VALUE — a real client_id is always a uuid, so these plain
// words can never collide with one.
export const NO_CLIENT_VALUE = "none";
export const NEW_CLIENT_VALUE = "new";

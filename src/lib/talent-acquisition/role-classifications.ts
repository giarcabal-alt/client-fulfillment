// Shared between role-row.tsx and new-role-form.tsx, which previously each
// hand-copied the same label map and "none" sentinel — a future label
// change in one would have silently drifted the other. Mirrors
// source-platforms.ts's reasoning for candidates.
export const NO_CLASSIFICATION_VALUE = "none";

export const CLASSIFICATION_LABELS: Record<string, string> = {
  embedded_operator: "Embedded Operator",
  project_based: "Project-Based",
};

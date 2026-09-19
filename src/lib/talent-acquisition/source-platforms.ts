// Shared between candidates-actions.ts (a "use server" file, which can only
// export async functions — a const array export there gets silently
// stripped from the client bundle, not a build-time error) and the client
// components that render the source-platform dropdown.
export const SOURCE_PLATFORMS = [
  "JobStreet",
  "Kalibrr",
  "OnlineJobs.ph",
  "LinkedIn",
  "Bossjob",
  "Referral",
  "Other",
] as const;

export type SourcePlatform = (typeof SOURCE_PLATFORMS)[number];

// Task: clients page timezone becomes a dropdown of IANA zone strings
// (so daylight saving is handled automatically, unlike a stored offset),
// grouped by region with readable labels. `clients.timezone` already
// stored a raw string before this — these are the only values the
// dropdown offers going forward, but an existing value that isn't in
// this list (typo, freeform text from before this change) isn't
// destroyed: the dropdown just falls back to "Not set" for anything
// unrecognized (see NO_TIMEZONE_VALUE / timezoneLabel below), same as
// any other optional field with no value.

export type TimezoneGroup = {
  region: string;
  zones: { value: string; label: string }[];
};

export const TIMEZONE_GROUPS: TimezoneGroup[] = [
  {
    region: "United States",
    zones: [
      { value: "America/New_York", label: "America/New_York (Eastern)" },
      { value: "America/Chicago", label: "America/Chicago (Central)" },
      { value: "America/Denver", label: "America/Denver (Mountain)" },
      { value: "America/Phoenix", label: "America/Phoenix (Arizona)" },
      { value: "America/Los_Angeles", label: "America/Los_Angeles (Pacific)" },
      { value: "America/Anchorage", label: "America/Anchorage (Alaska)" },
      { value: "Pacific/Honolulu", label: "Pacific/Honolulu (Hawaii)" },
    ],
  },
  {
    region: "Canada",
    zones: [
      { value: "America/St_Johns", label: "America/St_Johns (Newfoundland)" },
      { value: "America/Halifax", label: "America/Halifax (Atlantic)" },
      { value: "America/Toronto", label: "America/Toronto (Eastern)" },
      { value: "America/Winnipeg", label: "America/Winnipeg (Central)" },
      { value: "America/Edmonton", label: "America/Edmonton (Mountain)" },
      { value: "America/Vancouver", label: "America/Vancouver (Pacific)" },
    ],
  },
  {
    region: "UK & Ireland",
    zones: [
      { value: "Europe/London", label: "Europe/London" },
      { value: "Europe/Dublin", label: "Europe/Dublin" },
    ],
  },
  {
    region: "Europe",
    zones: [
      { value: "Europe/Lisbon", label: "Europe/Lisbon" },
      { value: "Europe/Madrid", label: "Europe/Madrid" },
      { value: "Europe/Paris", label: "Europe/Paris" },
      { value: "Europe/Amsterdam", label: "Europe/Amsterdam" },
      { value: "Europe/Berlin", label: "Europe/Berlin" },
      { value: "Europe/Rome", label: "Europe/Rome" },
      { value: "Europe/Stockholm", label: "Europe/Stockholm" },
      { value: "Europe/Warsaw", label: "Europe/Warsaw" },
      { value: "Europe/Helsinki", label: "Europe/Helsinki" },
      { value: "Europe/Athens", label: "Europe/Athens" },
    ],
  },
  {
    region: "Australia",
    zones: [
      { value: "Australia/Perth", label: "Australia/Perth" },
      { value: "Australia/Adelaide", label: "Australia/Adelaide" },
      { value: "Australia/Brisbane", label: "Australia/Brisbane" },
      { value: "Australia/Sydney", label: "Australia/Sydney" },
      { value: "Australia/Melbourne", label: "Australia/Melbourne" },
    ],
  },
  {
    region: "New Zealand",
    zones: [{ value: "Pacific/Auckland", label: "Pacific/Auckland" }],
  },
  {
    region: "Asia & Middle East",
    zones: [
      { value: "Asia/Dubai", label: "Asia/Dubai" },
      { value: "Asia/Singapore", label: "Asia/Singapore" },
      { value: "Asia/Hong_Kong", label: "Asia/Hong_Kong" },
      { value: "Asia/Tokyo", label: "Asia/Tokyo" },
      { value: "Asia/Manila", label: "Asia/Manila" },
    ],
  },
];

export const NO_TIMEZONE_VALUE = "none";

const TIMEZONE_LABEL_BY_VALUE = new Map(
  TIMEZONE_GROUPS.flatMap((g) => g.zones).map((z) => [z.value, z.label])
);

/** Dropdown-select value for a stored timezone string: the string itself
 * if it's one of the listed IANA zones, otherwise the "unset" sentinel —
 * an old free-text value that doesn't match anything on the list reads
 * as "Not set" rather than crashing the Select. */
export function timezoneSelectValue(stored: string | null): string {
  if (stored && TIMEZONE_LABEL_BY_VALUE.has(stored)) return stored;
  return NO_TIMEZONE_VALUE;
}

export function timezoneLabel(stored: string | null): string {
  if (!stored) return "Not set";
  return TIMEZONE_LABEL_BY_VALUE.get(stored) ?? "Not set";
}

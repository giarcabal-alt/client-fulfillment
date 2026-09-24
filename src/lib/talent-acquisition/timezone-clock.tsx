"use client";

// Shared PH<->client live clock — used by both the clients list/detail
// pages and the role detail page (client field lives on `clients`, but a
// role's client relationship needs the exact same display, so this is a
// small standalone component rather than something baked into either
// page). Computed from the stored IANA timezone string (e.g.
// "America/New_York"), not a stored UTC offset — an offset drifts with
// DST twice a year, the zone name doesn't, per the task's own reasoning
// for choosing that column type.

import { useEffect, useState } from "react";

const PH_TIMEZONE = "Asia/Manila";

function formatClock(date: Date, timeZone: string, withZoneAbbrev: boolean): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...(withZoneAbbrev ? { timeZoneName: "short" as const } : {}),
  }).format(date);
}

// Same calendar day or not, relative to PH — a US client's "morning" can
// land on PH's "tomorrow" or "yesterday" depending on the hour, which a
// bare time-of-day reading alone would make genuinely ambiguous.
function dayOffsetLabel(now: Date, timeZone: string): string | null {
  const dayNumber = (tz: string) =>
    Number(
      new Intl.DateTimeFormat("en-US", { timeZone: tz, day: "numeric" }).format(now)
    );
  const phDay = dayNumber(PH_TIMEZONE);
  const clientDay = dayNumber(timeZone);
  if (phDay === clientDay) return null;
  // A same-month rollover is the overwhelmingly common case for this
  // app's real use (PH staff working with US/EU clients); a month-
  // boundary edge case just shows no label rather than a wrong one built
  // on an assumption that doesn't hold near the end of the month.
  const diff = clientDay - phDay;
  if (diff === 1 || diff === -1) {
    return diff === 1 ? "+1 day" : "-1 day";
  }
  return null;
}

export function TimezoneClock({
  timezone,
  clientLabel = "Client",
}: {
  timezone: string | null;
  clientLabel?: string;
}) {
  // Rendered on the server with `now: null` and filled in only after
  // mount — computing `new Date()` during the server render would embed
  // a stale time in the HTML that immediately mismatches the client's
  // actual clock on hydration. The state update happens inside the
  // interval's own callback, not synchronously in the effect body
  // (react-hooks/set-state-in-effect) — the tradeoff is up to a 1s delay
  // before the very first real time appears, in exchange for never
  // calling setState directly inside the effect.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!timezone) {
    return <span className="text-xs text-muted-foreground">No timezone set</span>;
  }

  let phTime = "--:--";
  let clientTime = "--:--";
  let offsetLabel: string | null = null;
  if (now) {
    try {
      phTime = formatClock(now, PH_TIMEZONE, false);
      clientTime = formatClock(now, timezone, true);
      offsetLabel = dayOffsetLabel(now, timezone);
    } catch {
      return <span className="text-xs text-destructive">Invalid timezone</span>;
    }
  }

  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2 text-xs tabular-nums text-muted-foreground">
      <span>PH {phTime}</span>
      <span aria-hidden="true">·</span>
      <span>
        {clientLabel} {clientTime}
        {offsetLabel && <span className="ml-1 text-[11px]">({offsetLabel})</span>}
      </span>
    </span>
  );
}

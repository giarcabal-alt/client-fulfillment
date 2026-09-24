"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  NO_TIMEZONE_VALUE,
  TIMEZONE_GROUPS,
  timezoneLabel,
} from "@/lib/talent-acquisition/client-timezones";

// Grouped IANA-zone dropdown shared by the new-client form and the edit
// dialog — a plain free-text timezone field can't handle daylight saving
// and let people type anything TimezoneClock then has to guess at, so
// every client's timezone is now one of a fixed, known-good list.
export function TimezoneSelect({
  value,
  onValueChange,
  disabled,
  triggerClassName,
  triggerId,
}: {
  value: string;
  onValueChange: (next: string | null) => void;
  disabled?: boolean;
  triggerClassName?: string;
  triggerId?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={triggerId} aria-label="Timezone" className={triggerClassName}>
        <SelectValue>{(v: string) => timezoneLabel(v === NO_TIMEZONE_VALUE ? null : v)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_TIMEZONE_VALUE}>Not set</SelectItem>
        {TIMEZONE_GROUPS.map((group) => (
          <SelectGroup key={group.region}>
            <SelectLabel>{group.region}</SelectLabel>
            {group.zones.map((zone) => (
              <SelectItem key={zone.value} value={zone.value}>
                {zone.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

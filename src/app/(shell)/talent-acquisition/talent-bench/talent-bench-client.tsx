"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CandidateStage } from "@/lib/talent-acquisition/cadence";
import {
  EMPLOYMENT_STATUS_LABELS,
  EMPLOYMENT_STATUSES,
  NOTICE_PERIOD_LABELS,
  NOTICE_PERIODS,
} from "@/lib/talent-acquisition/employment-fields";
import { SOURCE_PLATFORMS } from "@/lib/talent-acquisition/source-platforms";
import { TalentBenchCard } from "./talent-bench-card";

export type BenchCandidate = {
  id: string;
  name: string;
  stage: CandidateStage;
  status: "active" | "rejected";
  lastRole: string | null;
  lastCompany: string | null;
  yearsExperience: number | null;
  employmentStatus: string | null;
  noticePeriod: string | null;
  sourcePlatform: string | null;
  communicationRating: number | null;
  tags: string | null;
  skills: string[];
};

const ANY_VALUE = "any";

export function TalentBenchClient({
  candidates,
}: {
  candidates: BenchCandidate[];
}) {
  const [search, setSearch] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState(ANY_VALUE);
  const [noticePeriod, setNoticePeriod] = useState(ANY_VALUE);
  const [sourcePlatform, setSourcePlatform] = useState(ANY_VALUE);
  const [minYears, setMinYears] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const minYearsNum = minYears.trim() === "" ? null : Number(minYears);

    return candidates.filter((c) => {
      if (query) {
        const haystack = [c.name, c.tags ?? "", ...c.skills].join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (employmentStatus !== ANY_VALUE && c.employmentStatus !== employmentStatus) {
        return false;
      }
      if (noticePeriod !== ANY_VALUE && c.noticePeriod !== noticePeriod) {
        return false;
      }
      if (sourcePlatform !== ANY_VALUE && c.sourcePlatform !== sourcePlatform) {
        return false;
      }
      if (
        minYearsNum != null &&
        !Number.isNaN(minYearsNum) &&
        (c.yearsExperience == null || c.yearsExperience < minYearsNum)
      ) {
        return false;
      }
      return true;
    });
  }, [candidates, search, employmentStatus, noticePeriod, sourcePlatform, minYears]);

  function employmentStatusLabelFor(value: string) {
    if (value === ANY_VALUE) return "Any employment status";
    return (
      EMPLOYMENT_STATUS_LABELS[value as keyof typeof EMPLOYMENT_STATUS_LABELS] ??
      value
    );
  }

  function noticePeriodLabelFor(value: string) {
    if (value === ANY_VALUE) return "Any notice period";
    return NOTICE_PERIOD_LABELS[value as keyof typeof NOTICE_PERIOD_LABELS] ?? value;
  }

  function sourcePlatformLabelFor(value: string) {
    return value === ANY_VALUE ? "Any source" : value;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex flex-col gap-3">
        <Input
          aria-label="Search candidates"
          placeholder="Search by name, tag, or skill…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex flex-wrap gap-3">
          <Select value={employmentStatus} onValueChange={(v) => v && setEmploymentStatus(v)}>
            <SelectTrigger aria-label="Filter by employment status" size="sm">
              <SelectValue>{(value: string) => employmentStatusLabelFor(value)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_VALUE}>Any employment status</SelectItem>
              {EMPLOYMENT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {EMPLOYMENT_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={noticePeriod} onValueChange={(v) => v && setNoticePeriod(v)}>
            <SelectTrigger aria-label="Filter by notice period" size="sm">
              <SelectValue>{(value: string) => noticePeriodLabelFor(value)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_VALUE}>Any notice period</SelectItem>
              {NOTICE_PERIODS.map((period) => (
                <SelectItem key={period} value={period}>
                  {NOTICE_PERIOD_LABELS[period]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sourcePlatform} onValueChange={(v) => v && setSourcePlatform(v)}>
            <SelectTrigger aria-label="Filter by source" size="sm">
              <SelectValue>{(value: string) => sourcePlatformLabelFor(value)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_VALUE}>Any source</SelectItem>
              {SOURCE_PLATFORMS.map((platform) => (
                <SelectItem key={platform} value={platform}>
                  {platform}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            aria-label="Minimum years of experience"
            type="number"
            min="0"
            step="0.5"
            placeholder="Min. years exp."
            value={minYears}
            onChange={(e) => setMinYears(e.target.value)}
            className="w-36"
          />
        </div>
      </div>

      <p className="text-xs tabular-nums text-muted-foreground">
        {filtered.length} of {candidates.length} candidate
        {candidates.length === 1 ? "" : "s"}
      </p>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No candidates match these filters.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 pb-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((candidate) => (
              <TalentBenchCard key={candidate.id} candidate={candidate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

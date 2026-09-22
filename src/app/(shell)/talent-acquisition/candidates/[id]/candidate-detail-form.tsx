"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  BOARD_STAGES,
  type CandidateStage,
} from "@/lib/talent-acquisition/cadence";
import {
  reassignCandidateRole,
  updateCandidateCommunicationRating,
  updateCandidateEmploymentStatus,
  updateCandidateExpectedCompensation,
  updateCandidateLastCompany,
  updateCandidateLastRole,
  updateCandidateLocation,
  updateCandidateNoticePeriod,
  updateCandidateNotes,
  updateCandidateSourcePlatform,
  updateCandidateStage,
  updateCandidateTags,
  updateCandidateYearsExperience,
} from "@/lib/talent-acquisition/candidates-actions";
import {
  EMPLOYMENT_STATUS_LABELS,
  EMPLOYMENT_STATUSES,
  NOTICE_PERIOD_LABELS,
  NOTICE_PERIODS,
} from "@/lib/talent-acquisition/employment-fields";
import { SOURCE_PLATFORMS } from "@/lib/talent-acquisition/source-platforms";

const NO_ROLE_VALUE = "none";
const NO_SOURCE_VALUE = "none";
const NO_RATING_VALUE = "unrated";
const NO_LOCATION_VALUE = "none";
const NO_EMPLOYMENT_STATUS_VALUE = "none";
const NO_NOTICE_PERIOD_VALUE = "none";

type Candidate = {
  id: string;
  stage: CandidateStage;
  notes: string | null;
  tags: string | null;
  role_id: string | null;
  source_platform: string | null;
  communication_rating: number | null;
  location_id: string | null;
  years_experience: number | null;
  last_role: string | null;
  last_company: string | null;
  employment_status: string | null;
  notice_period: string | null;
  expected_compensation: string | null;
};

export function CandidateDetailForm({
  candidate,
  roles,
  locations,
}: {
  candidate: Candidate;
  roles: { id: string; title: string }[];
  locations: { id: string; city: string; province: string }[];
}) {
  const [stage, setStage] = useState<CandidateStage>(candidate.stage);
  const [roleId, setRoleId] = useState<string>(
    candidate.role_id ?? NO_ROLE_VALUE
  );
  const [notes, setNotes] = useState(candidate.notes ?? "");
  const [tags, setTags] = useState(candidate.tags ?? "");
  const [sourcePlatform, setSourcePlatform] = useState(
    candidate.source_platform ?? NO_SOURCE_VALUE
  );
  const [communicationRating, setCommunicationRating] = useState(
    candidate.communication_rating != null
      ? String(candidate.communication_rating)
      : NO_RATING_VALUE
  );
  const [locationId, setLocationId] = useState(
    candidate.location_id ?? NO_LOCATION_VALUE
  );
  const [yearsExperience, setYearsExperience] = useState(
    candidate.years_experience != null ? String(candidate.years_experience) : ""
  );
  const [lastRole, setLastRole] = useState(candidate.last_role ?? "");
  const [lastCompany, setLastCompany] = useState(candidate.last_company ?? "");
  const [employmentStatus, setEmploymentStatus] = useState(
    candidate.employment_status ?? NO_EMPLOYMENT_STATUS_VALUE
  );
  const [noticePeriod, setNoticePeriod] = useState(
    candidate.notice_period ?? NO_NOTICE_PERIOD_VALUE
  );
  const [expectedCompensation, setExpectedCompensation] = useState(
    candidate.expected_compensation ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleStageChange(next: string | null) {
    if (!next || next === stage) return;
    const previous = stage;
    setStage(next as CandidateStage);
    setError(null);
    startTransition(async () => {
      const result = await updateCandidateStage(candidate.id, next);
      if (result.error) {
        setError(result.error);
        setStage(previous);
      }
    });
  }

  function handleRoleChange(next: string | null) {
    if (!next || next === roleId) return;
    const previous = roleId;
    setRoleId(next);
    setError(null);
    startTransition(async () => {
      const result = await reassignCandidateRole(
        candidate.id,
        next === NO_ROLE_VALUE ? null : next
      );
      if (result.error) {
        setError(result.error);
        setRoleId(previous);
      }
    });
  }

  function saveNotes() {
    if (notes.trim() === (candidate.notes ?? "")) return;
    setError(null);
    startTransition(async () => {
      const result = await updateCandidateNotes(candidate.id, notes);
      if (result.error) setError(result.error);
    });
  }

  function saveTags() {
    if (tags.trim() === (candidate.tags ?? "")) return;
    setError(null);
    startTransition(async () => {
      const result = await updateCandidateTags(candidate.id, tags);
      if (result.error) setError(result.error);
    });
  }

  function handleSourceChange(next: string | null) {
    if (!next || next === sourcePlatform) return;
    const previous = sourcePlatform;
    setSourcePlatform(next);
    setError(null);
    startTransition(async () => {
      const result = await updateCandidateSourcePlatform(
        candidate.id,
        next === NO_SOURCE_VALUE ? null : next
      );
      if (result.error) {
        setError(result.error);
        setSourcePlatform(previous);
      }
    });
  }

  function handleRatingChange(next: string | null) {
    if (!next || next === communicationRating) return;
    const previous = communicationRating;
    setCommunicationRating(next);
    setError(null);
    startTransition(async () => {
      const result = await updateCandidateCommunicationRating(
        candidate.id,
        next === NO_RATING_VALUE ? null : Number(next)
      );
      if (result.error) {
        setError(result.error);
        setCommunicationRating(previous);
      }
    });
  }

  function handleLocationChange(next: string | null) {
    if (!next || next === locationId) return;
    const previous = locationId;
    setLocationId(next);
    setError(null);
    startTransition(async () => {
      const result = await updateCandidateLocation(
        candidate.id,
        next === NO_LOCATION_VALUE ? null : next
      );
      if (result.error) {
        setError(result.error);
        setLocationId(previous);
      }
    });
  }

  function saveYearsExperience() {
    const trimmed = yearsExperience.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    const previous = candidate.years_experience;
    if (parsed === previous || (parsed != null && Number.isNaN(parsed))) {
      if (parsed != null && Number.isNaN(parsed)) {
        setError("Years of experience must be a number.");
      }
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateCandidateYearsExperience(candidate.id, parsed);
      if (result.error) setError(result.error);
    });
  }

  function saveLastRole() {
    if (lastRole.trim() === (candidate.last_role ?? "")) return;
    setError(null);
    startTransition(async () => {
      const result = await updateCandidateLastRole(candidate.id, lastRole);
      if (result.error) setError(result.error);
    });
  }

  function saveLastCompany() {
    if (lastCompany.trim() === (candidate.last_company ?? "")) return;
    setError(null);
    startTransition(async () => {
      const result = await updateCandidateLastCompany(candidate.id, lastCompany);
      if (result.error) setError(result.error);
    });
  }

  function handleEmploymentStatusChange(next: string | null) {
    if (!next || next === employmentStatus) return;
    const previous = employmentStatus;
    setEmploymentStatus(next);
    setError(null);
    startTransition(async () => {
      const result = await updateCandidateEmploymentStatus(
        candidate.id,
        next === NO_EMPLOYMENT_STATUS_VALUE ? null : next
      );
      if (result.error) {
        setError(result.error);
        setEmploymentStatus(previous);
      }
    });
  }

  function handleNoticePeriodChange(next: string | null) {
    if (!next || next === noticePeriod) return;
    const previous = noticePeriod;
    setNoticePeriod(next);
    setError(null);
    startTransition(async () => {
      const result = await updateCandidateNoticePeriod(
        candidate.id,
        next === NO_NOTICE_PERIOD_VALUE ? null : next
      );
      if (result.error) {
        setError(result.error);
        setNoticePeriod(previous);
      }
    });
  }

  function saveExpectedCompensation() {
    if (expectedCompensation.trim() === (candidate.expected_compensation ?? "")) return;
    setError(null);
    startTransition(async () => {
      const result = await updateCandidateExpectedCompensation(
        candidate.id,
        expectedCompensation
      );
      if (result.error) setError(result.error);
    });
  }

  function employmentStatusLabelFor(value: string) {
    if (value === NO_EMPLOYMENT_STATUS_VALUE) return "Not set";
    return EMPLOYMENT_STATUS_LABELS[value as keyof typeof EMPLOYMENT_STATUS_LABELS] ?? value;
  }

  function noticePeriodLabelFor(value: string) {
    if (value === NO_NOTICE_PERIOD_VALUE) return "Not set";
    return NOTICE_PERIOD_LABELS[value as keyof typeof NOTICE_PERIOD_LABELS] ?? value;
  }

  function stageLabelFor(value: string) {
    return BOARD_STAGES.find((s) => s.key === value)?.label ?? value;
  }

  function sourceLabelFor(value: string) {
    return value === NO_SOURCE_VALUE ? "Not set" : value;
  }

  function ratingLabelFor(value: string) {
    return value === NO_RATING_VALUE ? "Not rated" : `${value}/5`;
  }

  function roleLabelFor(value: string) {
    if (value === NO_ROLE_VALUE) return "No role — Talent Pool";
    return roles.find((role) => role.id === value)?.title ?? value;
  }

  function locationLabelFor(value: string) {
    if (value === NO_LOCATION_VALUE) return "Not set";
    const location = locations.find((l) => l.id === value);
    return location ? `${location.city}, ${location.province}` : value;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Stage
          </span>
          <Select
            value={stage}
            onValueChange={handleStageChange}
            disabled={isPending}
          >
            <SelectTrigger aria-label="Stage">
              <SelectValue>{(value: string) => stageLabelFor(value)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {BOARD_STAGES.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Role
          </span>
          <Select
            value={roleId}
            onValueChange={handleRoleChange}
            disabled={isPending}
          >
            <SelectTrigger aria-label="Role">
              <SelectValue>{(value: string) => roleLabelFor(value)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ROLE_VALUE}>
                No role — Talent Pool
              </SelectItem>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Source
          </span>
          <Select
            value={sourcePlatform}
            onValueChange={handleSourceChange}
            disabled={isPending}
          >
            <SelectTrigger aria-label="Source">
              <SelectValue>
                {(value: string) => `Source: ${sourceLabelFor(value)}`}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_SOURCE_VALUE}>Not set</SelectItem>
              {SOURCE_PLATFORMS.map((platform) => (
                <SelectItem key={platform} value={platform}>
                  {platform}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Communication
          </span>
          <Select
            value={communicationRating}
            onValueChange={handleRatingChange}
            disabled={isPending}
          >
            <SelectTrigger aria-label="Communication rating">
              <SelectValue>
                {(value: string) => `Communication: ${ratingLabelFor(value)}`}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_RATING_VALUE}>Not rated</SelectItem>
              {[1, 2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}/5
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Location
          </span>
          <Select
            value={locationId}
            onValueChange={handleLocationChange}
            disabled={isPending}
          >
            <SelectTrigger aria-label="Location">
              <SelectValue>{(value: string) => locationLabelFor(value)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_LOCATION_VALUE}>Not set</SelectItem>
              {locations.map((location) => (
                <SelectItem key={location.id} value={location.id}>
                  {location.city}, {location.province}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="candidate-last-role"
            className="text-xs uppercase tracking-wide text-muted-foreground"
          >
            Last role
          </label>
          <Input
            id="candidate-last-role"
            value={lastRole}
            onChange={(e) => setLastRole(e.target.value)}
            onBlur={saveLastRole}
            disabled={isPending}
            placeholder="e.g. Senior Backend Engineer"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="candidate-last-company"
            className="text-xs uppercase tracking-wide text-muted-foreground"
          >
            Last company
          </label>
          <Input
            id="candidate-last-company"
            value={lastCompany}
            onChange={(e) => setLastCompany(e.target.value)}
            onBlur={saveLastCompany}
            disabled={isPending}
            placeholder="e.g. Acme Corp"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="candidate-years-experience"
            className="text-xs uppercase tracking-wide text-muted-foreground"
          >
            Years of experience
          </label>
          <Input
            id="candidate-years-experience"
            type="number"
            min="0"
            step="0.5"
            value={yearsExperience}
            onChange={(e) => setYearsExperience(e.target.value)}
            onBlur={saveYearsExperience}
            disabled={isPending}
            placeholder="e.g. 5"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="candidate-expected-compensation"
            className="text-xs uppercase tracking-wide text-muted-foreground"
          >
            Expected compensation
          </label>
          <Input
            id="candidate-expected-compensation"
            value={expectedCompensation}
            onChange={(e) => setExpectedCompensation(e.target.value)}
            onBlur={saveExpectedCompensation}
            disabled={isPending}
            placeholder="e.g. ₱80k/mo or $2,000/mo"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Employment status
          </span>
          <Select
            value={employmentStatus}
            onValueChange={handleEmploymentStatusChange}
            disabled={isPending}
          >
            <SelectTrigger aria-label="Employment status">
              <SelectValue>
                {(value: string) => employmentStatusLabelFor(value)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_EMPLOYMENT_STATUS_VALUE}>Not set</SelectItem>
              {EMPLOYMENT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {EMPLOYMENT_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Notice period
          </span>
          <Select
            value={noticePeriod}
            onValueChange={handleNoticePeriodChange}
            disabled={isPending}
          >
            <SelectTrigger aria-label="Notice period">
              <SelectValue>{(value: string) => noticePeriodLabelFor(value)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_NOTICE_PERIOD_VALUE}>Not set</SelectItem>
              {NOTICE_PERIODS.map((period) => (
                <SelectItem key={period} value={period}>
                  {NOTICE_PERIOD_LABELS[period]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="candidate-notes"
          className="text-xs uppercase tracking-wide text-muted-foreground"
        >
          Notes
        </label>
        <Textarea
          id="candidate-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          disabled={isPending}
          rows={3}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="candidate-tags"
          className="text-xs uppercase tracking-wide text-muted-foreground"
        >
          Tags
        </label>
        <Input
          id="candidate-tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          onBlur={saveTags}
          disabled={isPending}
          placeholder="Comma-separated, e.g. backend, remote"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

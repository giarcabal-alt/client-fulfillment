"use client";

import { X } from "lucide-react";
import { useActionState, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createCandidate,
  type CandidateActionState,
  type RoleMode,
} from "@/lib/talent-acquisition/candidates-actions";
import { uploadStagingResume } from "@/lib/talent-acquisition/new-candidate-resume-actions";
import { SOURCE_PLATFORMS } from "@/lib/talent-acquisition/source-platforms";

const NEW_ROLE_VALUE = "__new__";
const NO_ROLE_VALUE = "none";
const NO_SOURCE_VALUE = "none";
const NO_LOCATION_VALUE = "none";

const ACCEPTED_RESUME_TYPES =
  "application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx";

const initialState: CandidateActionState = { error: null };

// Mirrors resume-parse-core.ts's SubmittedSkillChip exactly — this is
// what gets JSON-serialized into the skills_json hidden field and decoded
// server-side by parseSubmittedSkillChips/finalizeSkillChips in
// candidates-actions.ts.
type SkillChip = {
  rawText: string;
  currentText: string;
  kind: "auto" | "review";
  skillId: string | null;
  skillName: string | null;
  similarity: number | null;
};

export function NewCandidateForm({
  roles,
  locations,
  onSuccess,
}: {
  roles: { id: string; title: string }[];
  locations: { id: string; city: string; province: string }[];
  onSuccess: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [roleChoice, setRoleChoice] = useState<string>(NO_ROLE_VALUE);
  const [sourcePlatform, setSourcePlatform] = useState<string>(NO_SOURCE_VALUE);

  // Resume-upload-with-autofill state — all optional, only populated once
  // a resume is uploaded. Manual entry never touches any of this.
  const [resumeFileName, setResumeFileName] = useState<string | null>(null);
  const [stagingPath, setStagingPath] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [isUploadingResume, startResumeUpload] = useTransition();
  const [name, setName] = useState("");
  const [skillChips, setSkillChips] = useState<SkillChip[]>([]);
  const [locationChoice, setLocationChoice] = useState<string>(NO_LOCATION_VALUE);

  const roleMode: RoleMode =
    roleChoice === NO_ROLE_VALUE
      ? "none"
      : roleChoice === NEW_ROLE_VALUE
        ? "new"
        : "existing";

  function roleLabelFor(value: string) {
    if (value === NO_ROLE_VALUE) return "No role — Talent Pool";
    if (value === NEW_ROLE_VALUE) return "+ Create new role";
    return roles.find((role) => role.id === value)?.title ?? value;
  }

  function locationLabelFor(value: string) {
    if (value === NO_LOCATION_VALUE) return "Not set";
    const location = locations.find((l) => l.id === value);
    return location ? `${location.city}, ${location.province}` : value;
  }

  function handleResumeFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResumeError(null);
    setResumeFileName(file.name);
    const formData = new FormData();
    formData.set("file", file);
    startResumeUpload(async () => {
      const result = await uploadStagingResume(formData);
      if (result.error) {
        setResumeError(result.error);
      }
      if (result.stagingPath) {
        setStagingPath(result.stagingPath);
      }
      if (result.parsed) {
        // Only pre-fill Name if the recruiter hasn't already typed one —
        // never clobber something the user entered before uploading.
        if (result.parsed.name && !name.trim()) {
          setName(result.parsed.name);
        }
        setSkillChips(
          result.parsed.skills.map((s) => ({
            rawText: s.rawText,
            currentText: s.rawText,
            kind: s.kind,
            skillId: s.skillId,
            skillName: s.skillName,
            similarity: s.similarity,
          }))
        );
        if (result.parsed.location.kind === "auto" && result.parsed.location.locationId) {
          setLocationChoice(result.parsed.location.locationId);
        }
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    });
  }

  function updateChipText(index: number, text: string) {
    setSkillChips((prev) =>
      prev.map((chip, i) => (i === index ? { ...chip, currentText: text } : chip))
    );
  }

  function removeChip(index: number) {
    setSkillChips((prev) => prev.filter((_, i) => i !== index));
  }

  async function action(prevState: CandidateActionState, formData: FormData) {
    const result = await createCandidate(prevState, formData);
    if (!result.error) {
      formRef.current?.reset();
      setRoleChoice(NO_ROLE_VALUE);
      setSourcePlatform(NO_SOURCE_VALUE);
      setResumeFileName(null);
      setStagingPath(null);
      setResumeError(null);
      setName("");
      setSkillChips([]);
      setLocationChoice(NO_LOCATION_VALUE);
      onSuccess();
    }
    return result;
  }

  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Resume (optional)
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingResume}
            aria-label="Choose resume file to autofill this form"
            className="w-fit"
          >
            {isUploadingResume ? "Uploading…" : "Choose file"}
          </Button>
          {resumeFileName && (
            <span className="min-w-0 truncate text-sm text-slate-text">
              {resumeFileName}
            </span>
          )}
        </div>
        {/* Same hidden-input + real-Button trigger pattern as
            candidates/[id]/resume-upload.tsx (see PROJECT_STATE.md §10) —
            `hidden`, not `sr-only`, so it's never its own tab stop. */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_RESUME_TYPES}
          onChange={handleResumeFileChange}
          disabled={isUploadingResume}
          tabIndex={-1}
          aria-hidden="true"
          className="hidden"
        />
        {resumeError && (
          <p role="alert" className="text-sm text-destructive">
            {resumeError}
          </p>
        )}
        <input type="hidden" name="staged_resume_path" value={stagingPath ?? ""} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="new-candidate-name">Name</Label>
        <Input
          id="new-candidate-name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      {skillChips.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Skills from resume — edit or remove any that aren&apos;t right
          </span>
          <div className="flex flex-wrap gap-2">
            {skillChips.map((chip, i) => (
              <div
                key={i}
                className={
                  chip.kind === "auto"
                    ? "flex items-center gap-1 rounded-full bg-growth-green py-1 pl-3 pr-1 text-white"
                    : "flex items-center gap-1 rounded-full border border-sun-gold bg-warm-paper py-1 pl-3 pr-1 text-slate-text"
                }
              >
                <input
                  value={chip.currentText}
                  onChange={(e) => updateChipText(i, e.target.value)}
                  aria-label={
                    chip.kind === "auto"
                      ? `Matched skill: ${chip.currentText}`
                      : `Skill needing review: ${chip.currentText}`
                  }
                  className="min-w-[4ch] max-w-[18ch] bg-transparent text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  style={{ width: `${Math.max(chip.currentText.length, 4)}ch` }}
                />
                {chip.kind === "review" && (
                  <span className="text-xs opacity-80">needs review</span>
                )}
                <button
                  type="button"
                  onClick={() => removeChip(i)}
                  aria-label={`Remove ${chip.currentText}`}
                  className="rounded-full p-0.5 hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <input
            type="hidden"
            name="skills_json"
            value={JSON.stringify(
              skillChips.map((c) => ({
                rawText: c.rawText,
                currentText: c.currentText,
                kind: c.kind,
                skillId: c.skillId,
                skillName: c.skillName,
                similarity: c.similarity,
              }))
            )}
          />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <Label htmlFor="new-candidate-role">Role</Label>
        <Select value={roleChoice} onValueChange={(v) => v && setRoleChoice(v)}>
          <SelectTrigger id="new-candidate-role" className="w-full">
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
            <SelectItem value={NEW_ROLE_VALUE}>+ Create new role</SelectItem>
          </SelectContent>
        </Select>
        <input type="hidden" name="role_mode" value={roleMode} />
        {roleMode === "existing" && (
          <input type="hidden" name="role_id" value={roleChoice} />
        )}
      </div>

      {roleMode === "new" && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="new-candidate-new-role-title">New role title</Label>
          <Input
            id="new-candidate-new-role-title"
            name="new_role_title"
            placeholder="e.g. Senior Backend Engineer"
            required
          />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <Label htmlFor="new-candidate-location">Location</Label>
        <Select
          value={locationChoice}
          onValueChange={(v) => v && setLocationChoice(v)}
        >
          <SelectTrigger id="new-candidate-location" className="w-full">
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
        <input
          type="hidden"
          name="location_id"
          value={locationChoice === NO_LOCATION_VALUE ? "" : locationChoice}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="new-candidate-notes">Notes (optional)</Label>
        <Input
          id="new-candidate-notes"
          name="notes"
          placeholder="How you found them, context…"
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="new-candidate-source">Source (optional)</Label>
        <Select
          value={sourcePlatform}
          onValueChange={(v) => v && setSourcePlatform(v)}
        >
          <SelectTrigger id="new-candidate-source" className="w-full">
            <SelectValue>
              {(value: string) => (value === NO_SOURCE_VALUE ? "None" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_SOURCE_VALUE}>None</SelectItem>
            {SOURCE_PLATFORMS.map((platform) => (
              <SelectItem key={platform} value={platform}>
                {platform}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input
          type="hidden"
          name="source_platform"
          value={sourcePlatform === NO_SOURCE_VALUE ? "" : sourcePlatform}
        />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={isPending} className="self-end">
        {isPending ? "Adding…" : "Add candidate"}
      </Button>
    </form>
  );
}

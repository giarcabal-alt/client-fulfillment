"use client";

// "Parse JD" → editable/removable skill chips, same UX as the New
// Candidate form's resume-autofill skills (new-candidate-form.tsx) —
// reused here for a role's job description instead of a candidate's
// resume. Works in two modes depending on whether `roleId` is given:
//   - create mode (roleId undefined): chips are staged client-side only
//     and exposed via a hidden `skills_json` input, so the parent
//     <form action={createRole}> submits them together with the new
//     role — identical shape to new-candidate-form.tsx's own
//     `skills_json` field, decoded by the same finalizeSkillChips.
//   - edit mode (roleId given): an explicit "Save skills" button calls
//     saveRoleSkills directly — parseRoleJobDescriptionSkills itself
//     never writes anything, so an existing role's chips need this
//     separate persist step (createRole's insert-then-persist doesn't
//     apply once the role already exists).

import { X } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  parseRoleJobDescriptionSkills,
  saveRoleSkills,
} from "@/lib/talent-acquisition/roles-actions";

type SkillChip = {
  rawText: string;
  currentText: string;
  kind: "auto" | "review";
  skillId: string | null;
  skillName: string | null;
  similarity: number | null;
};

export function RoleSkillsEditor({
  roleId,
  jobDescription,
  initialChips = [],
}: {
  roleId?: string;
  jobDescription: string;
  initialChips?: SkillChip[];
}) {
  const [chips, setChips] = useState<SkillChip[]>(initialChips);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isParsing, startParse] = useTransition();
  const [isSaving, startSave] = useTransition();

  function handleParse() {
    setError(null);
    setSaveMessage(null);
    startParse(async () => {
      const result = await parseRoleJobDescriptionSkills(jobDescription);
      if (result.error) {
        setError(result.error);
        return;
      }
      setChips(
        result.skills.map((s) => ({
          rawText: s.rawText,
          currentText: s.rawText,
          kind: s.kind,
          skillId: s.skillId,
          skillName: s.skillName,
          similarity: s.similarity,
        }))
      );
    });
  }

  function updateChipText(index: number, text: string) {
    setChips((prev) =>
      prev.map((chip, i) => (i === index ? { ...chip, currentText: text } : chip))
    );
  }

  function removeChip(index: number) {
    setChips((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave() {
    if (!roleId) return;
    setError(null);
    setSaveMessage(null);
    startSave(async () => {
      const result = await saveRoleSkills(roleId, chips);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaveMessage("Skills saved.");
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Skills
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleParse}
          disabled={isParsing || !jobDescription.trim()}
        >
          {isParsing ? "Parsing…" : "Parse JD"}
        </Button>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip, i) => (
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
                <span className="text-xs text-slate-text/70">needs review</span>
              )}
              <button
                type="button"
                onClick={() => removeChip(i)}
                aria-label={`Remove ${chip.currentText}`}
                className="rounded-full p-0.5 outline-none hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {roleId ? (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleSave}
            disabled={isSaving || chips.length === 0}
            className="w-fit"
          >
            {isSaving ? "Saving…" : "Save skills"}
          </Button>
          {saveMessage && <span className="text-xs text-growth-green">{saveMessage}</span>}
        </div>
      ) : (
        <input
          type="hidden"
          name="skills_json"
          value={JSON.stringify(
            chips.map((c) => ({
              rawText: c.rawText,
              currentText: c.currentText,
              kind: c.kind,
              skillId: c.skillId,
              skillName: c.skillName,
              similarity: c.similarity,
            }))
          )}
        />
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

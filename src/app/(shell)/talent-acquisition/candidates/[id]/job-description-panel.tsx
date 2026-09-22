"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const COLLAPSED_LENGTH = 180;

export function JobDescriptionPanel({
  roleTitle,
  jobDescription,
}: {
  roleTitle: string | null;
  jobDescription: string | null;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!roleTitle) {
    return (
      <p className="text-sm text-muted-foreground">
        No role assigned — assign one above to see its job description.
      </p>
    );
  }

  const text = jobDescription || "No job description yet.";
  const isLong = text.length > COLLAPSED_LENGTH;
  const shown = expanded || !isLong ? text : `${text.slice(0, COLLAPSED_LENGTH).trimEnd()}…`;

  return (
    <div className="flex flex-col gap-2">
      <p className="whitespace-pre-wrap text-sm">{shown}</p>
      <div className="flex items-center gap-3">
        {isLong && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto w-fit px-0 text-work-blue hover:bg-transparent hover:underline"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Show less" : "Show more"}
          </Button>
        )}
        <Link
          href="/talent-acquisition/roles"
          className="w-fit text-sm text-work-blue underline"
        >
          Edit on the roles page
        </Link>
      </div>
    </div>
  );
}

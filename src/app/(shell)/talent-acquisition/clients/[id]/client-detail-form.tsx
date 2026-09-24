"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { PropertyRow, propertyControlClass } from "@/components/ui/property-row";
import { Textarea } from "@/components/ui/textarea";
import {
  updateClientCompanyName,
  updateClientIndustry,
  updateClientLocation,
  updateClientNotes,
  updateClientPointOfContactEmail,
  updateClientPointOfContactName,
  updateClientPointOfContactPhone,
  updateClientTimezone,
  updateClientWebsite,
} from "@/lib/talent-acquisition/clients-actions";
import { TimezoneClock } from "@/lib/talent-acquisition/timezone-clock";

export type ClientDetail = {
  id: string;
  company_name: string;
  industry: string | null;
  website: string | null;
  location: string | null;
  timezone: string | null;
  point_of_contact_name: string | null;
  point_of_contact_email: string | null;
  point_of_contact_phone: string | null;
  notes: string | null;
};

// Same properties-list/save-on-blur pattern as candidate-detail-form.tsx/
// role-detail-form.tsx — company name reads full-width above the list
// (matching the role/candidate detail pages' own title treatment), notes
// as its own textarea below, same as candidate-detail-form.tsx's Notes.
export function ClientDetailForm({ client }: { client: ClientDetail }) {
  const [companyName, setCompanyName] = useState(client.company_name);
  const [industry, setIndustry] = useState(client.industry ?? "");
  const [website, setWebsite] = useState(client.website ?? "");
  const [location, setLocation] = useState(client.location ?? "");
  const [timezone, setTimezone] = useState(client.timezone ?? "");
  const [pocName, setPocName] = useState(client.point_of_contact_name ?? "");
  const [pocEmail, setPocEmail] = useState(client.point_of_contact_email ?? "");
  const [pocPhone, setPocPhone] = useState(client.point_of_contact_phone ?? "");
  const [notes, setNotes] = useState(client.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function saveCompanyName() {
    if (companyName.trim() === client.company_name) return;
    setError(null);
    startTransition(async () => {
      const result = await updateClientCompanyName(client.id, companyName);
      if (result.error) {
        setError(result.error);
        setCompanyName(client.company_name);
      }
    });
  }

  function makeSaver(
    action: (id: string, value: string | null) => Promise<{ error: string | null }>,
    current: string,
    original: string | null,
    revert: (value: string) => void
  ) {
    return () => {
      if (current.trim() === (original ?? "")) return;
      setError(null);
      startTransition(async () => {
        const result = await action(client.id, current);
        if (result.error) {
          setError(result.error);
          revert(original ?? "");
        }
      });
    };
  }

  const saveIndustry = makeSaver(updateClientIndustry, industry, client.industry, setIndustry);
  const saveWebsite = makeSaver(updateClientWebsite, website, client.website, setWebsite);
  const saveLocation = makeSaver(updateClientLocation, location, client.location, setLocation);
  const saveTimezone = makeSaver(updateClientTimezone, timezone, client.timezone, setTimezone);
  const savePocName = makeSaver(
    updateClientPointOfContactName,
    pocName,
    client.point_of_contact_name,
    setPocName
  );
  const savePocEmail = makeSaver(
    updateClientPointOfContactEmail,
    pocEmail,
    client.point_of_contact_email,
    setPocEmail
  );
  const savePocPhone = makeSaver(
    updateClientPointOfContactPhone,
    pocPhone,
    client.point_of_contact_phone,
    setPocPhone
  );
  const saveNotes = makeSaver(updateClientNotes, notes, client.notes, setNotes);

  return (
    <div className="flex flex-col gap-3">
      <input
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
        onBlur={saveCompanyName}
        disabled={isPending}
        aria-label="Company name"
        className="rounded-md border border-transparent bg-transparent px-1.5 py-1 font-display text-xl text-ink-navy outline-none hover:border-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />

      {timezone && (
        <div className="px-1.5">
          <TimezoneClock timezone={timezone} clientLabel={companyName} />
        </div>
      )}

      <div className="flex flex-col">
        <PropertyRow label="Industry">
          <Input
            aria-label="Industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            onBlur={saveIndustry}
            disabled={isPending}
            className={propertyControlClass}
          />
        </PropertyRow>

        <PropertyRow label="Website">
          <Input
            aria-label="Website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            onBlur={saveWebsite}
            disabled={isPending}
            placeholder="e.g. acme.com"
            className={propertyControlClass}
          />
        </PropertyRow>

        <PropertyRow label="Location">
          <Input
            aria-label="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            onBlur={saveLocation}
            disabled={isPending}
            placeholder="e.g. Austin, TX, USA"
            className={propertyControlClass}
          />
        </PropertyRow>

        <PropertyRow label="Timezone">
          <Input
            aria-label="Timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            onBlur={saveTimezone}
            disabled={isPending}
            placeholder="e.g. America/New_York"
            className={propertyControlClass}
          />
        </PropertyRow>

        <PropertyRow label="Point of contact">
          <Input
            aria-label="Point of contact name"
            value={pocName}
            onChange={(e) => setPocName(e.target.value)}
            onBlur={savePocName}
            disabled={isPending}
            className={propertyControlClass}
          />
        </PropertyRow>

        <PropertyRow label="Contact email">
          <Input
            aria-label="Contact email"
            type="email"
            value={pocEmail}
            onChange={(e) => setPocEmail(e.target.value)}
            onBlur={savePocEmail}
            disabled={isPending}
            className={propertyControlClass}
          />
        </PropertyRow>

        <PropertyRow label="Contact phone">
          <Input
            aria-label="Contact phone"
            value={pocPhone}
            onChange={(e) => setPocPhone(e.target.value)}
            onBlur={savePocPhone}
            disabled={isPending}
            className={propertyControlClass}
          />
        </PropertyRow>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Notes</span>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          disabled={isPending}
          rows={3}
          aria-label="Notes"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

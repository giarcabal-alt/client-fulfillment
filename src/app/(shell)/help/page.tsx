import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Section, SectionDivider } from "@/components/ui/section";

// App-level page, same as Settings/Admin — not nested under
// talent-acquisition/, since it documents the whole Client Fulfillment
// App (Talent Acquisition Desk today, Onboarding/Kickoff as they land),
// not just one module. A real in-app route rather than an external doc:
// this is an internal tool, and whoever needs this is already logged in.
//
// Full width per this task's own instruction, not the 1120px reading-
// width cap DESIGN_SYSTEM.md §4 otherwise reserves for long-form text —
// the left-column table of contents is what makes the extra width worth
// having on a page that's mostly prose, rather than just stretching
// paragraphs edge to edge.

const TOC = [
  { id: "board", label: "The Board" },
  { id: "job-openings", label: "Job Openings" },
  { id: "adding-a-candidate", label: "Adding a Candidate" },
  { id: "candidate-detail", label: "Candidate Detail Page" },
  { id: "talent-bench", label: "Talent Bench" },
  { id: "rejected", label: "Rejected" },
  { id: "metrics", label: "Metrics" },
  { id: "clients", label: "Clients" },
  { id: "admin", label: "Admin" },
];

export default function HelpPage() {
  return (
    <div className="flex w-full flex-col gap-3 p-4 sm:p-6">
      <div className="max-w-[1120px]">
        <h1 className="font-display text-xl text-ink-navy">How to Use</h1>
        <p className="mt-2 text-sm text-slate-text">
          Talent Acquisition Desk helps UpScaleSupport find, evaluate, and
          place the AI-fluent operators we embed with clients — from first
          outreach through onboarding. It&apos;s the first module of the
          Client Fulfillment App; Onboarding and Kickoff will join it here
          as those come online.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start">
        <nav
          aria-label="Table of contents"
          className="flex flex-col gap-0.5 lg:sticky lg:top-4"
        >
          {TOC.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="rounded-md px-2 py-1 text-sm text-work-blue outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex flex-col gap-3">
          <Section id="board" title="The Board">
            <div className="flex flex-col gap-3">
              <p>
                The Board (<code>/talent-acquisition/board</code>) is the
                kanban view of the active pipeline — seven columns, in
                order: <strong>Talent Pool</strong>, Sourced, Contacted,
                Phone Screen, Interviewing, Offer, and Onboarding. A
                candidate card shows their name, assigned role, and a
                status badge; click a card to open the drawer, where you
                can change their stage or jump to their full detail page.
              </p>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Talent Pool
                </span>
                <p>
                  A holding column for candidates without an assigned role
                  yet — not the start of the pipeline. Talent Pool
                  candidates never get reminder pressure: no touches, no
                  overdue badge, ever. Move a candidate into a real stage
                  (typically by assigning them a role) once you&apos;re
                  ready to actively work them.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Status badges
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-destructive text-white">Overdue</Badge>
                  <Badge className="bg-stone text-ink-navy">
                    <span
                      aria-hidden="true"
                      className="mr-1 size-1.5 rounded-full bg-sun-gold"
                    />
                    Soon
                  </Badge>
                  <Badge className="bg-growth-green text-white">
                    On track
                  </Badge>
                  <Badge className="bg-stone text-slate-text">
                    No action due
                  </Badge>
                  <Badge className="bg-stone text-slate-text">Parked</Badge>
                </div>
                <p>
                  Each stage has its own cadence of expected touches (e.g.
                  Sourced expects an initial outreach message; Contacted
                  expects a follow-up on day 3, then a breakup message on
                  day 8; Phone Screen and Interviewing recur every 6 days
                  once their scripted touches run out). A candidate is{" "}
                  <strong>overdue</strong> once their next action&apos;s due
                  date has passed, <strong>soon</strong> if it&apos;s due
                  within 2 days, <strong>on track</strong> otherwise. Once a
                  stage runs out of scripted touches and has no recurring
                  check-in (Talent Pool, the tail end of Contacted/Offer/
                  Onboarding), the badge reads{" "}
                  <strong>&ldquo;No action due.&rdquo;</strong> Talent Pool
                  candidates always show <strong>Parked</strong> regardless
                  of any of the above — there&apos;s no due date to be
                  overdue against.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Search
                </span>
                <p>
                  The search box above the board filters candidates by
                  name, assigned role title, or confirmed skill — useful
                  for finding everyone with a given skill across every
                  stage at once.
                </p>
              </div>
            </div>
          </Section>

          <Section id="job-openings" title="Job Openings">
            <div className="flex flex-col gap-3">
              <p>
                <code>/talent-acquisition/roles</code> lists every open
                requisition as a compact table — title, client, status,
                classification, priority, target fill date, and candidate
                count. Click a title to open the row and edit it inline, or
                <strong> Details</strong> to open the full role detail page.
                Use <strong>+ Add role</strong> to create a new one.
              </p>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Linking a client
                </span>
                <p>
                  The Client field is a searchable dropdown of every
                  company on the <a href="#clients" className="text-work-blue hover:underline">Clients</a> page,
                  with a <strong>+ Create new client</strong> option inline
                  if the one you need doesn&apos;t exist yet — no need to
                  leave the form.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Skills: manually or via Parse JD
                </span>
                <p>
                  Add skills as chips one at a time, or paste the full job
                  description into the Job Description field and click{" "}
                  <strong>Parse JD</strong> — it extracts the required
                  skills automatically. A skill that matches something
                  already in the org&apos;s skill list becomes a confirmed
                  green chip; anything ambiguous becomes a gold{" "}
                  <strong>needs review</strong> chip you can edit, remove,
                  or leave for later. On an existing role, click{" "}
                  <strong>Save skills</strong> after parsing — on a brand
                  new role, the chips save automatically with the rest of
                  the form.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  The rest of the fields
                </span>
                <p>
                  Compensation is free text (e.g. &ldquo;PHP
                  60,000/month&rdquo;) — there&apos;s no fixed currency or
                  format. Payment terms (full-time salary, hourly,
                  project-based, monthly retainer), seniority level
                  (entry/mid/senior/lead), and work arrangement (fully
                  remote/hybrid/onsite) are all fixed dropdowns. Timezone
                  overlap is free text describing the required working-
                  hours overlap (e.g. &ldquo;4hrs PHT/EST&rdquo;) — this is
                  separate from the client&apos;s own timezone, which
                  drives the live clock shown next to the client&apos;s
                  name. Priority is Standard, Urgent, or On Hold, and shows
                  as a badge at the top of the role detail page. Target
                  fill date is a plain date.
                </p>
              </div>
            </div>
          </Section>

          <Section id="adding-a-candidate" title="Adding a Candidate">
            <div className="flex flex-col gap-3">
              <p>
                From the Board, click{" "}
                <strong>+ Add candidate</strong> to open the New Candidate
                form. You can fill it in by hand, or upload a resume first
                to autofill most of it.
              </p>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Resume upload with autofill
                </span>
                <p>
                  Choose a PDF or DOCX file before filling anything else
                  in. The candidate&apos;s name (if you haven&apos;t
                  already typed one — an upload never overwrites something
                  you&apos;ve entered), skills, and location are extracted
                  automatically. Skills come back the same way Parse JD
                  works for roles: a confirmed green chip for anything that
                  matches the org&apos;s skill list, a gold{" "}
                  <strong>needs review</strong> chip for anything
                  ambiguous — edit or remove any chip before submitting.
                  Location resolves automatically when it&apos;s confident;
                  otherwise it&apos;s left for you to set from the
                  dropdown.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Assigning a role
                </span>
                <p>
                  Pick an existing open role, leave it unassigned (the
                  candidate lands in Talent Pool), or use{" "}
                  <strong>+ Create new role</strong> to spin up a new one
                  inline without leaving the form. Notes and source
                  platform are optional context for later.
                </p>
              </div>
            </div>
          </Section>

          <Section id="candidate-detail" title="Candidate Detail Page">
            <div className="flex flex-col gap-3">
              <p>
                Click any candidate&apos;s name — from the Board, Talent
                Bench, or a role&apos;s Candidates tab — to open their full
                record. The left column holds every property (stage, role,
                source, communication rating, location, years of
                experience, last role/company, employment status, notice
                period, expected compensation, and — for admins — who
                it&apos;s assigned to); every value edits in place, just
                click it. The right side is tabbed:
              </p>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Skills &amp; Fit
                </span>
                <p>
                  Shows how many of the assigned role&apos;s required
                  skills this candidate has confirmed, as three chip
                  groups: <strong>matched required</strong> (green),{" "}
                  <strong>missing required</strong> (outline), and{" "}
                  <strong>other confirmed</strong> skills not tied to the
                  role&apos;s requirements at all. Below that,{" "}
                  <strong>Needs review</strong> lists any skill pulled from
                  a resume that couldn&apos;t be confidently matched —
                  confirm the suggested match, search for the right skill
                  instead, or reject it outright. The role&apos;s job
                  description is also available here, collapsed by
                  default.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Outreach
                </span>
                <p>
                  Shows the next scripted action for the candidate&apos;s
                  current stage (the same label that drives the Board
                  status badge) with its template text underneath. Below
                  that, <strong>Generate suggested message</strong> asks
                  Claude for a ready-to-send, candidate/role-specific
                  version of that message — edit and copy it, or regenerate.
                  A generated draft goes stale automatically the moment the
                  candidate moves to a different stage.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Scorecards
                </span>
                <p>
                  Log a 1–5 rating with notes after each interview.
                  Scorecards are append-only — nothing here can be edited
                  or deleted later — and each one records which pipeline
                  stage the candidate was in and (if signed in) who left
                  it.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  History
                </span>
                <p>
                  A dated log of every stage change for this candidate —
                  what the time-in-stage numbers on{" "}
                  <a href="#metrics" className="text-work-blue hover:underline">
                    Metrics
                  </a>{" "}
                  are computed from.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Reject
                </span>
                <p>
                  <strong>Reject candidate</strong>, at the top of the page,
                  requires a decline reason before it&apos;ll confirm.
                  Rejecting doesn&apos;t delete anything — the candidate
                  stays fully visible (with their reason) on{" "}
                  <a href="#talent-bench" className="text-work-blue hover:underline">
                    Talent Bench
                  </a>{" "}
                  and the{" "}
                  <a href="#rejected" className="text-work-blue hover:underline">
                    Rejected
                  </a>{" "}
                  view, in case they&apos;re worth re-approaching for a
                  different role later. There&apos;s no &ldquo;un-reject&rdquo;
                  action.
                </p>
              </div>
            </div>
          </Section>

          <Section id="talent-bench" title="Talent Bench">
            <p>
              <code>/talent-acquisition/talent-bench</code> is the full
              roster — every candidate, regardless of stage or status,
              including rejected ones. Where the Board is a{" "}
              <em>pipeline</em> view (active candidates, moving through
              stages, with reminder pressure), Talent Bench is a{" "}
              <em>roster</em> view for scanning or filtering the whole
              pool — everyone you&apos;ve ever sourced, sortable and
              filterable by stage, status, and skills, with no kanban
              structure to it.
            </p>
          </Section>

          <Section id="rejected" title="Rejected">
            <p>
              The sidebar&apos;s <strong>Rejected</strong> link opens
              Talent Bench pre-filtered to declined candidates — it&apos;s
              the same roster view, not a separate archive. Rejected
              candidates are kept rather than deleted, decline reason
              included, specifically so they can be reconsidered for a
              different role down the line instead of having to be
              re-sourced from scratch.
            </p>
          </Section>

          <Section id="metrics" title="Metrics">
            <p>
              <code>/talent-acquisition/metrics</code> shows two things:{" "}
              <strong>time-in-stage</strong> — the average number of days
              candidates spend in each pipeline stage, computed from the
              stage-change history every candidate detail page logs — and{" "}
              <strong>decline reasons</strong> — how often each rejection
              reason has come up, grouped case-insensitively so
              &ldquo;Culture fit&rdquo; and &ldquo;culture fit&rdquo; count
              together. A candidate&apos;s current (still open) stage is
              never counted in the average, since there&apos;s no end date
              for it yet.
            </p>
          </Section>

          <Section id="clients" title="Clients">
            <p>
              <code>/talent-acquisition/clients</code> lists every client
              company as a full-width table — industry, website, location,
              timezone, point of contact, every role linked to them (each
              linking straight to that role), and notes. Click{" "}
              <strong>Edit</strong> to change any field, including
              timezone, which is a dropdown of common IANA timezone names
              rather than free text — picking one drives the live PH ↔
              client time shown next to it, which updates every second and
              correctly accounts for daylight saving. Admins can also{" "}
              <strong>Delete</strong> a client, but only once it has no
              roles still linked to it.
            </p>
          </Section>

          <Section id="admin" title="Admin">
            <p>
              Admins have an <strong>Admin</strong> item in the sidebar
              (below the divider, next to Settings) for inviting new
              users, changing someone&apos;s role, and resetting a
              password. See the{" "}
              <Link href="/admin" className="text-work-blue hover:underline">
                Admin page
              </Link>{" "}
              itself for how each of those works — not duplicated here.
            </p>
          </Section>

          <SectionDivider className="my-1" />

          <p className="text-xs text-muted-foreground">
            Something here out of date, or missing? This page should track
            the app as it actually works — flag it so it gets fixed.
          </p>
        </div>
      </div>
    </div>
  );
}

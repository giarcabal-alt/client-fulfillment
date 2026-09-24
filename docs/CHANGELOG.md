# Changelog

## [Unreleased]
### Added
- **Job Openings expansion: a real `clients` table, seven new fields on `roles`, JD-parse-to-skills, and a role detail page — built and fully verified live.** The largest schema change since the initial migration, written as a single file (`supabase/migrations/20260923100000_clients_and_job_openings_expansion.sql`) covering all of it. **`clients` is the seed for the future client/lead-gen app, and `roles.client_id` is the join point that future cross-app work will depend on** — flagged explicitly here, not just in the migration's own comments, since it's the one piece of this task with a lifespan well beyond this app.
  - **Schema**: `clients` (company_name required, everything else — industry/website/location/timezone/point-of-contact fields/notes — optional), org-scoped RLS matching every other table. `roles` gained `client_id` (FK to `clients`, `on delete set null` — deleting a client orphans its roles rather than deleting their history, same "orphan, don't destroy" choice `candidates.role_id` already makes), `compensation` (free text, same flexible format as `candidates.expected_compensation`), `payment_terms`/`seniority_level`/`work_arrangement`/`priority` (each a `check`-constrained enum), and `target_fill_date` (date). **Checked first, not assumed**: `timezone_overlap` and `classification` already existed on `roles` from an earlier migration (`20260919110000_add_role_and_candidate_fields.sql`) — this migration does not re-add them. `role_history` (append-only status log, same shape/purpose as `candidate_history`) and `role_skill_reviews` (same shape as `candidate_skill_reviews`) round out the new tables. **Grants**: none added, following the now-confirmed-working `ALTER DEFAULT PRIVILEGES` pattern (verified live: every new table read/wrote correctly through the app with no `permission denied` at any point during testing) — see PROJECT_STATE.md §10 for the reasoning and the fallback if a future session ever does hit one. **Verified the SQL directly, not just by reading it**: applied against a disposable Postgres container stubbed with the tables it depends on before ever touching the real database — confirmed the check constraints reject invalid values, confirmed `client_id`'s `on delete set null` behaves exactly as intended, then applied for real (by the user, via the established `supabase db push` workaround — no DB-password credential of Claude Code's own).
  - **Clients pages**: `/talent-acquisition/clients` (list — company name, point of contact, a live PH↔client clock) and `/talent-acquisition/clients/[id]` (full detail, properties-list edit form, linked roles). "Clients" added as a sixth Talent Acquisition Desk sidebar sub-item, after Metrics.
  - **A new role detail page, `/talent-acquisition/roles/[id]`** — the Job Openings list itself stayed exactly as compact as before (title/status/classification/timezone-overlap/JD-toggle, now also a client name and a "Details" link), rather than cramming client linkage, seven new fields, AI-parsed skills, and a live timezone clock into that already-dense inline row. This is a genuine architecture choice, not scope creep: it's the same list/detail split candidates already have, applied to roles for the first time now that roles have enough of their own detail to warrant it. The detail page: every field as a `PropertyRow` (same save-on-blur pattern as the candidate detail page), the linked client's name + live PH↔client clock (reusing the exact same `TimezoneClock` component the Clients pages use — not a second implementation), the JD-parse skills editor, every candidate currently linked to the role, and the role's status-change history.
  - **Live PH↔client clock** (`src/lib/talent-acquisition/timezone-clock.tsx`): computed from the client's stored IANA timezone string (e.g. `"America/New_York"`), not a stored UTC offset — an offset drifts with DST twice a year, the zone name doesn't. Updates every second via `setInterval`; deliberately does **not** call `setState` synchronously inside the effect body (`react-hooks/set-state-in-effect` — the state update happens inside the interval's own callback instead), trading up to a 1-second delay before the first real time appears for a lint-clean effect. Renders `null`/placeholder text on the server and fills in only after mount, avoiding a hydration mismatch from embedding a server-render-time timestamp that's already stale by the time the client hydrates. **Verified live, not just by the math**: created a real client with `timezone = "America/New_York"` — at the moment tested, the clock read "PH 6:28 PM · Northbridge Analytics 6:28 AM EDT," which checks out exactly (PH is UTC+8, so 18:28 PH = 10:28 UTC; EDT is UTC-4, so 10:28 UTC − 4h = 6:28 AM EDT).
  - **JD-parse-to-skills**: a "Parse JD" button on both the role create form and the role detail page's Skills section, reusing the job description text already typed/pasted into the form — no file upload, no new upload path. New `src/lib/talent-acquisition/role-jd-parse-core.ts` (`extractSkillsFromJobDescription` — the one new Anthropic call this feature makes, server-side only, same pattern as every other AI action in this app; `persistRoleSkills` — the role-scoped mirror of `resume-parse-core.ts`'s `persistCandidateSkills`, writing confident matches to `role_skills` and everything else to `role_skill_reviews`). **Reused rather than duplicated**: `resolveSkills` and `resolveEntity` (the alias-then-`pg_trgm` normalization pipeline built for resume parsing) needed zero changes to work for job descriptions too — that logic was already generic over "what org, what raw strings," with no candidate-specific behavior baked in. Skills render as the same editable/removable chips the New Candidate form's resume autofill already established (`role-skills-editor.tsx`), in two modes: staged-until-form-submit for a brand-new role (mirroring `createCandidate`'s staged skill chips exactly), or an explicit "Save skills" button for an existing role (since there's no single "create" step left to persist alongside). **Verified live with a real job description**: pasted a real JD for "Senior Backend Engineer" (Node.js, TypeScript, PostgreSQL, Docker, CI/CD, AWS, communication skills) — 4 skills auto-matched (Node.js, TypeScript, **Containerization** — "Docker" resolved through its existing alias, same behavior already confirmed for resume parsing — and CI/CD Pipelines), 3 correctly routed to review (PostgreSQL, AWS, Stakeholder Communication — none of which have configured aliases in this org's taxonomy yet). Confirmed the persisted skills survive a page reload.
  - **Client selector with inline "+ Create new client"** on the role create form, same pattern as the New Candidate form's "+ Create new role" (a sentinel `Select` value revealing an inline text field, submitted together with the rest of the form in one action) — not a second nested dialog.
  - **`role_history` logging on status change**: `updateRoleStatus` now also inserts a `role_history` row (`"Status changed to ${status}"`), non-fatal on failure (the status change itself already succeeded), same handling as `candidate_history`'s own insert in `updateCandidateStage`. Displayed on the role detail page's History section. **Verified live**: changed a real test role's status to "filled," reloaded the page, confirmed "Status changed to filled" appeared with today's date.
  - **Density**: no new stacked bordered cards anywhere in this task — the role/client detail pages both use the same `Section`/`PropertyRow`/`SectionDivider` primitives (14px body text, save-on-blur, hover/focus-only editing chrome) the candidate detail page's own density pass already established; the list pages' new "Details" link and client-name line are a single small `Button`/`span`, not new visual weight.
  - **Verified live via Playwright MCP, start to finish**: created a real client (Northbridge Analytics, `America/New_York`), created a real role linked to it with every new field filled in, ran Parse JD against a real job description and confirmed the resulting chips, confirmed the PH↔client clock's math, opened the role detail page and confirmed every field persisted plus the client link/clock/skills/history sections all render correctly, changed status and confirmed history logging, then deleted the test role through the UI and the test client via a direct REST call (no delete-client feature was built — matches this task's own scope, mirroring how `clients` shipped with no delete RLS policy either, the same "add one only once something actually needs it" choice `roles`/`candidates` originally made) — confirmed the Clients list is back to empty afterward. `tsc`/`eslint`/`vitest` (44 tests, unchanged — this task added no new pure-logic modules with their own test suite; the new modules are either thin Server Action wrappers or a UI component) all pass.
- **ATS_FEATURES.md Step 7 — time-in-stage and decline-reason metrics — built and verified live. This closes out all 7 steps of ATS_FEATURES.md.** New route `/talent-acquisition/metrics`, "Metrics" added as a fifth sidebar sub-item under Talent Acquisition Desk (`sidebar-nav.tsx`, same pattern as Board/Job Openings/Talent Bench/Rejected). No new schema, no new grants — both confirmed, not assumed: `candidate_history`/`candidates` are read-only here, and the existing blanket `grant select, insert, update, delete on all tables in schema public to authenticated, service_role` (`20260914060451_fix_grants_and_roles_delete_policy.sql`) already covers every table including these; their existing org-scoped RLS `select` policies already filter correctly with no extra `org_id` filter needed in the query, the same pattern every other list page (Talent Bench, Board) already relies on.
  - **Time-in-stage**: average days spent in each pipeline stage, computed purely from `candidate_history`'s existing `label`/`occurred_at` rows (`candidates-actions.ts`'s `updateCandidateStage` is the only writer, always inserting `"Moved to ${stage}"` — no separate from/to columns exist or were added). New pure module `src/lib/talent-acquisition/metrics.ts` (`computeTimeInStage`, DB-free, 6 vitest tests) reconstructs each candidate's stage timeline entirely from consecutive "Moved to X" events: the interval between one move and the next is attributed to the *first* event's stage. This has two deliberate, unavoidable blind spots given "no new schema" (ATS_FEATURES.md's own instruction): a candidate's creation-time stage is never counted (no history row marks *entering* it, only ones marking when they *left*), and a candidate's current stage is never counted (no "next" event exists yet to close the interval) — which is exactly the task's own "exclude the open-ended current stage" requirement, falling out naturally from the algorithm rather than needing a special case. A candidate that bounces back into an earlier stage contributes a separate completed interval each time; the UI copy says "N completed transitions," not "N candidates," to stay honest about what's actually being counted.
  - **Decline reasons**: a case-insensitive frequency count of `candidates.decline_reason` where `status = 'rejected'`, sorted by frequency descending (`computeDeclineReasonBreakdown`, also pure/DB-free, 3 vitest tests). Groups "Culture fit"/"culture fit"/"CULTURE FIT" together but displays whichever casing was seen first for that group, rather than guessing a canonical form.
  - **Kept genuinely simple per ATS_FEATURES.md's own note**: two `Section`s with `SectionDivider`-separated rows (the same "one card, internal dividers" pattern `roles-list.tsx` already established) — no charting library, no client component at all (the page is a plain async Server Component; nothing here needs interactivity). Density rules applied throughout: 14px row text, 12px/13px secondary text, tight `py-2` rows, no oversized headings.
  - **Empty states, not blank cards**: each section independently shows a specific explanatory message when it has no data yet — "No completed stage transitions yet — this fills in once a candidate has moved through at least two stages…" / "No rejections logged yet — this fills in once a candidate is declined with a reason…" — rather than an empty table or a generic "no data" line. Verified live via Playwright MCP by temporarily forcing both branches empty (reverted immediately after screenshotting) since this dev database currently has real data in both.
  - **Verified live via Playwright MCP** at 1280×800 and 390×844: real data renders correctly (6 stages with plausible non-negative averages, one real decline reason with its count), the "Metrics" sidebar link shows the active-state highlight correctly, both empty states render with their explanatory copy (not a blank card) at both viewport widths, and rows wrap cleanly at mobile width instead of clipping (the `flex-wrap` row pattern, not a bare `flex` row — see PROJECT_STATE.md §10's existing note on unwrapped rows silently overflowing). Confirmed `tsc`/`eslint`/`vitest` (44 tests, up from 33 — 11 new for `metrics.ts`) all pass.

### Fixed
- **PDF resume parsing throws `UnknownErrorException: bad XRef entry` in production for some PDFs — real bug, confirmed via `vercel logs` (not just the report's premise), partially mitigated; two of the three proposed options were investigated and rejected with reasons, not silently skipped.**
  - **Root cause, established by reading pdf-parse's bundled pdf.js source directly, not guessed:** `pdf-parse@1.x`'s `PDFJS.getDocument()` throws a plain `FormatError('bad XRef entry')` (from `XRef.fetchUncompressed`, inside `pdf.worker.js`) when a specific object's header doesn't match its cross-reference table entry — a genuinely malformed PDF, not an environment difference. pdf.js's own recovery-mode retry (`loadDocument(true)`, an `indexObjects()` brute-force rebuild) only triggers `if (ex instanceof XRefParseException)` — checked in **both** `v1.10.100` (pdf-parse's default) and `v2.0.550` (the other bundled version) — and a `FormatError` doesn't qualify, so no bundled version recovers from this specific failure mode. This happens inside document loading, before any page is ever fetched.
  - **Option 1 (`{ max: 0, version: 'default' }` / a custom `pagerender`) does not fix this, and can't — added anyway for explicitness, not because it changes behavior.** `version: 'default'` resolves to the exact same `'v1.10.100'` pdf-parse already defaults to (read directly from `lib/pdf-parse.js` — a literal no-op), and the crash happens inside `PDFJS.getDocument()` itself, before `pagerender` is ever invoked for any page — a `pagerender` override cannot run before the promise it would receive its input from has already rejected. Applied to `resume-text-extract.ts` as an explicit `PDF_PARSE_OPTIONS` constant regardless, so a future reader isn't tempted to add it thinking it's missing — but this alone does not and cannot fix the reported error.
  - **Option 2 (suppress `Buffer()` deprecation warnings via `process.env.NODE_NO_WARNINGS = '1'` in `next.config.ts`) — investigated per the task's own "check the established pattern first" instruction, and rejected. Not implemented.** This codebase has no precedent for mutating `process.env` from `next.config.ts` (checked — it's a 4-line default file, no `vercel.json` either) for good reason: `next.config.ts`'s module-scope code runs in the Next.js CLI/build process, not inside the deployed Vercel Function's own runtime process, so a `process.env` assignment there has no way to reach the environment the warning is actually logged from. Even if it did reach production, blanket-suppressing every Node deprecation warning app-wide to silence one cosmetic `Buffer()` message (which doesn't affect functionality — pdf-parse's own internal use still works, just via a deprecated constructor) would hide any future genuinely-actionable deprecation warning along with it. **Left as-is** — it's noise in the logs, not a bug.
  - **Option 3 (raw-byte `BT…ET` fallback extraction) implemented, but as a guarded last resort, not a blind fallback — because the naive version is a real data-integrity risk, not just a "crude but works" tradeoff.** Most modern PDF generators (the kind that produce real resumes) compress their content streams (Flate/LZW), and `BT`/`ET` text-operator markers only exist in **uncompressed** streams — against a compressed stream, the regex either finds nothing or matches coincidental byte sequences in binary noise. Feeding that noise into the downstream Anthropic structured-extraction call risks silently wrong candidate data (a hallucinated name/skill from garbage text) instead of today's existing clean "couldn't read this file, fill in manually" degradation — a worse outcome than the current failure, not a better one. Implemented in `resume-text-extract.ts` (`extractTextFromRawPdfBytes`) but gated behind `looksLikePlausibleResumeText` (requires ≥40 characters and >50% alphabetic characters) — if the fallback's output doesn't look like real prose, the original `pdf-parse` error is re-thrown and the existing graceful-degradation path (already built into `uploadStagingResume`/`parseResume`) takes over exactly as it did before this change, rather than accepting noise. Added `resume-text-extract.test.ts` (5 tests, pure/DB-free) covering both the plausibility guard and the extraction itself.
  - **Not verified against the actual file that triggered this in production** — `vercel logs` confirmed the error is real (`14:11:13`, `POST /talent-acquisition/board`) but doesn't capture which uploaded file caused it, and the staging file itself lives at an org/user/UUID-scoped Storage path with no filename recorded anywhere queryable from here. Re-tested `Andrea_Villanueva_Resume.pdf` locally (still extracts cleanly, the try/catch's happy path is unchanged) but that was never the file that failed. **This needs to be re-tested against production with the actual file that produced the original error** — if it's a compressed-stream PDF (the common case), expect the fallback's plausibility guard to correctly reject it and the user-facing behavior to stay exactly what it is today (graceful "fill in manually"), not a new success. This is a partial mitigation for a narrow class of malformed PDFs, not a guaranteed fix for this specific report.
- **New Candidate modal, two reported production bugs — one investigated and not reproduced, one real and fixed.**
  - **"PDF autofill fails in the New Candidate modal" — investigated, could not reproduce against current production or local code, no code change made.** The report assumed the modal's `uploadStagingResume` (`new-candidate-resume-actions.ts`) was a separate extraction path that hadn't picked up the `pdfjs-dist` → `pdf-parse@1.x` fix below. It isn't: both the modal and the candidate detail page's "Parse resume" button call the exact same `parseResumeAtPath` (`resume-parse-core.ts`) → `extractResumeText` (`resume-text-extract.ts`) chain — confirmed by reading both call sites, not assumed. `grep -rn "pdfjs-dist" src/` returns only comment mentions, no imports. `npm ls pdfjs-dist` and a `node_modules` search both confirm the package isn't installed at all. Checked the actual deployed state, not just the source: `vercel inspect` on the current aliased production deployment shows it was created 5 seconds after the fix commit (`7fd0e69`) was pushed — the fix is live in production, not pending. Re-tested locally via Playwright MCP anyway (`Andrea_Villanueva_Resume.pdf` through the New Candidate modal): name, skills, and location all pre-filled correctly with no error message. **If this is still reproducing in production, it needs a fresh manual repro with the actual error text/screenshot** — nothing in the current code or the live deployment explains the symptom as described.
  - **DOCX (and long-skill-list PDF) uploads in the New Candidate modal — skills chips overflowed the dialog with no way to scroll to them, including the header and the "Add candidate" submit button — fixed.** Root cause was worse than "chips overflow": `src/components/ui/dialog.tsx`'s shared `DialogContent` had no `max-height`/`overflow-y` at all, while `<body>` has `overflow-y: hidden` (standard modal-open scroll lock) — so once a dialog's content grew taller than the viewport, the excess (in this case, roughly equal parts off the top *and* bottom) was simply unreachable by any scroll gesture, not just visually clipped. Confirmed live via `getComputedStyle`/`getBoundingClientRect()` before fixing: the New Candidate dialog measured 844px tall in a 690px-tall test viewport, `overflow-y: visible`, `max-height: none`. Fixed at the shared primitive, not the New Candidate form specifically, since this is a systemic Dialog-sizing gap (same category as the skill-search combobox's missing Portal, fixed earlier) that any sufficiently long future dialog content would hit again: added `max-h-[calc(100vh-2rem)] overflow-y-auto` to `DialogContent`'s className, symmetric with its existing `max-w-[calc(100%-2rem)]`. Inert for every other `Dialog` in the app (`board-client.tsx`'s "Add a role", `roles-list.tsx`'s "Add a role", `admin/user-row.tsx`'s reset/delete confirmations) — all three have short, fixed-height content well under the new cap, checked by reading each usage, not assumed safe. Re-verified live via Playwright MCP at 1280×800 (dialog fits with the fix; before the fix the header and submit button were unreachable) and at two mobile heights, 390×844 (fits without scrolling) and 390×600 (correctly scrolls internally, background page stays fixed, "Add candidate" reachable at the bottom) — mobile scroll behavior confirmed unbroken, not just assumed from the CSS.
- **PDF resume parsing crashed production on Vercel — `ReferenceError: DOMMatrix is not defined` — fixed by dropping `pdfjs-dist` entirely.** The earlier Turbopack worker-resolution fix (below) only patched local dev; production crashed differently and earlier, at module evaluation time, because `pdf-parse@2.x` (what `resume-text-extract.ts` used via its `PDFParse` class) depends on `pdfjs-dist` internally, which imports browser canvas APIs the moment the module loads — no `workerSrc` configuration reaches that. Fixed by pinning `pdf-parse` back to the pure-JS `1.x` line (`^1.1.1`, resolving to `1.1.4` — the version ATS_FEATURES.md originally approved, with no `pdfjs-dist`/browser-API dependency at all) and reverting `resume-text-extract.ts` to `pdf-parse`'s plain function API (`const data = await pdf(buffer); data.text`), removing the now-unnecessary worker-setup workaround. `pdfjs-dist` no longer appears anywhere in `node_modules` after the version pin. Added `@types/pdf-parse` as a devDependency (the `1.x` line ships no types of its own). Re-verified locally via Playwright MCP — uploaded `Andrea_Villanueva_Resume.pdf` through the New Candidate form, extraction produced the same result as before the regression (name pre-filled, 15 skills matched/queued for review, location resolved to Quezon City). **Production verification on `client-fulfillment.vercel.app` still needs to be done manually after this deploys** — Playwright MCP can only reach localhost.
- **PDF resume parsing was completely broken under Turbopack dev — fixed.** `pdf-parse` (via `pdfjs-dist`)'s default worker-module resolution fails in Turbopack's dev SSR bundling (`Setting up fake worker failed: Cannot find module '.../pdf.worker.mjs'`), so every "Parse resume" attempt on a PDF errored out. Fixed in `src/lib/talent-acquisition/resume-text-extract.ts` by pointing `PDFParse.setWorker()` at an absolute `file://` URL resolved via Node's own `path`/`url` modules instead of relying on the broken relative lookup. Found and fixed while running `docs/PENDING_TESTS.md`'s resume-extraction section live, not caught by code review — this would have affected any real PDF upload. **Superseded by the fix above** — pdf-parse@2.x/pdfjs-dist is no longer used at all, so this workaround no longer exists in the code.

### Changed
- **`ANTHROPIC_WORKSPACE_ID` confirmed working — Prompt 8 draft generation, Prompt 3 resume parsing, and New Candidate resume autofill all verified end-to-end for real**, via Playwright MCP against the live dev server and database (`docs/PENDING_TESTS.md`, now resolved). Draft generation produces specific, role/stage-aware messages and persists correctly across reloads and repeated generations; resume parsing auto-matches the expected skills (including alias forms like RAG/CI-CD/n8n) and correctly routes ambiguous ones (LoRA, 52% similarity) to the review queue, with PDF and DOCX producing identical results; location normalization ("QC" → Quezon City) works in both the existing-candidate and New Candidate flows. One expectation in the original test plan was updated rather than treated as a bug: `tags` is no longer mirrored with confirmed skills, per the earlier density-pass task that removed `tags` from the candidate UI entirely. All test candidates/drafts/resume files created for this verification were cleaned up afterward. Still open: mirror `ANTHROPIC_WORKSPACE_ID` into Vercel's production environment variables.
- **Density pass applied to the sidebar, closing out the "other pages" density follow-up.** Narrowed `w-64`→`w-60` with tighter padding, freeing extra content-column width on every page (Board's 7 pipeline columns now visibly more comfortable); wordmark/greeting spacing tightened. Full-height sidebar fill re-confirmed unaffected. `/impeccable audit` scored 20/20 (Excellent) — full breakdown in PROJECT_STATE.md §4. This is the last of the eight follow-up surfaces (Board, Job Openings, Talent Bench, Settings, Admin, Login, Set Password, sidebar), each committed and audited separately.
- **Density pass applied to the Login and Set Password pages (`/login`, `/set-password`).** Both use the same compact auth Card treatment — `size="sm"` Card, display-type title, tightened form gaps. Verified via unauthenticated `curl` rather than a live screenshot (navigating there in the session used for every other page in this task just redirects to the board; signing out risked the session other pages still needed). `/impeccable audit` scored 20/20 (Excellent) on both — full breakdown in PROJECT_STATE.md §4.
- **Density pass applied to the Admin page (`/admin`).** Rebuilt from one Card per user into a single Section of divider-separated compact rows, with the invite form as a small subsection above them. Fixed a real mobile bug caught during verification: the email column and role/action controls fought for the same row at 375px, truncating emails mid-domain — fixed with a responsive `basis-full` so identity gets its own line below `sm`. `/impeccable audit` scored 20/20 (Excellent) — full breakdown in PROJECT_STATE.md §4.
- **Density pass applied to the Settings page (`/settings`).** Rebuilt from two stacked Cards into a single Section with an internal SectionDivider between "Company" and "Your profile"; the whole page now fits at 1440x900 with room to spare. Save-on-blur behavior and all existing a11y wiring (error states, aria-live "Saved" confirmation) preserved exactly. `/impeccable audit` scored 20/20 (Excellent) — full breakdown in PROJECT_STATE.md §4.
- **Density pass applied to the Talent Bench page (`/talent-acquisition/talent-bench`).** Cards tightened (padding, type scale), the card grid gained a 4th column at `xl`, and search + all four filters now sit in one compact flex-wrapped row instead of the search bar on its own line above them. `/impeccable audit` scored 20/20 (Excellent) — full breakdown in PROJECT_STATE.md §4.
- **Density pass applied to the Job Openings page (`/talent-acquisition/roles`).** "Add a role" moved into a Dialog (triggered by a small button) so it no longer permanently dominates the page; the role list rewritten from one Card per role to a single Section of compact table-like rows with SectionDivider between them, job description collapsed by default behind a text-preview disclosure toggle instead of an always-visible textarea. `/impeccable audit` scored 20/20 (Excellent) — full breakdown in PROJECT_STATE.md §4.
- **Density pass applied to the Board page (`/talent-acquisition/board`), first of the follow-up "other pages" prompt.** Built on the `PropertyRow`/`Section` primitives from the candidate detail page pass. Cards, columns, the candidate drawer, and the New Candidate dialog all tightened; more cards now fit per column at 1440×900. `candidate-card.tsx` padding/gap/type sized down; `board-client.tsx` column width/gap/padding/header tightened and the search bar/add button sized down; `candidate-drawer.tsx`'s Stage/Next action fields rebuilt on `PropertyRow` for the same hover-to-edit affordance; `new-candidate-form.tsx` gaps tightened. `/impeccable audit` scored 20/20 (Excellent) — full breakdown in PROJECT_STATE.md §4.
- **App-wide density pass, candidate detail page as the reference implementation.** The app had drifted toward reading as visibly AI-generated: oversized type, heavy padding, every field boxed in its own bordered input, and too many separate stacked cards. Fixed at the design-system level first, then applied to the candidate detail page; other pages are explicitly follow-up work, not touched here.
  - **New "Density" section in `DESIGN_SYSTEM.md`** (§5, canon; renumbered the two sections after it) and a matching section in `DESIGN.md` (kept in sync per its own "DESIGN_SYSTEM.md wins" rule) — locks in 14px body/UI text, 12px field labels, a ~20px page title (not the previous 24px+ display headline), 13–14px semibold section headings, tighter card/section padding, a "one card with internal Stone dividers" default over one card per subsection, and the properties-list pattern (small label left, plain value right, editing affordances on hover/focus only, Work Blue focus ring always). Colors, fonts, and the radius scale are unchanged.
  - **Two new shared primitives**, built for this page and meant for the follow-up pass on the rest of the app: `PropertyRow`/`propertyControlClass`/`propertySelectTriggerClass` (`src/components/ui/property-row.tsx`) implements the properties-list pattern — transparent border/background at rest, Stone border and a Select's chevron appearing only on hover or `:focus-within`, the Work Blue focus-visible ring never suppressed. `Section`/`SectionDivider` (`src/components/ui/section.tsx`) implements the single-card-with-dividers pattern with the new compact heading size.
  - **Candidate detail page rebuilt on these primitives.** Compact header: name, role, a `StageChip`, the due/overdue `StatusBadge`, and small inline actions (View/Replace resume, Parse resume, Reject) — Resume and Reject are no longer their own cards. Left column collapsed from four cards down to one `Section` ("Properties") using `PropertyRow` for all eleven editable fields (stage, role, source, communication, location, years of experience, last role, last company, employment status, notice period, expected compensation) plus admin-only assignment, with Notes as a small textarea below the list. Right column tabs renamed/reorganized: **Skills & Fit** now shows the actual matched skills (Growth Green chips), missing required skills (neutral outline chips), and other confirmed skills (neutral secondary chips) — not just a "2 of 4 matched" count — followed by the Needs Review queue and the job description (collapsed by default, expandable); **Outreach** merges the Next Action script and the AI Suggested Message generator, since both answer "what do I send this person"; **Scorecards** and **History** are unchanged in function.
  - **Every field, button, and Server Action preserved exactly** — this was a layout/density change, not a feature change. Re-verified every accessibility property from the earlier Impeccable passes on the new layout, not just assumed carried over: all eleven property controls kept their `aria-label`s, the Work Blue focus-visible ring was confirmed live (not just present in the className) on both a `Select` trigger and a plain `Input` inside a `PropertyRow` via real keyboard focus, and hover was confirmed live via a real `:hover` state (not simulated) to show the Stone border and Select chevron appearing only then, never at rest.
  - **Two small bugs caught and fixed during verification**: a `Select`'s value span silences its own `line-clamp-1` ellipsis once given `display:flex` (a pre-existing quirk of the `@base-ui/react` primitive, more visible now that PropertyRow columns are narrower) — fixed by forcing block-level `text-overflow:ellipsis` truncation on that inner span specifically in `propertySelectTriggerClass`, and added `truncate` to `propertyControlClass` for the equivalent `Input`/placeholder case.
  - **Verified live via Playwright MCP** at 1440×900, 1280×800, and 375px: confirmed the left "Properties" panel fits entirely within one 1440×900 viewport with no scrolling (`getBoundingClientRect()`: panel bottom at y≈794 of 900), confirmed all four tabs still switch correctly, confirmed a candidate with both matched and missing required skills (2 of 4 matched for "AI Solutions Engineer") shows both chip types correctly (Python/TypeScript in Growth Green, Customer Support/Project Management in neutral outline, Backend Development as an unrelated "other confirmed" chip). Confirmed `tsc`/`eslint`/`vitest` all pass.
  - **Checked the sidebar's full-height fill** (a specific concern raised alongside this task) and found it already correct, not a live bug: `aside`'s `offsetHeight` matched `document.documentElement.scrollHeight` exactly on every page/viewport-height combination tested (a short page at 900px tall, a taller page forced to scroll at 500px viewport height, both at 1440px width) — confirmed visually via full-page screenshots showing the navy fill reaching the bottom of the actual content in both cases. No fix applied since nothing reproduced; documented as checked rather than silently left alone.
- **Tags removed from the candidate UI** (detail page and New Candidate form) — confirmed skills (`candidate_skills`) are now the structured source for "what does this candidate know," making the old free-text Tags field redundant with real structured data. The `tags` column stays in the schema (no destructive migration) and is simply no longer read or written by the app.
  - **`updateCandidateTags` Server Action removed** (no remaining caller) and the resume-autofill flow's `mergeTagsWithSkillNames` helper removed along with it — confirmed skills from a parsed resume go to `candidate_skills` only now, never mirrored into a tags string, on both the candidate detail page's existing parse flow (which never touched tags) and the New Candidate form's staged-resume flow (which did, until this change).
  - **Board and Talent Bench search switched from reading `tags` to reading confirmed skill names** (`candidate_skills` → `skills.name`, joined the same way Talent Bench's card grid already did) — `board/page.tsx` gained the same "fetch all `candidate_skills` rows, group by candidate" query Talent Bench's own page already used, and `board-client.tsx`'s search haystack swapped `c.tags` for `...c.skills`. Search placeholders updated ("Search by name, role, or skill…" / "Search by name or skill…") to match. Verified live: searching "typescript" on the board correctly isolated the one candidate with that confirmed skill and zeroed out every column without it.
  - **Verified live via Playwright MCP**: confirmed the Tags field is gone from both the candidate detail page and the New Candidate form dialog, confirmed board search by skill name works, confirmed `tsc`/`eslint`/`vitest` (28 tests — 4 fewer than before, the retired `mergeTagsWithSkillNames` test cases) all pass.
- **Candidate detail page restructured into a persistent-left / tabbed-right layout**, replacing the single column of nine stacked cards that had accumulated over several prompts and required heavy scrolling to reach anything below the fold. Structural fix, not a spacing tweak: only one tab's content renders at a time now, which is what actually reduces scroll height — not tighter padding.
  - **Left column (`lg:grid-cols-[1fr_2fr]`, stacks full-width below `lg`)**: name/header/status badge/reject action, the "Candidate" card (stage, role, source, communication rating, location, the six Talent Bench fields, notes, tags, admin-only assignment), "Job description" (now collapsed via a new `JobDescriptionPanel` client component with a "Show more"/"Show less" toggle past ~180 characters, rather than always showing the full text), "Resume" (upload + parse), and "Next action" (the stage script). This column stays visible across every tab — it never re-renders or scrolls out of view when switching tabs.
  - **Right column: a new `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` primitive** (`src/components/ui/tabs.tsx`, built on `@base-ui/react/tabs` — the same headless library `select.tsx`/`dialog.tsx` already use in this app, not Radix) with four tabs: Skills (confirmed-skills match count + the Needs Review panel), Scorecards (the interview scorecard form + history), Suggested Message (the AI draft generator), History (the activity log). Every field, button, and Server Action from the previous single-column layout still exists and works identically — this was a pure reorganization.
  - **Every `Select` in `candidate-detail-form.tsx` got an explicit `w-full`** on its trigger — the previous single ~768px-wide card gave `Select`'s default `w-fit` trigger plenty of room, but the new left column is roughly a third of that width, and two of the longer-content triggers ("AI Solutions Engineer" for Role, "Communication: Not rated" for Communication) were measurably overflowing their grid cell by 25–58px before this fix (`getBoundingClientRect()` confirmed both before and after).
  - **Fixed a real a11y regression caught during keyboard verification, not shipped**: `TabsContent` initially had a bare `outline-none` with no replacement focus style, so tabbing from the tab list into a panel's content landed focus somewhere invisible. Added `focus-visible:ring-3 focus-visible:ring-ring/50` (the same Work Blue ring convention every other focusable control in this app uses) to the panel itself.
  - **Fixed a real mobile overflow bug caught during responsive verification, not shipped**: the tab list (`inline-flex w-fit`) was wider than its card at 390px width and got silently clipped — "History" wasn't reachable by sight at all, only by blindly tabbing past it. Changed `TabsList` to `flex w-full flex-wrap`, so at narrow widths all four tabs wrap onto a second row instead of being cut off, while staying a single row at desktop widths where there's room.
  - **Verified live via Playwright MCP** at desktop (1440px) and mobile (390px): confirmed all four tabs switch content correctly via both click and keyboard (`ArrowRight` moves focus between tabs with a visible ring, `Enter` activates — the standard WAI-ARIA manual-activation tabs pattern, not a bug), confirmed the left column never changes or disappears while switching tabs, confirmed the `Select` overflow and `outline-none` and tab-list-clipping issues above by reproducing each live before fixing it and re-verifying after. Confirmed the "Show more"/"Show less" job description toggle against a real role temporarily given a long description via REST (reverted afterward — no test data left behind). Confirmed `tsc`/`eslint`/`vitest` (32 tests) all pass and `git status` shows exactly the expected changeset (two files modified, two new: `job-description-panel.tsx`, `components/ui/tabs.tsx`).
- **Sidebar restructured: "Talent Acquisition Desk" is now a parent section with four permanently-visible sub-items** — Board, Job Openings, Talent Bench, Rejected — instead of a single link. The parent is now a plain (non-link) section label, since "Board" is its own sub-item pointing at the exact destination the parent link used to; sub-items are indented under it and use the same active/inactive treatment (`bg-sidebar-accent`) the old single item used, just per-item now. No collapsible toggle — four items is small enough that a toggle would only add a click to reach navigation that's currently one click away, and this is the only module with sub-items today. Same `SidebarNav` component renders both the desktop sidebar and the mobile slide-out `Sheet`, so both picked up the change from one edit.
  - **"Manage roles" renamed to "Job Openings" everywhere it appeared in the UI** — the underlying `roles` table/route are untouched (this was scoped as a display-label change only, not a schema rename); the sidebar sub-item is now the only place this label lives, since the old header link it renamed is gone (see below).
  - **"Rejected" reuses Talent Bench pre-filtered to `status=rejected`, instead of a second archive page.** The standalone `/talent-acquisition/rejected` page built for the earlier reject-flow prompt showed exactly the same information Talent Bench already can with its own status filter, so it's deleted — the sidebar's "Rejected" item links to `/talent-acquisition/talent-bench?status=rejected`, and a new status filter dropdown (Active + rejected / Active only / Rejected only) was added to Talent Bench's existing filter row to make that pre-applied filter visible and changeable.
  - **Removed the now-redundant "Talent Bench" / "View rejected" / "Manage roles" header links from the board page** — all three now live in the sidebar, so keeping them on the board too would have been duplicate navigation in two places.
  - **Fixed a real bug found during verification**: clicking "Rejected" then "Talent Bench" (or vice versa) didn't actually change the active filter the second time — both sidebar items point at the same route differing only by `?status=`, so Next.js reuses the existing client component instance instead of remounting it, and `useState(initialStatus)` only ever applies its initial value once, on first mount. Fixed by re-deriving the filter state from the `initialStatus` prop during render when it changes (the same during-render-not-in-an-effect pattern `mobile-nav.tsx` already uses for closing the Sheet on route change) rather than assuming a prop passed once at mount is the only way the filter gets set.
  - **Verified live via Playwright MCP** at desktop and mobile widths: confirmed all four sub-items are reachable and correctly labeled from both the desktop sidebar and the mobile `Sheet` (which auto-closes on navigation, unaffected by this change); confirmed each sub-item shows the active-state highlight only on its own matching page — including verifying, after the state-reset fix, that switching directly between "Talent Bench" and "Rejected" (no full page reload) correctly updates both the sidebar's active indicator and the status filter dropdown's value each time, in both directions. Confirmed the board page no longer shows any of the three removed header links. Confirmed `tsc`/`eslint`/`vitest` (32 tests) all pass and `git status` shows exactly the expected changeset (`rejected/` deleted, five files modified).

### Added
- **Six new candidate fields + a "Talent Bench" roster view.** Migration `20260922160000_add_talent_bench_fields.sql` adds `years_experience` (numeric), `last_role`/`last_company` (text), `employment_status` (text, `check in ('employed','open_to_opportunities','immediately_available','freelance_contract')`), `notice_period` (text, `check in ('immediate','2_weeks','1_month','2_plus_months')`), and `expected_compensation` (free text — deliberately not a structured number, since compensation here spans PHP/USD and monthly/annual framing) to `candidates`. All six are optional, editable fields on the candidate detail page, styled and wired exactly like every other field there (save-on-blur text inputs, save-on-change `Select`s with a "Not set" sentinel). No new grants needed — confirmed by inspection, not assumed: these are new columns on an existing, already-fully-granted table, and the existing "candidates: update within org" RLS policy already covers any column on the row.
  - **New `/talent-acquisition/talent-bench` route**: a responsive card grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, not a kanban board) showing *every* candidate on file — active and rejected both — unlike the main board, which filters to `status = 'active'` only. Each card shows name, `last_role @ last_company`, years of experience, employment status, notice period, source platform, communication rating (if set), up to 4 confirmed skill chips (from `candidate_skills`, with a `+N` overflow badge), and a stage/status indicator. Reached via a new "Talent Bench" link in the board's header, alongside "View rejected" and "Manage roles."
  - **New `StageChip` component** (`stage-chip.tsx`) — deliberately *not* a reuse of `StatusBadge`, which encodes cadence *urgency* (overdue/soon/on-track/parked) that has no meaning here. `StageChip` is pure stage *identity*: the candidate's current stage label (reusing the same `BOARD_STAGES` mapping already fixed for the Stage dropdown's closed-state display bug) in a neutral outline tone, or a visually distinct destructive-toned "Rejected" badge when `status === 'rejected'`.
  - **Filters + search, kept simple per the task's own ask**: dropdown filters for employment status, notice period, and source platform, plus a minimum-years-experience number input and a search box matching the board's existing name/tag search pattern (extended here to also match confirmed skill names) — no faceted-search system, all client-side filtering over the full candidate list.
  - **Clicking a card navigates straight to the existing candidate detail page** — no second detail view was built.
  - **Verified live via Playwright MCP**, including the migration itself: since Claude Code has no DB credential to apply migrations (the standing limitation noted throughout this project), the user ran `supabase db push --db-url` for this one while I held off wiring any query to the new columns — confirmed live via REST (including the `employment_status` check constraint correctly rejecting an invalid value) before touching the candidate detail page's `SELECT`, to avoid a window where that page could 404 for every candidate. Filled in all six fields on a real candidate through the UI and confirmed each persisted via REST. Confirmed the Talent Bench grid renders all 4 test candidates including a rejected one (shown with the red "Rejected" `StageChip`, the other three in neutral stage-label chips); confirmed the employment-status filter, the skill-based search ("typescript" correctly matched only the candidate with that skill chip), and the minimum-years filter each narrow the grid correctly; confirmed clicking a card navigates to that candidate's existing detail page. Confirmed via keyboard `Tab` navigation + `getComputedStyle` that a focused card shows the same Work Blue border + 3px ring as every other focusable card in the app (`candidate-card.tsx`'s established `has-[:focus-visible]` pattern, reused verbatim). Confirmed the grid degrades to a single column on a 375px viewport with no horizontal cramping, and that the new "Talent Bench" header link wraps cleanly next to "View rejected"/"Manage roles" at that width too.
  - **Incidentally discovered, not introduced by this task, and left unfixed pending its own follow-up**: this candidate detail page's save-on-blur fields can lose an edit if two different fields are edited in rapid succession with no pause between them (e.g., scripted/very fast Tab-driven form filling) — reproduced with two *pre-existing* fields (Notes then Tags) as well as two of this task's new fields, so it's a latent issue in the shared save-on-blur pattern itself, not something these six fields introduced. See the `docs/PROJECT_STATE.md` note for a working theory and a flagged follow-up.

### Added
- **ATS_FEATURES.md Step 6: decline/reject flow.** A "Reject candidate" action on the candidate detail page — sets `candidates.status` to `'rejected'` and requires a non-empty decline reason, entered via an inline `Textarea` that appears when the button is clicked. Rejected candidates are filtered off the main board (`board/page.tsx` now queries `.eq("status", "active")`) but never deleted — a new `/talent-acquisition/rejected` archive page (reached via a "View rejected" link next to "Manage roles," the same header-link pattern the roles page already established rather than a permanent sidebar entry) lists every rejected candidate with their decline reason and last stage before rejection (rejecting never touches `stage`, only `status`, so it stays exactly where they were).
  - **`rejectCandidate` Server Action** (`candidates-actions.ts`) validates the decline reason is non-empty **server-side**, not just in the client form — per SECURITY.md's boundary-validation rule, a client-only check can always be bypassed by calling the action directly. Verified this is real, not just written: temporarily stripped the client-side guard, submitted an empty reason through the live UI, and confirmed the server action itself returned "A decline reason is required." and wrote nothing (checked via REST) — then restored the guard.
  - **No new migration or grants needed** — `candidates.status`/`decline_reason` and their check constraint (`status in ('active','rejected')`) already existed from the Step 1 schema migration; `rejectCandidate` is a plain `UPDATE` through the existing RLS-scoped client, same authorization shape as every other plain candidate-field update in this file.
  - **No "unreject" action was built** — out of scope for what was asked (add a reject flow + a way to view rejected candidates); the rejected-candidates page is read-only with a link back to the full candidate detail page for anyone who needs to dig further.
  - **Verified live via Playwright MCP**: rejected a real test candidate ("Gil Demiar," at the Interviewing stage) with a real decline reason, confirmed via REST that `status` became `rejected`, `decline_reason` was saved exactly as entered, and `stage` stayed `interviewing` (untouched). Confirmed the candidate immediately disappeared from the board's "Interviewing" column (count dropped from 1 to 0) and from the board's candidate list entirely. Confirmed the new `/talent-acquisition/rejected` page lists them with the correct role, "last stage: Interviewing," and the full decline reason, and that the link to the full candidate detail page still works (record not deleted, still fully viewable).

### Fixed
- **Placeholder text in every input/textarea across the app rendered visually identical to real typed content** — same weight, same near-black color — making an empty field showing a hint indistinguishable from a field with real text already in it. Root cause: `Input`/`Textarea` both set `placeholder:text-muted-foreground`, but `--muted-foreground` resolves to the exact same value as `--foreground` (both `--color-slate-text`) in this app's theme tokens, so placeholder and real text were never actually different colors to begin with.
  - **Fixed once, globally, in `globals.css`** — a single `::placeholder { color: var(--color-slate-text); opacity: 0.45; }` rule, deliberately left **unlayered** (outside any `@layer` block) so it wins over the `placeholder:text-muted-foreground` Tailwind utility class regardless of specificity or source order, per the CSS Cascade Layers spec (an unlayered normal-priority rule always beats a layered one). This means every placeholder in the app is fixed by this one rule with no changes needed to `Input`, `Textarea`, or any of the ~15 call sites that pass a `placeholder` prop — not a per-field fix.
  - **Audited every page named in the task** (board, roles, candidate detail including the new Resume/Skills/Scorecard cards, settings, admin, login, set-password) by `grep`ing every `placeholder=` usage across the app and confirming each one routes through the shared `Input`/`Textarea` components — none bypass them with a raw `<input>`/`<textarea>`, so there was exactly one place this needed fixing.
  - **Verified live via Playwright MCP**: screenshotted three separate empty placeholders across two different pages (the board's search field; the candidate detail page's Tags field and the new scorecard's Notes field) and confirmed each renders clearly, obviously lighter than the page's real ink-navy/slate-text content. Typed real text into the candidate detail page's Notes field and screenshotted it directly alongside the still-empty Tags field's placeholder in the same viewport — the contrast between the solid typed text and the visibly lighter placeholder is immediate and unambiguous, not subtle.

### Added
- **ATS_FEATURES.md Prompt 5: interview scorecards on the candidate detail page.** New "Interview scorecards" `Card` (between "Skills" and "Next action") with a form to record a new interview (1–5 rating, notes) and a list of past scorecards for the candidate — rating (shown both numerically and as a five-dot indicator), notes, the stage the candidate was at when the interview happened, interviewer name, and date, newest first.
  - **`addScorecard` Server Action** (`scorecard-actions.ts`), same auth/org-check shape as every other plain-write action in this app: `requireUser()` re-derives the caller via `getUser()`, never a client-passed id. **`stage_at_review` is re-derived server-side from the candidate's actual current `stage` column** — never trusted from the client — via the same scoped `SELECT` that also serves as the authorization-beyond-RLS check for `candidateId` (candidates' own select policy already scopes rows to the caller's org, so a foreign-org `candidateId` simply resolves to no row and fails closed, the same shape as `assertRoleIsVisible`/`assertLocationIsVisible` in `candidates-actions.ts`). `interviewer_id` is always the authenticated caller's own id, never client-supplied.
  - **No update/delete action exists, deliberately** — `interview_scorecards`' RLS policy (added in the Step 1 schema migration) only grants `select`/`insert`, with its own comment calling the table "append-only." This Server Action mirrors that: once submitted, a scorecard is a permanent record of what was recorded during that interview, not something anyone edits after the fact.
  - **No new grants or migrations needed** — `interview_scorecards` and its RLS policies already existed from the Step 1 schema migration (`ATS_FEATURES.md`'s scorecard table was scaffolded well ahead of this UI); confirmed live and queryable via a direct REST call before writing any code, not just assumed from the migration file.
  - **Styled entirely from existing DESIGN_SYSTEM.md tokens** — reused the page's `Select`/`Textarea`/`Button` components and `text-xs uppercase tracking-wide text-muted-foreground` section-label convention; the five-dot rating indicator uses `bg-work-blue` for filled dots and a bare `border-border` outline for empty ones, no new colors introduced.
  - **Verified live via Playwright MCP** (session already authenticated): submitted a real scorecard (4/5, with notes) against a live candidate at Talent Pool stage, confirmed the UI rendered the new entry immediately with the correct rating, notes, snapshotted stage label, and interviewer display name — then independently confirmed via a direct REST query against `interview_scorecards` that the actual row matched exactly (`rating: 4`, correct `notes`, `stage_at_review: "talent_pool"`, `interviewer_id` matching the logged-in user), not just a UI-only transition. Confirmed the "Add scorecard" button carries the same Work Blue focus ring as every other control on this page via `getComputedStyle` after a real `.focus()`. Confirmed clean rendering at 375px with no overflow.

### Fixed
- **"Map to different skill" search dropdown (Prompt 4's `skill-reviews-panel.tsx`) was clipped by its parent Card.** Root cause: the dropdown was a hand-rolled `<ul>` positioned with `absolute top-full`, relying on its parent's `position: relative` — any ancestor with a constrained box (here, the Card) clips content positioned that way, the same underlying category of bug as the board's earlier scroll-clipping issue, just manifesting as clipping instead of scrolling. It was never actually a Radix/Base UI `Select` — this combobox is a fully custom ARIA `listbox` built from scratch (documented in `PROJECT_STATE.md` §10), so there was no `Portal` primitive being skipped, just none being used at all.
  - **Fix**: portaled the results `<ul>` to `document.body` via `react-dom`'s `createPortal`, positioned with `position: fixed` computed from the search input's `getBoundingClientRect()` (tracked in a `ref`), recomputed on `scroll`/`resize` while open so it stays pinned to the input as the page scrolls.
  - **Checked every other combobox/select added since the original shadcn/Base UI setup for the same bug shape** — `grep`'d for `role="listbox"` and `aria-autocomplete` across the whole app; this hand-rolled combobox is the *only* one. Every other `Select` in the app (Stage, Role, Source, Communication, Location, Assigned to, and the new scorecard Rating select above) already goes through `@base-ui/react/select`'s own `SelectPrimitive.Portal` — confirmed by reading `components/ui/select.tsx` directly rather than assuming — so none of them had this bug.
  - **Verified live via Playwright MCP** (session already authenticated): opened a pending skill review's "Map to different skill" combobox and typed to trigger the results list — confirmed via screenshot that the list now renders fully below the input instead of being cut off at the Skills card's boundary, and confirmed via an accessibility snapshot that the `listbox` element is now a direct sibling of `main` (portaled to `document.body`), not nested inside the Card. Selected a real skill from the now-unclipped list and confirmed via REST that the underlying `mapSkillReview` write still worked exactly as before the fix (`status: "confirmed"`, `suggested_skill_id` updated to the newly-chosen skill) — the positioning fix made no behavioral change to the combobox's selection logic.

### Added
- **ATS_FEATURES.md Prompt 4: "Needs Review" panel + required-skills overlap indicator on the candidate detail page.** New "Skills" `Card` (between "Resume" and "Next action") showing, for each `pending` `candidate_skill_reviews` row: the raw extracted text, the suggested skill and its similarity score as a `Badge` (or a plain "No match — possibly a new skill" badge when there wasn't one), and three actions — **Confirm** (only shown when there's a suggestion), **Reject**, and **Map to different skill** (a searchable combobox over every org skill). Also shows "N of M required skills matched for `<role title>`" when the candidate has an assigned role with at least one `role_skills` row.
  - **Three new Server Actions** (`skill-review-actions.ts`): `confirmSkillReview`, `rejectSkillReview`, `mapSkillReview`. Plain DB reads/writes with no external side effect (no third-party API call, no Storage write) — RLS's org scoping is the authorization boundary, the same shape as `candidates-actions.ts`'s stage/notes/tags updates, not the authorization-beyond-RLS pattern `uploadResume`/`parseResume` need. The one thing that *does* need an explicit check beyond RLS: confirm/map both reuse `persistCandidateSkills` (from the resume-parse-with-autofill refactor) to re-verify the target `skillId` is actually visible to the caller's org before writing it into `candidate_skills` — `candidate_skills`' own RLS policy only checks the candidate row's org, not the skill row's.
  - **Reject is a status update (`'rejected'`), never a delete** — matches the schema's own shape (`candidate_skill_reviews` has no delete RLS policy, by design) and keeps a full audit trail of what was reviewed and rejected, not just what was confirmed.
  - **Map to a different skill also updates `suggested_skill_id`** to the skill it actually ended up linked to, not just `status` — keeps the row an accurate record of the final outcome rather than preserving what may have been a wrong original suggestion.
  - **Checked whether any new grants were needed — none are.** No new tables or columns: `candidate_skill_reviews` already has select/insert/update RLS (Step 1's schema migration), `candidate_skills` already has select/insert, `skills` already has select — every write this panel makes goes through policies and `ALTER DEFAULT PRIVILEGES` grants that already existed before this task.
  - **Searchable combobox built on `@base-ui/react`'s already-installed `Input`, not a new dependency** — a lightweight custom ARIA combobox (`role="combobox"`/`listbox`/`option`, `aria-activedescendant`, arrow-key navigation, Enter to select, Escape to close) rather than the library's own `Combobox` primitive, which this app hadn't used before and would have meant wrapping a much larger, unfamiliar API for one relatively simple "type to filter, pick one" interaction. Options are real `<button>`s with `tabIndex={-1}` — not independent tab stops, per the ARIA combobox pattern (selection via `aria-activedescendant` while focus stays on the input), the same reasoning already applied to the hidden file input elsewhere on this page.
  - **Styled entirely from existing DESIGN_SYSTEM.md tokens** — reused `Badge` (`secondary` for a suggestion, `outline` for "no match"), `Button variant="outline" size="sm"` for all three actions (matching every other secondary action on this page), and the page's established `text-xs uppercase tracking-wide text-muted-foreground` section-label convention for "Needs review." No new colors or components introduced.
  - **Verified live via Playwright MCP** (session already authenticated): since no real `candidate_skill_reviews` rows exist yet (Step 3's live parsing is still blocked on `ANTHROPIC_WORKSPACE_ID`), manually inserted three test rows via a direct REST call (service-role key) for one candidate — one with a confident suggestion (to test Confirm), one with a suggestion (to test Reject), and one with no suggestion (to test Map). Confirmed all three actions against real database state, not just UI transitions: **Confirm** — clicked, row disappeared from the panel, confirmed via REST that the review's `status` became `confirmed` and a real `candidate_skills` row was inserted with the suggested skill. **Reject** — clicked, row disappeared, confirmed via REST that `status` became `rejected` with no `candidate_skills` write. **Map** — opened the combobox, typed to filter (confirmed live filtering, including a search for a skill this org's `skills` table turned out not to have — a genuine empty-results case, not a bug), selected a different skill via click, confirmed via REST that `status` became `confirmed`, `suggested_skill_id` was updated to the newly-chosen skill (not the original null), and a matching `candidate_skills` row exists. **Overlap indicator** — seeded `role_skills` for a role (4 skills) via REST, assigned that role to the test candidate, reloaded, and confirmed the page correctly read "2 of 4 required skills matched for AI Solutions Engineer" (exactly the 2 skills confirmed above). Confirmed via `getComputedStyle` after a real `.focus()` that the combobox's action buttons carry the same Work Blue focus ring token as every other control on this page. Confirmed clean rendering at 375px with no overflow.
### Fixed
- **Stage dropdown showing the raw stage value (e.g. `phone_screen`) instead of its label ("Phone Screen") in its *closed*, collapsed state** — the open dropdown's option list was already correct (confirmed by an earlier screenshot: all seven stage labels render properly once opened); the bug was isolated to the trigger's own display. Root cause: both Stage `Select`s (`candidate-detail-form.tsx` and the board's `candidate-drawer.tsx`) used a bare `<SelectValue />` with no children render-prop, unlike every other `Select` already in this app (Role, Source, Communication, Location, Assigned to) — all of which pass `<SelectValue>{(value) => labelFor(value)}</SelectValue>`. Base UI's `Select.Value` has no way to know the selected item's rendered label without that render-prop; it falls back to displaying the raw underlying value. Fix: added a `stageLabelFor` helper (mirroring the existing `roleLabelFor`/`locationLabelFor` pattern in each file) and wired it into both Stage triggers the same way.
  - Searched the rest of the app for the same bug shape (`grep`'d every `<SelectValue>` usage) — confirmed no other instance of a bare, label-less `<SelectValue />` exists; this was isolated to exactly the two Stage dropdowns.
  - **Verified live via Playwright MCP** (session already authenticated): opened a candidate whose stage is Phone Screen on `/talent-acquisition/candidates/[id]` and confirmed the *closed* Stage dropdown reads "Phone Screen" before ever being clicked open (screenshot). Opened the same candidate's card on the board and confirmed the drawer's Stage dropdown shows the same correct closed-state label (screenshot). Confirmed via `tsc`/`eslint`/`vitest` (32 tests, unaffected) that nothing else in the diff changed — a two-line fix in each of two files, no behavioral change to `handleStageChange`/`updateCandidateStage` or the option list itself.

### Added
- **Resume-upload-with-autofill on the New Candidate form** — extends Prompt 3's parsing pipeline to candidate *creation*, not just an existing candidate's detail page. Split Step 3's extraction logic into a reusable "parse" step (raw text extraction + AI structuring + alias/pg_trgm normalization — no `candidate_id` needed) and a "persist" step (writes to `candidate_skills`/`candidate_skill_reviews`/`location_id` against a real one), so the New Candidate form can parse a resume *before* a candidate row exists, using a staging path instead.
  - **Refactor**: `resume-parse-core.ts` (new, plain module — not `"use server"`, since it exports pure synchronous helpers a `"use server"` file would silently strip, per the established gotcha in `PROJECT_STATE.md` §10) now holds `parseResumeAtPath` (the pure parse), `persistCandidateSkills` (the persist step), and the extraction/normalization internals. `resume-parse-actions.ts`'s `parseResume(candidateId)` is now a thin wrapper over these two — **same contract, same return shape, unaffected by this change**, confirmed by leaving its own behavior untouched in code and re-verifying its 8 pre-existing normalization vitest cases still pass unmodified.
  - **Staging upload**: a new `uploadStagingResume` Server Action (`new-candidate-resume-actions.ts`) uploads to `<org_id>/staging/<user_id>/<uuid><ext>` in the same private `resumes` bucket — no candidate exists yet, so it can't use `uploadResume`'s `<org_id>/<candidate_id>/...` convention. **Checked whether this needs new grants or RLS policies — it doesn't, confirmed by re-reading the policy, not assumed**: `"resumes: select/insert within org"` only regex-guards-then-compares the *first* path segment against `current_org_id()`; it never inspects anything after that, so a `staging/<user_id>/<uuid>` tail is already covered by the exact same policy `uploadResume` uses, with zero changes. Verified for real, not just by inspection: uploaded a live test file through the New Candidate form and confirmed via a direct Storage REST call that it landed at exactly the expected staging path.
  - **On upload, the form calls the parse step immediately** (not a separate explicit trigger, unlike the detail page's "Parse resume" button) — this task's own instruction, since the entire point here is one-shot autofill convenience during creation; the detail page's separate-button design stays exactly as it was, since the concern that motivated it (parsing an *existing* candidate's resume shouldn't silently auto-fire and spend an API call) doesn't apply the same way to a staging upload whose only purpose is to prefill a form that hasn't been submitted yet.
  - **Graceful degradation when the parse fails but the upload succeeded** (the actual, currently-live case — see the BLOCKED item below): the form shows "Uploaded, but couldn't read details from it — you can still fill in the rest manually," keeps the staged path so the file still attaches on submit, and the rest of the form behaves exactly like manual entry. Confirmed live, not theoretical — see verification below.
  - **Skill chips**: matched and needs-review skills render together (no separate queue makes sense before a candidate exists), visually distinguished per this task's ask — confident matches as solid Growth Green pills, needs-review items as outlined Sun-Gold-bordered pills with a "needs review" label (Sun Gold used only as a border/text accent, never a fill, per `DESIGN.md`'s Five Percent Rule already documented for this app's status badges). Each chip is a real, editable, removable, focusable `<input>` plus a remove `<button>` with a `focus-visible:ring-2 ring-ring/50` treatment — not static text.
  - **Editing a chip's text downgrades it to "needs review" server-side, never trusting a client-computed "was this edited" flag**: `finalizeSkillChips` (pure, in `resume-parse-core.ts`) re-derives edited-vs-unedited by comparing `currentText` against the original `rawText` itself, comparing case/whitespace-insensitively. An untouched confident match persists into `candidate_skills` directly; anything edited, removed, or already-review persists into `candidate_skill_reviews` instead (with its suggestion dropped if it was the edited one — an edited string is no longer guaranteed to mean the skill it was originally matched against).
  - **`createCandidate` (`candidates-actions.ts`) extended, not replaced**: three new optional `FormData` fields (`staged_resume_path`, `skills_json`, `location_id`), all `null`/absent for plain manual entry, so **that path is byte-for-byte unaffected** — confirmed by re-running the exact same "no resume touched" flow live (see verification below) and by every pre-existing test still passing. On submit: `location_id` is re-verified visible to the caller's org (`assertLocationIsVisible`, the same shape as the existing `assertRoleIsVisible` for `role_id`) before being accepted; `staged_resume_path`'s leading org segment is checked against the caller's own `profiles.org_id` before being trusted as `resume_path` — a client-supplied storage path is exactly the kind of input SECURITY.md's authorization-beyond-RLS rule means, so it isn't accepted blindly, and a path that fails the check is silently dropped (no resume attached) rather than failing the whole candidate creation.
  - **Confirmed skill names mirror into the `tags` column**, merged (not overwritten) with whatever the recruiter already typed, case-insensitively deduped — `mergeTagsWithSkillNames` (pure, in `resume-parse-core.ts`). Only unedited, confidently-matched (`kind: "auto"`) skills count as "confirmed" for this purpose; review-queue items never leak into tags, matched or not.
  - **`persistCandidateSkills` always re-verifies every client-declared `skillId` is actually visible to the caller's org before writing it to `candidate_skills`** — not just for the detail-page reparse flow (where the ids came from the server's own resolution and are already trustworthy), but because this same function is now also fed skill ids the *client* chose, after the recruiter edited/removed chips. `candidate_skills`' own RLS policy only checks the candidate row's org, not the skill row's (see `PROJECT_STATE.md` §10 on join tables with no `org_id` of their own), so this scoped `SELECT` is the only thing standing between a tampered request and linking a candidate to another org's skill.
  - **Item 4 — `candidates.location_id` was previously only ever set by `parseResume`'s auto-match path, with nowhere on the candidate detail page to view or correct it.** Added a "Location" field to `candidate-detail-form.tsx` (a `Select` populated from the org's `locations` table, same pattern as the existing Role field) and a new `updateCandidateLocation` Server Action, same authorization shape as `reassignCandidateRole`. Also wired into the New Candidate form itself, pre-filled from a confident parse match but always user-editable/overridable.
  - **New `vitest.config.mts`** — needed the moment a test (`resume-parse-core.ts`, via `@/lib/config`) first used the `"@/..."` path alias; vitest has no build step of its own that reads `tsconfig.json`'s `paths`, so this had never come up before. Mirrors `tsconfig.json`'s alias exactly; `.mts` (not `.ts`) avoids a CJS/ESM config-loader warning given this repo has no `"type": "module"` in `package.json`.
  - **TESTABLE NOW, and tested**: 11 new vitest tests for the two new pure helpers (`resume-parse-core.test.ts`) — `finalizeSkillChips` (untouched auto-match persists as confident + contributes its name to tags; edited auto-match downgrades to review with `skillId`/`similarity` dropped; unedited review keeps its suggestion; edited review drops it; an emptied-out chip is skipped; case/whitespace-insensitive edit detection) and `mergeTagsWithSkillNames` (both-empty → `null`; existing tags untouched with no skill names; builds from skill names alone; dedupes case-insensitively against existing tags). Total suite: 32 tests (up from 21), all passing. **Also verified live, for real, not just visually**: the New Candidate form renders with the new Resume/Location fields (screenshot, 1280px); uploaded a real test PDF through it and confirmed via direct Storage REST that it landed at exactly `<org_id>/staging/<user_id>/<uuid>.pdf`; confirmed the graceful-degradation message appears (parse fails as expected, upload still succeeded); submitted with the staged resume attached and confirmed via REST that the new candidate's `resume_path` was set to that exact staging path, and that "View resume" on its detail page renders a working signed URL (`200 application/pdf` via direct `curl`); separately ran manual entry with zero resume interaction plus a manually-picked Location and confirmed via REST that `resume_path` stayed `null` and `location_id` was set exactly as picked — proving manual entry is genuinely unaffected, not just untouched in the diff; edited the Location field on that candidate's detail page afterward and confirmed via REST that `updateCandidateLocation` persists a real change.
  - **BLOCKED, explicitly not attempted per this task's own instructions: a live end-to-end "upload a real resume → see the form pre-filled with matched name/skills/location" test.** `ANTHROPIC_WORKSPACE_ID` is still not set — confirmed live during this task's own verification (uploading a real test PDF through the New Candidate form produced exactly the expected graceful-degradation message, not a new or different failure), so this is the same already-diagnosed, already-understood failure mode as Prompt 3's original blocked item, not a new bug. **What's actually verified vs. not, split the same way as Prompt 3**: the chip-editing/persist decision logic (`finalizeSkillChips`) and the tags-merge logic (`mergeTagsWithSkillNames`) are fully unit-tested, independent of the Anthropic call; the staging upload path, the graceful-degradation UI, and manual-entry-unaffected are all verified live. What's never run against the real API is the actual autofill itself — does a real resume's extracted name/skills/location actually populate the form the way a human would expect. **Named test plan for once `ANTHROPIC_WORKSPACE_ID` is set** (same sample resumes as Prompt 3's own named test plan, not a different pair): upload `Andrea_Villanueva_Resume.pdf`/`.docx` through the New Candidate form and confirm the Name field pre-fills, TypeScript/Python/Docker/Git/etc. appear as solid (auto-matched) chips, `"Prompt Eng"`/`"RAG"`/`"Vector DB"`/`"CI/CD"`/`"Node.js"` appear as either auto-matched or outlined (needs-review) chips depending on current alias coverage, and the Location field pre-selects Quezon City, Metro Manila from `"QC"` — then submit and confirm the same skills/location land correctly in `candidate_skills`/`candidate_skill_reviews`/`location_id` as Prompt 3's own plan already covers for the detail-page path.
- **ATS_FEATURES.md Prompt 3: server-side resume extraction, parsing, and skill/location fuzzy matching.** Built completely per spec; the live Anthropic extraction call itself is unverified end-to-end — see the explicit blocked-item note below.
  - **New dependencies (user pre-approved in this prompt): `pdf-parse` and `mammoth`**, exactly the pair named in ATS_FEATURES.md's Prerequisites ("same pair used successfully on the 3PL project"). `pdf-parse` ships its own types; `mammoth` doesn't and there's no `@types/mammoth` package (confirmed via `npm view` — 404), so a minimal ambient module declaration (`src/types/mammoth.d.ts`) covers only the one function this app calls (`extractRawText`), not the whole API.
  - **`src/lib/talent-acquisition/resume-text-extract.ts`** — `extractResumeText(bytes, mimeType)`, dispatching to `pdf-parse`'s `PDFParse({ data }).getText()` or `mammoth`'s `extractRawText({ buffer })` by MIME type. Server-only; never imported into a client component.
  - **New Postgres functions for the pg_trgm fallback** (`supabase/migrations/20260921150000_ats_features_step3_match_functions.sql`): `match_skill(org_id, text)` / `match_location(org_id, text)`, each a `security invoker` SQL function returning the single best `similarity()` match within that org's `skills`/`locations` rows. `security invoker` (the default, stated explicitly) means these still run under the caller's own RLS — the `org_id` argument shapes the query, it isn't the only thing scoping it.
  - **Checked whether new grants were needed here too — a genuinely different answer than Prompt 2's Storage check, not the same "no" reused**: table-only grants (`ALTER DEFAULT PRIVILEGES ... ON TABLES`) never cover functions at all; Postgres instead grants `EXECUTE` on a new function to `PUBLIC` by default, which would technically already let `authenticated` call these two with no explicit grant — but relying on that silently also hands `anon` the same access, which this app never grants anything to per SECURITY.md. The migration explicitly `revoke`s from `PUBLIC` and `grant`s only to `authenticated`/`service_role`, a real, checked answer rather than an assumption either way.
  - **Verified against a disposable local Postgres container** (not the project's real database, and not the unrelated `3pl-sourcing` local Supabase container already running on this machine) — stubbed a minimal `auth.uid()`/`profiles`/`skills`/`locations`/`current_org_id()` to apply the actual migration file on top, then confirmed real `pg_trgm` behavior, not assumed: `"typescript"` against `"TypeScript"` → similarity 1; `"pythn"` against `"Python"` → 0.44 (correctly in the 0.35-0.6 review band, not a hand-rolled JS approximation of trigram similarity — this is why the fuzzy step genuinely runs in Postgres rather than being reimplemented in TypeScript); `"underwater basket weaving"` → 0.03 (correctly below 0.35, no suggestion); `"Quzon City"` against `"Quezon City"` → 0.64 (correctly auto-accepts). Also confirmed the grants themselves are real, not just present in the SQL: `set role authenticated` succeeds calling `match_skill`, `set role anon` fails with `permission denied for function match_skill`. Container removed after.
  - **`src/lib/talent-acquisition/skill-location-normalize.ts` — the normalization *decision* logic, deliberately separated from the DB calls that feed it.** `resolveEntity(rawText, lookupAlias, lookupFuzzy)` takes the exact-match and fuzzy-match lookups as injected async functions rather than calling Supabase directly — the same reason `cadence.ts`'s functions are pure — so the decision logic (alias match wins outright; else ≥0.6 auto-accepts; else 0.35-0.6 goes to review with the suggestion; else review with no suggestion) is fully unit-testable without a live Postgres connection, while the real lookups it's called with in production (in `resume-parse-actions.ts`) do hit `skill_aliases`/`location_aliases` and the `match_skill`/`match_location` RPCs above.
  - **`skill-location-normalize.test.ts` — 8 new vitest tests, all passing, run alongside the existing `cadence.test.ts` suite (21 total, up from 13).** This is the piece the task explicitly called "testable now" independent of the blocked Anthropic call, and it's tested as such: exact alias match short-circuits without ever calling the fuzzy lookup; case/whitespace normalization before the alias lookup; fuzzy fallback when there's no alias match; auto-accept at exactly the 0.6 boundary; review-with-suggestion in the 0.35-0.6 band and at exactly the 0.35 boundary; review-with-no-suggestion below 0.35; review-with-no-suggestion when the fuzzy lookup finds nothing at all.
  - **`src/lib/talent-acquisition/resume-parse-actions.ts` — the `parseResume` Server Action**, triggered explicitly (a new "Parse resume" button, not auto-run on upload — ATS_FEATURES.md left this as "your call on the better UX," and auto-firing on every upload/replace would spend a real API call invisibly, cutting against the schema's own "nothing auto-tags silently" design for the review queue). Same shape as every other side-effecting action in this app: `getUser()` first, then an explicit `profiles.org_id` vs. `candidates.org_id` compare before the Storage download or the Anthropic call (SECURITY.md's authorization-beyond-RLS rule, same as `uploadResume`/`generateSuggestedMessage`) — downloads the resume via the RLS-scoped client, extracts text (capped at 12,000 characters — a real resume's extracted text is a few thousand at most; this bounds token cost against a pathological file), then one Anthropic call with a system prompt demanding a single JSON object (`{name, skills, location, summary}`), tolerant of one specific deviation (a model wrapping the JSON in a fenced code block despite being told not to) but otherwise failing closed on anything unparseable. For each extracted skill string (deduped, capped at 40 to bound the loop against an implausible model output): `resolveEntity` against `skill_aliases` then `match_skill`, auto-matches `upsert` into `candidate_skills` (`onConflict: "candidate_id,skill_id", ignoreDuplicates: true` — safe to re-run), everything else inserts a `pending` row into `candidate_skill_reviews` with the suggested skill and similarity score (or neither, per the threshold). Same treatment for the extracted location string against `location_aliases`/`match_location`, but only an auto-match (≥0.6) has anywhere to go — see the scope gap noted below. **Flagged for rate-limiting review** per SECURITY.md, same convention as `generateSuggestedMessage`/`uploadResume` — but flagged as a genuinely open gap, not paired with a cap the way that action was: `generateSuggestedMessage`'s daily cap counts rows in `candidate_drafts`, a table that already logs every generation; nothing in ATS_FEATURES.md's Step 1 schema logs every parse the same way, and adding a table for that wasn't part of this step's ask, so no cap exists yet for this specific action.
  - **A real scope gap in ATS_FEATURES.md's own schema, not an oversight**: Step 1 gave skills a review-queue home (`candidate_skill_reviews`) for anything below auto-accept confidence, but gave locations no equivalent table. A confidently-matched location (≥0.6) sets `candidates.location_id` directly; anything below that threshold is surfaced back to the UI in the action's return value (so the recruiter at least sees what was extracted) but isn't persisted anywhere — there's nowhere in the current schema for it to go. Not silently dropped, not worked around by inventing a table Prompt 3 never specified — flagged here and in `docs/PROJECT_STATE.md` as an open item for whoever scopes the next schema change.
  - **New "Parse resume" button** (`resume-parse.tsx`, client component, alongside `resume-upload.tsx` in the same "Resume" card) — same `Button variant="outline" size="sm"` convention as "Choose file," disabled until a resume exists, showing a plain-language result summary ("2 skills matched · 1 sent for review · location matched: Quezon City") or the generic error, in the same `text-sm text-slate-text` / `role="alert" text-destructive` styling as every other result/error pair on this page.
  - **BLOCKED, explicitly not attempted: a live end-to-end resume parse via Playwright.** `ANTHROPIC_WORKSPACE_ID` is still not set (see `docs/PROJECT_STATE.md` §6/§7) — the same `invalid_request_error` already diagnosed in the draft-generation feature would fire here too, since this action reuses the identical unscoped-key code path. This was not chased as a bug; it's the expected, already-understood failure mode. **What's actually tested vs. not**: the normalization matching logic (alias exact match → pg_trgm fallback → threshold decision) is fully verified independent of the Anthropic call, both via the 8 new vitest tests above and via the live `pg_trgm`/grants checks against the disposable container. The extraction call itself — and everything downstream of it (does the model actually return usable JSON for a real resume, do the extracted strings actually resolve the way a human would expect) — is built but has never run against the real API. **Named test plan for whenever `ANTHROPIC_WORKSPACE_ID` is set**: run a real parse against the sample resumes (`Andrea_Villanueva_Resume.pdf`/`.docx`) and confirm TypeScript/Python/Docker/Git/etc. auto-match, "Prompt Eng"/"RAG"/"Vector DB"/"CI/CD"/"Node.js" land in either auto-match or review depending on current alias coverage, and "QC" resolves to Quezon City, Metro Manila.
- **Impeccable `audit` + polish pass on the Resume card, scoped to that card only** (`resume-upload.tsx`) — it was added after the candidate detail page's original full-page audit, so it never went through that pass. Mechanical detector: zero findings. Manual review against `DESIGN_SYSTEM.md` surfaced the real issue: **[P1, theming]** the file control was a raw, unstyled native `<input type="file">` — rendered as the browser's OS-default "Choose File" button (system gray, square corners), visually foreign against every other control on this page, all of which go through this app's `Button`/`Input` components. **[P2, UX]** no styled selected-filename feedback — the browser's own tiny native filename text was the only signal a file was picked.
  - **Fix**: replaced the raw file input's visible surface with a real `Button` (`variant="outline" size="sm"`, matching `user-row.tsx`'s row-level secondary-action convention) that triggers a visually-hidden native `<input type="file">` via `fileInputRef.current.click()` — the standard accessible pattern, chosen over a `<label htmlFor>` association specifically because a real `<button>` gets Enter/Space keyboard activation for free (a `<label>`'s keyboard-activation behavior is mouse-click-only in most browsers, which would have silently reintroduced a keyboard trap while looking identical to the sighted eye). The hidden input uses `hidden` (display:none) with `tabIndex={-1}`/`aria-hidden="true"`, not `sr-only` — `sr-only` keeps an element visually hidden but still in the tab order, which would have added a second, invisible, confusing tab stop right next to the real button; `hidden` removes it from both the visual layout and the accessibility tree entirely, leaving the Button as the one real, keyboard-operable control.
  - **Selected-filename display**: `handleFileChange` now sets a `fileName` state synchronously (before the async upload starts), rendered as styled text (`text-sm text-slate-text`, truncating on overflow) next to the button — visible for the full duration of the upload, cleared on success (since the "View resume" link, driven by the `resumeUrl` prop, becomes the confirmation at that point) but kept on failure (so the error is legible next to what failed to upload).
  - Left `"View resume →"` and the field-caption labels (`"Resume (PDF or DOCX)"` / `"Replace resume (PDF or DOCX)"`) completely unchanged — already correctly matching this page's link (`text-work-blue underline`) and label (`text-xs uppercase tracking-wide text-muted-foreground`) conventions; not in scope and not touched.
  - **Verified live via Playwright MCP** (session already authenticated): screenshotted the new styled button at 1280px and 375px, matching every other control's appearance on the page. Confirmed via `document.activeElement` after a plain `Tab` keypress (no click) that focus lands correctly on the button, with a clearly visible Work Blue ring in the resulting screenshot — the same treatment as every other focusable element on this page. Confirmed via `Enter` keypress (not a mouse click) that the file chooser dialog actually opens — real keyboard activation, not just a visually-plausible-looking button. **Confirmed via `pg_policies`-adjacent live testing that upload and replace still work functionally, not just visually**: uploaded a real test PDF through the new button, confirmed `candidates.resume_path` updated to a real, correctly-shaped path and the resulting signed URL returned a real `200 application/pdf` response; reloaded the page and confirmed "View resume" persisted; used "Choose file" again to replace it and confirmed `resume_path` updated to a *different* random path (proving "replace" is genuinely a fresh upload, not a no-op or an in-place overwrite pretending to work).
  - **Incidental discovery, not something this task changed**: the `resumes` Storage bucket — flagged as not yet applied to the live database in the previous session — has since been applied (bucket confirmed present via REST, `file_size_limit`/`allowed_mime_types` matching the migration exactly, created timestamp during this session's window). This means the full upload → storage → reload round trip that the previous session's build couldn't verify **is now confirmed working end-to-end for real**, not just via the disposable-container proof. See `docs/PROJECT_STATE.md` §6, updated accordingly.
- **Discovered, via a direct REST check before writing any code, that the two previously-unapplied ATS schema/seed migrations (`20260921120000`, `20260921130000`) have since been applied to the live project** — `candidates.resume_path`/`status`/`decline_reason`/`location_id` all queried successfully, and `skills`/`skill_aliases`/`locations`/`location_aliases` returned the exact expected row counts (31/80/5/6). Not something this session did — the user must have applied them independently since the last one. Updates the still-open items in `docs/PROJECT_STATE.md` §6 accordingly; this is exactly the kind of ground-truth check that file's own "verified, not assumed" convention calls for before building on top of a migration whose live status wasn't already confirmed in this conversation.
- **ATS_FEATURES.md Prompt 2: resume upload/storage/retrieval on the candidate detail page — no parsing yet, that's Prompt 3.** New private `resumes` Supabase Storage bucket (migration `20260921140000_resumes_storage_bucket.sql`), org-scoped RLS on `storage.objects`, a new "Resume" card between "Candidate" and "Next action" on `/talent-acquisition/candidates/[id]`.
  - **Path convention**: `<org_id>/<candidate_id>/<random-uuid><ext>`, written by the new `uploadResume` Server Action (`src/lib/talent-acquisition/resume-actions.ts`). The random filename — not the original, possibly PII-bearing, user-supplied one — avoids collisions and keeps the object name itself free of anything worth protecting on its own; the leading `org_id` segment is what every RLS policy keys off.
  - **The UUID-cast-guard bug, guarded against for real, not just in a comment**: a naive `(storage.foldername(name))[1]::uuid = current_org_id()` policy throws a hard Postgres error — `invalid input syntax for type uuid` — the moment any object in the bucket has a non-UUID-looking first path segment (a stray upload from an unrelated bug, a manually-created test object, anything), and because RLS policies for one command are combined into a single expression, that one throw can abort the *entire* query, silently blocking every other policy on the table too, not just access to the offending row. Fixed with a `~` regex match against a UUID shape *before* ever attempting the cast, short-circuited with `and` so a malformed segment fails the policy cleanly (returns false) instead of erroring the statement.
  - **Proved this both ways, not just written it**: built a from-scratch storage-schema stub (`storage.buckets`/`storage.objects`/`storage.foldername()`, session-scoped role-switching to simulate `authenticated`) in a disposable local Postgres container — applied the real migration on top, inserted a row with a deliberately malformed first path segment alongside valid same-org and different-org rows, and confirmed: (a) a `SELECT` as the correctly-scoped org returns only the valid same-org row, no error, the malformed row silently excluded; (b) an `INSERT` with the correct org prefix succeeds; (c) an `INSERT` with a different org's prefix cleanly fails with a normal RLS policy violation, not a crash. Then, for direct proof the guard is load-bearing and not redundant caution: swapped in the exact same policy *without* the regex guard against the same data and reproduced the real bug — `ERROR: invalid input syntax for type uuid: "not-a-uuid"` on a plain `SELECT`. Container removed after.
  - **`uploadResume` Server Action**: validates the file (present, non-empty, PDF or DOCX by MIME type — never trusting the client's `accept` attribute alone, per SECURITY.md's boundary-validation rule — 10MB max, matching the bucket's own `file_size_limit`), then the same authorization-beyond-RLS pattern `generateSuggestedMessage` established: `getUser()` first, then an explicit compare of the candidate's `org_id` against the caller's own `profiles.org_id` before ever writing to Storage — SECURITY.md calls out "writing to external storage" by name as a non-DB side effect needing this. Uploads via the normal RLS-scoped client (not `admin-client.ts` — no service-role privileges needed, the new storage policies are the actual boundary), then updates `candidates.resume_path`. Fails securely throughout — no raw Supabase Storage error ever reaches the client. **Flagged for rate-limiting review** per SECURITY.md, matching the existing convention.
  - **"Replace" is a fresh upload under a new random path, not an in-place object overwrite** — the previous object (if any) is simply left orphaned in Storage. No cleanup step exists yet; a known, explicitly-flagged gap for a later step, not an oversight.
  - **New "Resume" card** (`resume-upload.tsx`, client) — a file `Input` (already carrying this app's established `focus-visible:ring-3 focus-visible:ring-ring/50` styling and file-picker-button variant classes) with an `aria-label` matching its visible state ("Resume file" when empty, "Replace resume" once one exists), a `role="alert"` error region, and — once a resume exists — a "View resume →" link matching the page's existing link style (`text-work-blue underline`, same as "Edit on the roles page"). Deliberately has **no local copy of the signed URL in component state** — it's read straight from a prop computed fresh in `page.tsx` on every server render; `revalidatePath()` inside `uploadResume` re-renders the page with the new `resume_path` and its own fresh signed URL, which flips the component from "upload" to "view" automatically. That transition is the upload's own success confirmation (no separate toast needed), the same reasoning already used for `deleteUser`'s row disappearing from the admin list.
  - **Signed URLs generated server-side, fresh, on every page load** (`createSignedUrl`, 1-hour expiry) — the bucket is private, so there's no public URL to just build a string for; using the same RLS-scoped client that every other read on this page already uses means the signed-URL request itself goes through the "resumes: select within org" policy, not a separate trust boundary.
  - **Checked whether Storage needs any new grants — confirmed it works differently from table grants, not assumed to be already covered**: the existing `ALTER DEFAULT PRIVILEGES` migration is explicitly scoped `IN SCHEMA public`; `storage.objects`/`storage.buckets` live in the `storage` schema, which that statement was never going to reach regardless of the new-vs-existing-table nuance from the last migration. Storage's actual access boundary is RLS policies on `storage.objects`, which Supabase's own bootstrap already grants the underlying table privileges for — no grants migration needed, and no `alter table storage.objects enable row level security` added either (that table is owned by `supabase_storage_admin`, already RLS-enabled by Supabase itself; only policies were added).
  - **Verified live via Playwright MCP** (session already authenticated, no login prompt needed): the new Resume card renders correctly at both 1280px and 375px, positioned between "Candidate" and "Next action," matching every other card's style. Uploaded a real test PDF through the actual file input — since the bucket doesn't exist on the live project yet (see below), this correctly reached the real Server Action, hit the real (failing) Supabase Storage call, and surfaced the expected generic `"Couldn't upload the resume. Please try again."` with no raw storage error — the same "prove the failure path is wired correctly and fails securely" verification already used for the Anthropic-credential blocker in the previous session. Confirmed via `getComputedStyle` on the focused file input that its focus-visible styling resolves to the same `ring-ring/50` token/width as every other control on this page (`outline: oklab(... Work Blue .../0.5) none 3px`) — it renders as a thin outline around the native file-picker button rather than a full box-shadow, a browser rendering quirk specific to `type="file"` inputs, not a missing or broken style.
  - **Could not verify the full upload → reload → still-shown round trip live** — the `resumes` bucket doesn't exist on the live project yet (confirmed via a direct Storage REST check: `404 Bucket not found`), and this migration hasn't been applied (same standing limitation as the three other unapplied migrations — no direct Postgres connection available to Claude Code in this environment). The RLS-policy correctness itself, including the specific UUID-guard bug this task called out, was proven exhaustively against a disposable container instead (see above); what's left is purely "does this work against the real project," which needs the migration applied first.
- **Seeded 24 additional skills (and their 63 aliases) into `skills`/
  `skill_aliases`, covering the AI-stack/backend side of the talent pool**
  that Step 1's general-purpose starter list (TypeScript, Python, PM,
  Customer Support, etc.) didn't include — API integration, RAG/agentic
  tooling, MLOps/LLMOps, and general backend skills. New migration
  `supabase/migrations/20260921130000_seed_ai_stack_skills.sql`, same
  `ON CONFLICT DO NOTHING` idempotent pattern as Step 1's seed
  (`20260921120000`), and applies independently of it — it only inserts
  into the two tables that migration already created, no schema change.
  - Deliberately did **not** alias `aws`/`gcp`/`azure` under "Cloud
    Infrastructure" — per the task's own explicit note, those are
    distinct skills, not synonyms, and collapsing them would create
    false matches once Step 3's fuzzy-matching exists. Left as a comment
    directly next to the Cloud Infrastructure aliases in the migration,
    not just here, so a future session touching this seed data sees the
    reasoning in place.
  - **Verified against a disposable local Postgres container**, applied
    on top of a fresh copy of Step 1's schema + seed (not the project's
    real database, and not the unrelated `3pl-sourcing` local Supabase
    container already running on this machine) — confirmed 24 skills +
    63 aliases inserted (bringing the running totals to 31 skills / 80
    aliases with Step 1's 7/17), queried every new skill's alias list
    back and confirmed it matches the spec exactly name-by-name, and
    re-ran the migration a second time to confirm it inserts 0 rows the
    second time (true idempotency, not just "the syntax has ON CONFLICT
    in it"). Container removed after.
  - **Not yet applied to the live project database** — no direct
    Postgres connection available to Claude Code in this environment,
    same standing limitation as the two other unapplied migrations
    already flagged in `docs/PROJECT_STATE.md` §6.
- **ATS_FEATURES.md Prompt 1: schema for resume parsing, skill/location
  normalization, interview scorecards, and the active/rejected status
  axis — schema and seed data only, per the plan's own step sequence
  (no Storage bucket, parsing, or UI yet; those are Prompts 2-7).** New
  migration `supabase/migrations/20260921120000_ats_features_step1_schema.sql`.
  - `pg_trgm` extension enabled (ships with Postgres, no install) — powers
    fuzzy skill/location matching starting in Prompt 3; no GIN trigram
    indexes added yet, deliberately, since no query needs them until that
    step exists.
  - New tables: `skills`, `skill_aliases`, `locations`, `location_aliases`,
    `candidate_skills`/`role_skills` (join tables, composite PK, no
    `org_id` of their own), `candidate_skill_reviews` (the pending
    fuzzy-match queue), `interview_scorecards`.
  - Four new columns on `candidates`: `resume_path`, `location_id`,
    `status` (`active`/`rejected`, defaults `active`), `decline_reason` —
    `status` is intentionally orthogonal to the existing `stage` column,
    per ATS_FEATURES.md's "candidate status vs. stage" architecture
    decision (rejecting a candidate doesn't move them through the
    pipeline; it sets `status` and requires a reason, separately).
  - **RLS enabled on all eight new tables, mirroring the existing pattern
    exactly rather than inventing a new shape**: `skills`/`skill_aliases`/
    `locations`/`location_aliases`/`candidate_skill_reviews` all carry
    their own `org_id`, so they get the same direct
    `org_id = current_org_id()` select/insert/update policies
    `roles`/`candidates` use. `candidate_skills`/`role_skills` have no
    `org_id` column, so they get the derived-org-membership shape
    `candidate_history`/`candidate_drafts` already use (an `exists`
    subquery through the parent `candidates`/`roles` row) — select/
    insert/delete only, since these are pure membership rows with no
    non-key column an update would ever touch. `interview_scorecards`
    deliberately gets **select + insert only, no update, no delete** —
    ATS_FEATURES.md's own schema comment calls this table "append-only,"
    enforced here at the RLS layer itself, not left as a comment alone,
    so a future accidental edit/delete action fails closed instead of
    silently rewriting interview history.
  - Deliberately did **not** cross-check a row's other foreign keys
    (e.g. `skill_aliases.skill_id`, `candidate_skill_reviews.suggested_skill_id`)
    against their own org inside RLS — consistent with this codebase's
    existing architecture decision (`docs/PROJECT_STATE.md` §8,
    2026-09-14) that this kind of cross-table authorization belongs in
    the Server Action that writes the row (the same `assertRoleIsVisible`
    shape already used for `candidates.role_id`), not duplicated into
    RLS. That verification is a future prompt's job (Prompts 3-4), once
    the actions that write these tables actually exist.
  - **Seed data inserted** exactly as listed in ATS_FEATURES.md: 7 skills
    (TypeScript, JavaScript, Node.js, Python, Project Management,
    Customer Support, Virtual Assistant) with all 17 listed aliases, and
    5 locations (Quezon City/Taguig/Manila, all Metro Manila; Cebu City,
    Cebu; Davao City, Davao del Sur) with all 6 listed aliases — inserted
    via `ON CONFLICT DO NOTHING`, same idempotent pattern as the initial
    schema migration's `org_settings` seed row, so re-running this
    migration is harmless.
  - **Checked whether the existing `ALTER DEFAULT PRIVILEGES` grants
    migration covers these new tables automatically — concluded yes, no
    new grants migration needed**, based on Postgres's documented
    semantics: that migration's `ALTER DEFAULT PRIVILEGES IN SCHEMA
    public ... GRANT ...` was run without `FOR ROLE`, so it applies
    forward to any table later created *by the same executing role* —
    and every migration in this repo, including this one, runs through
    the same `supabase db push` mechanism as that grants migration. This
    is the **first** migration since the grants fix that creates
    brand-new tables (every migration between the two only added columns
    to existing tables), so unlike those, this specific claim hasn't
    actually been exercised yet — flagged in `docs/PROJECT_STATE.md` §6
    as needing a real REST-level confirmation once applied, matching this
    project's established "verified, not assumed" discipline for
    migrations, rather than treating the Postgres-semantics reasoning
    alone as sufficient proof.
  - **Verified the migration itself against a disposable local Postgres
    container** (a plain `postgres:16` Docker image with a minimal stub
    of `profiles`/`roles`/`candidates`/`current_org_id()`, not the
    project's real Supabase database, and not the unrelated `3pl-sourcing`
    local Supabase container already running on this machine — left
    completely untouched) — the full migration applied cleanly end to
    end (extension, 8 tables, 4 new columns, 15 indexes, 23 RLS policies,
    all 4 seed inserts), the seed data was queried back and confirmed to
    match ATS_FEATURES.md's alias lists exactly (skill-by-skill,
    location-by-location), the RLS policy list was queried back and
    confirmed to match the intended per-table shape exactly (including
    `interview_scorecards` correctly having no UPDATE/DELETE policy), and
    the four new `candidates` columns were confirmed present with the
    right types/defaults/constraints. The disposable container was
    removed afterward. **This migration has not been applied to the
    live project database** — no direct Postgres connection available to
    Claude Code in this environment, same standing limitation as the
    unapplied FK-behavior migration from the previous session (see
    `docs/PROJECT_STATE.md` §6).
- **Prompt 8: the "generate suggested message" feature, per BUILD_BRIEF.md
  §5 exactly** — single-shot generation on `/talent-acquisition/candidates/[id]`,
  not a chat thread. New `generateSuggestedMessage(candidateId, extraContext?)`
  Server Action in `src/lib/talent-acquisition/draft-actions.ts`, and a new
  "Suggested message" card on the candidate detail page rendered by a new
  client component, `draft-generator.tsx`.
  - **Auth + authorization, in that order, before any Anthropic call**:
    `getUser()` first (rejects if unauthenticated), then an explicit
    compare of the candidate's `org_id` against the caller's own
    `profiles.org_id` — this is a third-party API call, a real side
    effect, so per SECURITY.md's authorization-beyond-RLS rule it needs
    its own check, not just an implicit reliance on the scoped `SELECT`
    already returning nothing for a candidate RLS would hide. Both reads
    happen, then the two org_ids are compared directly.
  - **Prompt built server-side** from the candidate's name/stage/notes,
    the assigned role's title + `job_description` (via the existing
    `role_id` join), `org_settings.company_name`, the caller's own
    `profiles.display_name`, the cadence-computed next action
    (`nextActionFor`), and its reference script (`scriptFor`) as a
    style guide — `buildSystemPrompt()` in `draft-actions.ts`, ported
    from the prototype's `buildSystemPrompt()` in `recruiting-desk.html`
    almost verbatim, fed from real DB data instead of local-storage
    state, per BUILD_BRIEF.md §8.
  - **Confirmed the Anthropic call happens only in this Server Action —
    never in a client component.** `draft-generator.tsx` (the "use
    client" piece) only ever calls `generateSuggestedMessage()`, a
    `"use server"` export; it never imports `config.anthropic` or issues
    a `fetch` to `api.anthropic.com` itself. This is exactly the mistake
    an earlier prototype iteration made (a direct browser-side call,
    exposing the API key) — see the fragile-area note in
    `docs/PROJECT_STATE.md` §10, re-confirmed here by inspection, not
    just carried forward as an assumption.
  - **Persisted to `candidate_drafts`** — one row per generation
    (`candidate_id`, `stage`, `content`, `generated_by`), after a
    successful API response, before the content is ever returned to the
    client. Treated as load-bearing: if the insert itself fails, the
    action returns the same generic failure rather than handing back a
    draft with no audit-trail row for it.
  - **Draft goes stale on stage change** (BUILD_BRIEF.md §5): the
    candidate detail page fetches the single most recent draft row for
    the candidate and only shows it if its stored `stage` still matches
    the candidate's *current* stage; a stage change since the last
    generation makes the card fall back to "Generate suggested message"
    instead of showing a leftover draft that no longer applies.
  - **Fail securely**: any Anthropic API error, a missing
    `ANTHROPIC_API_KEY`, or an insert failure all collapse to the same
    generic `"Couldn't generate a draft, try again."` — never the raw
    Anthropic error text. Verified live (see below) against a real API
    failure, not just by reading the code.
  - **Basic per-org daily cap** (200/day, `DAILY_GENERATION_CAP` in
    `draft-actions.ts`) — a backstop against a runaway loop per
    BUILD_BRIEF.md §5, checked before the API call is made. `candidate_drafts`
    has no `org_id` column of its own, so the count goes through an
    `candidate_drafts?select=id,candidates!inner(org_id)` inner join to
    `candidates`, the same org-scoping shape the RLS policies on this
    table already use. Sanity-checked the exact query shape directly
    against the live REST API (service-role key) — 200 OK, valid filter
    syntax, confirmed separately from the blocked live-generation test
    below.
  - **Flagged for rate-limiting review**, per SECURITY.md — a top-of-file
    comment in `draft-actions.ts`, matching the convention already used
    for `inviteUser`/`resetUserPassword` in `admin-actions.ts`.
  - **Checked grants**: none needed. `candidate_drafts` and `org_settings`
    are both existing tables already covered by the blanket
    `ALTER DEFAULT PRIVILEGES` grant in
    `20260914060451_fix_grants_and_roles_delete_policy.sql` — confirmed
    by reading that migration directly, not assumed. No new migration.
  - **Real blocker hit while live-testing, not a code bug**: the
    `ANTHROPIC_API_KEY` currently in `.env.local` is an *unscoped*
    (org-level) key. Anthropic's API now rejects unscoped keys with a 400
    unless every request also carries an `anthropic-workspace-id` header
    — confirmed by a direct `curl` against the real API, independent of
    this app's code, not inferred from the client's generic error alone.
    Added optional support for this: `ANTHROPIC_WORKSPACE_ID` in
    `config.ts`/`.env.example`, sent as that header only when set. **Left
    unresolved on purpose** — the user chose to leave it blocked for now
    rather than have Claude Code guess a workspace ID, and will fix the
    credential (either add the workspace ID or swap in a workspace-scoped
    key) via the Anthropic Console on their own.
  - **Verified live via Playwright MCP** (session was already
    authenticated — no login prompt needed, per that convention's own
    carve-out) on a real candidate (Gil Demiar, `test role 2`, stage
    Interviewing) at desktop width: the new "Suggested message" card
    renders correctly, matching every other card's `Card`/typography
    convention on this page; clicking "Generate suggested message"
    correctly triggers the real Server Action, hits the real (failing,
    per the blocker above) Anthropic API, and surfaces the generic
    fail-securely error (`role="alert"`, no raw error text) — confirming
    the whole pipeline up to and past the API call is wired correctly,
    even though the call itself can't succeed yet. Confirmed via keyboard
    Tab that both the extra-context `Textarea` and the "Generate
    suggested message" `Button` (a real accessible name, matching the
    visible label) show the established Work Blue focus ring. **Could
    not screenshot a successful generation or confirm the generated
    message renders readably** — blocked entirely by the credential issue
    above, not by anything in this feature's own code. Needs a real
    successful generation, screenshotted, once the credential is fixed.
- **Root cause found and fixed for the invite-email gap logged in the
  previous entry: Supabase's default confirmation link puts the session
  in a URL hash fragment (`#access_token=...`), which a server-side route
  handler never sees — the fragment never leaves the browser, so it can't
  reach `/auth/confirm` no matter how that route is written.** The user
  fixed this from their side by updating the **Invite user** and **Reset
  Password** email templates in the Supabase dashboard (Authentication →
  Email Templates) to use the `token_hash`/`type`/`redirect_to`
  query-param format instead, pointing at `/auth/confirm`. **This is a
  manual dashboard step with no code equivalent — nothing in this repo
  can set or verify it, and it's worth checking for on any future project
  that uses Supabase email-based auth links** (invite, magic link,
  recovery) — the symptom (a link that "does nothing" / silently lands
  back at a login-like page with no session) looks like a bug in the
  receiving route when it's actually the sending template. Logged as a
  fragile-area note in `docs/PROJECT_STATE.md` §10, not just here, so
  it's visible without having to find this changelog entry first.
  - Verified `/auth/confirm/route.ts` already matched the exact pattern
    this fix requires: reads `token_hash`/`type` from `searchParams`,
    calls `supabase.auth.verifyOtp({ type, token_hash })` via the server
    client, redirects to `next` on success. The one real gap: on failure
    it redirected silently to `/login`, indistinguishable from "nothing
    happened" — a genuinely expired/already-used/tampered link gave no
    signal anything went wrong. Added a real `/auth/error` page (styled
    to match `/login`/`/set-password`) and pointed the failure path there
    instead. Verified live via cookie-less `curl`: a bogus `token_hash`
    and a request with no params at all both now 307 to `/auth/error`
    (previously both went to `/login`); the no-session guard on
    `/set-password` itself is unchanged and still correctly goes to
    `/login` — a different concern (missing session vs. a bad token).
  - **Added password reset**: a "Reset password" button per user row on
    `/admin`, admin-only (`requireAdminUser()`), behind a confirmation
    dialog. Calls the new `resetUserPassword` Server Action
    (`admin-actions.ts`), which uses `supabase.auth.resetPasswordForEmail()`
    — a regular (non-admin) auth method, so it runs on the normal
    cookie-scoped client, not `admin-client.ts` (no service-role
    privileges needed for it). `redirectTo` points at the same
    `/auth/confirm?next=/set-password` as `inviteUser` — one route
    handler now serves both an invite token and a recovery token, since
    both are just different `EmailOtpType` values through the same
    `verifyOtp()` call. On success, shows a "Reset email sent"
    confirmation using the same `growth-green` + `sr-only` live-region
    pattern as the settings-page save-confirmation fix.
  - **Added delete user**: a "Delete" button per user row, admin-only,
    behind a destructive-styled confirmation dialog, same guard shape as
    role changes — blocks self-delete and blocks deleting the last
    remaining admin (the last-admin check is now a shared
    `isLastRemainingAdmin()` helper, used by both `updateUserRole` and
    the new `deleteUser`, rather than duplicated). **Per the explicit
    instruction not to silently touch other data**: before deleting,
    checks whether the user has any `candidates.assigned_to` pointing at
    them and, if so, blocks with a clear count and a "reassign them
    first" message — that's a live, current responsibility, not
    something to silently clear as a side effect of removing an account.
  - **Schema gap found while building this, not assumed away**: every FK
    from `public` tables to `profiles(id)` (and `profiles.id` itself, to
    `auth.users(id)`) had no `ON DELETE` behavior specified, defaulting to
    `NO ACTION` (blocking). This meant `admin.auth.admin.deleteUser()`
    would fail outright with a foreign-key violation the moment a
    matching `profiles` row still existed — true for *any* caller,
    including Supabase's own dashboard "Delete user" button, not just
    this app's code. New migration
    `20260921090000_fix_fk_behavior_for_user_deletion.sql` makes
    `profiles.id → auth.users(id)` cascade (required for deletion to work
    at all) and makes `roles.created_by` / `candidates.created_by` /
    `candidate_history.created_by` / `candidate_drafts.generated_by` →
    `profiles(id)` set null instead (historical attribution — safe to
    lose the specific "who made this," the record itself must survive).
    Deliberately left `candidates.assigned_to` alone — that's the one
    reference that should keep blocking, backed up by `deleteUser`'s own
    explicit application-level check above, not by a silent database-level
    null-out. **`deleteUser` doesn't assume this migration has been
    applied**: it explicitly deletes the `profiles` row itself before
    calling `deleteUser()` (defense in depth, redundant but harmless once
    the migration lands), and if a `23503` foreign-key-violation still
    surfaces (someone who created roles/candidates before the migration
    ran), it's caught and reported as a specific, honest message rather
    than the generic catch-all. **This migration has not been applied to
    the live database by me — I have no direct Postgres connection to
    this project, only the anon/service-role REST keys, which can't run
    DDL.** It needs to be run the same way prior migrations in this repo
    were (Supabase SQL Editor, or `supabase db push` once linked) before
    deleting a user who has ever created any roles/candidates will fully
    succeed without hitting that `23503` path.
  - No new grants needed for any of this: `profiles` DELETE is already
    covered by the blanket `grant ... on all tables in schema public` from
    `20260914060451_fix_grants_and_roles_delete_policy.sql`, and
    `admin-client.ts`'s service-role key bypasses RLS entirely regardless
    of policy — confirmed by reading that migration rather than assuming.
  - Verified live via Playwright MCP at 1280px and 375px: both buttons'
    appearance and both confirmation dialogs (Reset password's blue
    "Send email" / outline "Cancel", Delete's destructive-red "Delete" /
    outline "Cancel") render correctly and match `DESIGN_SYSTEM.md`,
    including the dialog's `flex-col-reverse` footer stacking correctly
    at mobile width. Opened the delete-confirmation dialog for my own
    admin account to test the self-delete guard live — the harness's own
    auto-mode safety classifier blocked clicking the actual "Delete"
    confirm button as an irreversible-deletion action, so that specific
    click wasn't performed; the guard was instead verified by code (an
    identical `userId === actingUser.id` check to `updateUserRole`'s
    self-demotion guard, which *was* live-clicked and confirmed working
    in the previous `/admin` audit session) plus `tsc`. Did not click
    "Send email" on the reset-password dialog or "Delete" against any of
    the real accounts in this environment (`Main`, `dani@...`,
    `giar.cabal@...`) — sending a real reset email or deleting a real
    account are exactly the kind of side effects this task asked to leave
    for manual testing, not simulate through the UI myself.
  - **The actual invite/reset email round trip (a real email arriving,
    its link landing on `/set-password` already authenticated, setting a
    password, signing in afterward) still needs real manual end-to-end
    testing — this was not and could not be verified by me.** What *was*
    verified: the route/page code matches the required pattern, the
    error path now visibly fails instead of silently doing nothing, and
    both new admin buttons/dialogs render and behave correctly in
    isolation.
- **Closed a real gap in the invite flow: the invite email had nowhere to
  land.** `inviteUser` (`admin-actions.ts`) has called Supabase's
  `inviteUserByEmail()` since the admin/invite feature was first built,
  which sends a real email with an auth link — but no route existed to
  receive that link, and no page existed to let the invited user actually
  set their initial password. An invited teammate clicking the email link
  would have hit a dead end (Supabase's own default confirmation flow,
  never wired to anything in this app) with no way to ever sign in, since
  `inviteUserByEmail` never sets a password itself by design (the whole
  point of using it over a plain signup was that the admin never sets or
  sees another user's password).
  - **New route handler** `src/app/auth/confirm/route.ts` — receives the
    invite (and, incidentally, any future recovery/magic-link) email
    link, reads `token_hash`/`type`/`next` from the query string, and
    calls `supabase.auth.verifyOtp({ type, token_hash })`. This both
    validates the token and establishes a real session via the existing
    cookie-writing `createClient()` (`src/lib/supabase/server.ts`) — no
    new Supabase client pattern introduced. On success, redirects to
    `next` (`/set-password`); on failure or missing params, redirects to
    `/login`. This is Supabase's documented server-side-verification
    pattern for Next.js App Router, not a custom invention.
  - **New page** `src/app/set-password/` (`page.tsx` + client
    `set-password-form.tsx` + `actions.ts`) — styled directly from
    `DESIGN_SYSTEM.md`, matching `/login`'s existing centered-Card layout
    exactly (same `Card`/`CardHeader`/`CardTitle`/`CardDescription`
    structure, same form field spacing). The page itself calls
    `getUser()` server-side and redirects to `/login` if there's no
    session — reachable only after `/auth/confirm` has already verified a
    real token, never by navigating there directly. Confirmed this live
    with a cookie-less request (`curl`, no browser session): both
    `/auth/confirm` (no token) and `/set-password` (no session) correctly
    307-redirect to `/login`. The form (new password + confirm, both
    `type="password"`, `minLength={8}`) posts to a Server Action that
    re-derives the user via `getUser()` (SECURITY.md — never trusts the
    page having already checked), validates the two fields match and meet
    the length minimum, calls `supabase.auth.updateUser({ password })`,
    and redirects to `/talent-acquisition/board` on success. Error text
    uses `role="alert"` and `aria-describedby`, consistent with the
    accessibility fixes made across this whole audit series.
  - **`inviteUser` now passes `redirectTo`** pointing at
    `/auth/confirm?next=/set-password` instead of leaving Supabase to use
    its own default. Building an absolute URL required a new env var —
    Server Actions have no request URL to derive an origin from — so
    added `NEXT_PUBLIC_SITE_URL` (documented in `.env.example`, set
    locally in `.env.local` to `http://localhost:3000`; **must be set to
    the real deployed origin in production**, e.g. in Vercel's project
    env vars, or the invite link will point at localhost).
  - **Known prerequisite this build cannot satisfy itself**: for the
    email link to actually land on `/auth/confirm` with `token_hash`/
    `type` query params (rather than Supabase's own default verify
    endpoint), the **Invite user** email template in the Supabase
    dashboard (Authentication → Email Templates) must link to
    `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/set-password`
    — this is a dashboard configuration step, not code, and nothing in
    this repo can verify or set it. **Flagging clearly: this whole flow
    needs a real end-to-end manual test** — send a real invite from
    `/admin`, click the actual emailed link, confirm it lands on
    `/set-password` already signed in, set a password, confirm it lands
    on the board, and confirm the new account can then sign in normally
    from `/login`. I verified the page/route code in isolation (the
    unauthenticated-redirect guards via `curl`, the authenticated layout
    and keyboard focus visually via Playwright at both widths) but did
    **not** submit the form through a real invite token — no way to
    generate one without sending a real email, and I was not going to
    guess around that boundary.
### Fixed
- **Impeccable `audit` + `polish` pass on `/admin` — visual/accessibility only, no Server Action or guard logic touched.**
  `audit` scored 18/20 (Excellent, borderline — Accessibility was the
  drag). Findings shown to the user before any change, per convention:
  **[P1, accessibility]** the two guard-rail/failure error messages
  (`user-row.tsx`'s role-change error — the same path the self-demotion
  and last-admin guards return through — and `invite-user-form.tsx`'s
  invite error) rendered as plain `<p>`s with no `role`/`aria-live`, so a
  screen-reader user attempting a blocked action got no signal anything
  happened at all. Verified this by actually triggering the self-demotion
  guard live, not just reading the code: signed in as the sole admin,
  changed my own Role dropdown to "Member", confirmed the guard correctly
  blocked it server-side ("You can't demote yourself.", role reverted, no
  data changed) and checked the DOM — `role: null, aria-live: null`.
  **[P2, accessibility]** neither error was linked via `aria-describedby`
  to the control it related to. Per the task's explicit scope, this pass
  touched only markup/ARIA on `user-row.tsx` and `invite-user-form.tsx`;
  `src/lib/admin-actions.ts` and `src/lib/supabase/admin-client.ts` were
  read for context but have a zero-line diff (confirmed via `git diff
  --stat`) — the self-demotion guard, last-admin guard, and invite
  validation are unchanged. Fix: added `role="alert"` to both error
  `<p>`s so they're announced immediately without requiring focus to
  move; wired each to its Role `Select`/Email `Input` via
  `aria-describedby` with a stable id. Verified live at 1280px and 375px:
  confirmed the role dropdown, display-name input, and invite email input
  already had clear accessible names before any change (`combobox
  "Role"`, `textbox "Display name"`, `textbox "Email"` — a positive
  finding, not a gap); re-triggered the self-demotion guard post-fix and
  confirmed `role="alert"` and the correct `aria-describedby` link both
  fire, with the role still correctly reverting to Admin (guard behavior
  unchanged). Full keyboard Tab-through of the invite form and every user
  row's display-name/role controls at both widths shows the established
  Work Blue ring throughout.
- **Impeccable `audit` + `polish` pass on `/settings`.** `audit` scored
  18/20 (Excellent, borderline — Accessibility was the drag). Findings
  shown to the user before any change, per convention: **[P1,
  accessibility/UX]** the two save-on-blur fields (`CompanyNameField`,
  `DisplayNameField` in `settings-form.tsx`) gave zero feedback on a
  successful save — no visual confirmation, no `aria-live` announcement,
  nothing — while only the error path rendered anything. Actually
  triggered this live: typed a new company name, blurred, and confirmed
  via reload that the save genuinely persisted server-side, but the UI
  showed no change at all at the moment it happened, making success and
  "still in flight" indistinguishable. **[P2, accessibility]** the helper
  text under each field ("Shown to teammates across the org...", "Signed
  as the recruiter...") and the error message were both only visually
  adjacent to their `Input`, not programmatically associated — confirmed
  live via `aria-describedby` being `null` on both inputs. Fix: added a
  transient "Saved" confirmation in `growth-green` (DESIGN.md's
  success-only color) after a successful save, backed by an always-mounted
  `sr-only` `role="status"`/`aria-live="polite"` region (mounted once,
  not created fresh on each save, since a screen reader can miss a live
  region that doesn't exist yet at the moment content changes); wired each
  input's `aria-describedby` to its helper text (and error text when
  present) with stable ids, and marked the error `<p>` `role="alert"` so
  it's announced without requiring focus to move. Verified live at 1280px
  and 375px by actually triggering real saves (not just checking static
  appearance) on both fields at both widths — screenshotted the visible
  "Saved" text appearing in Growth Green after a real blur-triggered save
  round-trip, and confirmed via the DOM that the `sr-only` status region's
  text updates on the same event. Confirmed `aria-describedby` now
  resolves to the helper text's `id` on both inputs. Full keyboard
  Tab-through of both fields at both widths shows the same established
  Work Blue ring. Any test values typed during verification (temporarily
  extended the "Saved" message's 2s auto-dismiss to 15s to capture a real
  screenshot of it, then reverted) were reverted back to their original
  values afterward, confirmed via reload.
- **Impeccable `audit` + `polish` pass on the sidebar — desktop `layout.tsx`/`sidebar-nav.tsx`/`wordmark.tsx` and the mobile slide-out nav (`mobile-nav.tsx`).**
  `audit` scored 19/20 (Excellent). Findings shown to the user before any
  change, per convention: **[P2, accessibility/consistency]** every nav
  link (module links, Settings, Admin), the logo/wordmark link (both the
  shared `Wordmark` component and the mobile top bar's own inline copy),
  and both `Sign out` buttons (desktop sidebar + mobile Sheet) relied on
  the browser's thin default focus outline rather than the app's
  deliberate `focus-visible:ring-3 focus-visible:ring-ring/50` box-shadow
  ring every other interactive element uses — the same class of gap
  already found and fixed once on the board's drawer "View full profile
  →" link, and noticeably fainter here against the dark Ink Navy sidebar
  background specifically. Explicitly checked three things the user
  flagged as easy to get wrong, and found all three already correct: the
  disabled "Coming soon" items (Onboarding, Kickoff) are plain `<div>`s
  with no `tabindex`, confirmed live that Tab skips them entirely rather
  than landing on a dead control; the module/Settings divider is a real
  `<hr>`, confirmed live in the accessibility tree as a `separator` node,
  not just a styled line; the logo (`link "us. upscalesupport"`) and
  Sign out (`button "Sign out"`) both already had clear accessible names.
  Fix: added `outline-none focus-visible:ring-3 focus-visible:ring-ring/50`
  to `sidebar-nav.tsx`'s shared `navLink()`, `wordmark.tsx`, the mobile
  top bar's inline logo link, and both `Sign out` buttons — no new
  tokens, reusing the exact ring treatment already established elsewhere.
  Verified live at 1280px and 375px: re-ran the full keyboard Tab-through
  on both the desktop sidebar and the mobile Sheet (logo, active/inactive
  nav items — confirming disabled items are still correctly skipped —
  Settings, Admin, Sign out), screenshotting the moment focus landed on
  each — all now show the same clearly visible Work Blue ring used
  throughout the rest of the app. Also re-confirmed, per the task's
  explicit ask, that the mobile Sheet's auto-close-on-navigation (a real
  bug fixed during the original responsiveness pass) has not regressed:
  navigated via keyboard (Tab to a nav link, Enter) and confirmed the
  `dialog` node is gone from the accessibility tree afterward, with focus
  correctly returned to the "Open menu" trigger.
- **Impeccable `audit` + `polish` pass on `/talent-acquisition/candidates/[id]`.**
  `audit` scored the page 19/20 (Excellent). Findings shown to the user
  before any change, per convention: **[P2, accessibility]** all 5 `Select`
  triggers on the page (Stage, Role, Source, Communication in
  `candidate-detail-form.tsx`; Assigned to in `assignment-field.tsx`) had no
  accessible name — confirmed live via the accessibility tree as unnamed
  `combobox [ref=...]:` nodes, same class of gap just fixed on the roles
  page. Checked whether the board's shared `StatusBadge` could stand in for
  anything here per the task's ask — it already is reused, correctly, for
  the header status pill (`page.tsx:153`); no duplicated status/cadence
  logic was found to extract. Implementation Integrity verdict: pass —
  detector (`impeccable detect --json`) returned zero findings both before
  and after. Fix: added `aria-label` to each of the 5 `SelectTrigger`s,
  matching their visible labels. Verified live at 1280px and 375px,
  including a full keyboard Tab-through of every interactive element on the
  page — Back to board link, all 5 selects, Notes textarea, Tags input,
  Edit on the roles page link — screenshotting the moment focus landed on
  each: all show a clear Work Blue ring at both widths. No horizontal
  overflow at 375px (`scrollWidth === clientWidth`, both 360px).
- **Impeccable `audit` + `polish` pass on `/talent-acquisition/roles`.**
  `audit` scored the page 16/20 (Good). Findings shown to the user before
  any change, per convention: **[P2, theming]** the "Project-Based"
  classification badge filled its background with Sun Gold — the same
  Five Percent Rule violation just fixed on the board, introduced in the
  earlier "four new fields" task before `DESIGN.md` existed to catch it.
  **[P2, accessibility]** the Job description textarea and the
  Status/Classification `Select` triggers in `role-row.tsx` had no
  accessible name — confirmed live via the accessibility tree.
  **[P3, implementation integrity]** `CLASSIFICATION_LABELS` and a `"none"`
  sentinel were copy-pasted verbatim across `role-row.tsx` and
  `new-role-form.tsx`. Checked whether the board's shared `StatusBadge`
  could be reused here per the task's ask — it can't: it's typed to
  candidate-specific cadence/due-date concepts (`CandidateStatus`/
  `NextAction`), and role status/classification is a different domain
  entirely; forcing it in would mean faking a `NextAction`. Treated the
  `CLASSIFICATION_LABELS` duplication as the honest equivalent finding
  instead. Fixes: Sun Gold moved to a small accent dot (new
  `CLASSIFICATION_DOT` map, same pattern as the board's fix); added
  `aria-label`s to the three unnamed controls; extracted the duplicated
  label map into a new shared `src/lib/talent-acquisition/
  role-classifications.ts` (mirroring `source-platforms.ts`). Verified
  live at 1280px and 375px, including — given the board's focus-ring
  regression found last session — a full keyboard Tab-through of every
  interactive element on the page (Back button, all New Role form fields,
  all five controls on an existing role row), screenshotting the moment
  focus landed on each: all show a clear Work Blue ring. None of this
  page's `Card` usages wrap a flush-fit nested button the way the board's
  did, so that clipping bug's precondition doesn't exist here.
- **Candidate cards were keyboard-focusable but showed no visible focus
  ring — a regression from the previous keyboard-accessibility fix.**
  Root cause: `Card` (`src/components/ui/card.tsx`) applies `overflow-hidden`
  as a fixed base class, and the nested `<button>` fix from the prior entry
  sat flush with the card's own edges — a box-shadow (what a Tailwind
  `ring` is) gets clipped by an *ancestor's* `overflow-hidden` once it
  extends past that ancestor's box, so the button's `focus-visible:ring-3`
  class was computing correctly and rendering nothing. Not a global
  `outline-none` reset, as first suspected — every other interactive
  element on the page (`Input`, `Select`) already showed its ring
  correctly, since none of them sit inside an `overflow-hidden` ancestor
  sized flush to their own edges. Fixed by moving the ring to the outer
  `Card` via Tailwind's `has-[:focus-visible]` variant instead of the
  nested button — an element's own shadow is never clipped by its own
  `overflow`, only by an ancestor's — plus `overflow-visible` on the `Card`
  instance as a second layer of insurance. While in there, per the task's
  explicit ask, also checked the drawer's Stage `Select` (already correct)
  and the search `Input` (already correct), and found the drawer's "View
  full profile →" link had no explicit focus style at all, relying on the
  browser's thin default outline — brought it in line with the same
  `focus-visible:ring-3 focus-visible:ring-ring/50` treatment used
  everywhere else for consistency. Verified live via Playwright MCP:
  screenshotted the moment right after Tab landed on each of five elements
  (search input, both board cards, drawer Select, drawer link) — all five
  now show a clearly visible Work Blue ring, not just "Tab reaches them."
  New fragile-area note added to `PROJECT_STATE.md` §10.
- **Impeccable `audit` + `polish` pass on `/talent-acquisition/board`.**
  `audit` scored the page 15/20 (Good): a mechanical detector found nothing,
  but manual review plus live verification (contrast math, an
  accessibility-tree check, both viewport widths) surfaced real issues.
  Findings shown to the user before any change, per the audit's own
  "show findings first" convention; user chose to fold the one P1 in with
  the requested polish pass rather than defer it.
  - **[P1, accessibility] Candidate cards were unreachable by keyboard or
    screen reader.** They were plain `onClick` `<div>`s wrapped in `Card` —
    confirmed via Playwright's accessibility tree as `role="generic"` with
    no accessible name. Fixed by nesting a real `<button type="button">`
    inside `Card` (which has no polymorphic `render` prop, unlike
    `Button`/`Sheet`/`Select` — see the fragile-area note added to
    `PROJECT_STATE.md` §10) with a descriptive `aria-label` built from the
    same status string already shown on the card. Verified live: Tab
    reaches the card, Enter opens the drawer.
  - **[P2, theming] The "soon" status badge filled its whole background
    with Sun Gold — a direct violation of `DESIGN.md`'s Five Percent Rule**
    ("never a background, never a large fill"), a locked brand-guide
    decision, not a default. Fixed by moving Sun Gold to a small accent dot
    before the label instead, on the same neutral chip `done`/`parked`
    already use. Considered a colored left-border accent first; rejected it
    since Impeccable's own craft-floor guidance bans colored side-borders on
    cards/chips, and Sun Gold as text color fails contrast outright
    (1.48:1–1.70:1, checked). The badge-render logic (`Badge` + optional dot
    + label) had already been hand-copied across three files — pulled into
    one new shared `src/lib/talent-acquisition/status-badge.tsx`
    (`StatusBadge`) instead of duplicating a fourth time, so the board card,
    board drawer, and candidate detail page all render it identically now.
  - **[P2, theming] Column container radius (8px) didn't match `DESIGN.md`'s
    own container-radius rule (12px)** — the nested candidate `Card`s
    already used 12px. `rounded-t-lg`/`rounded-b-lg` → `rounded-t-xl`/
    `rounded-b-xl` in `board-client.tsx`.
  - **[P2, accessibility] Search input had no real accessible label** beyond
    its placeholder — added `aria-label="Search candidates"`.
  - Verified live via Playwright MCP before and after, at 1440px and 375px:
    confirmed both theming fixes render correctly (temporarily backdated a
    real candidate's `last_action_at` via direct REST to force a live
    "soon" status, reverted afterward), zero console errors, and explicitly
    re-confirmed the board's custom scroll-position indicator from the
    earlier scrollbar-visibility fix still renders correctly at 375px — no
    regression. Re-ran the deterministic `impeccable detect` scanner on
    every touched file before and after: zero findings both times.
### Added
- **Back-to-board button on `/talent-acquisition/roles`.** A styled
  `Button` (`variant="outline"`, `size="sm"`), rendered as a `Link` to
  `/talent-acquisition/board`, placed directly above the "Roles"
  heading — matching the `outline`-styled `Delete` button already used
  elsewhere on this page, not a default unstyled link. Hit and fixed a
  real Base UI runtime error: `Button`'s underlying primitive defaults
  `nativeButton` to `true` and throws a console error if `render` swaps
  in something other than an actual `<button>` (here, a `Link`, which
  renders an `<a>`) without also passing `nativeButton={false}` — it
  type-checks and builds cleanly, only surfacing as a console error the
  first time the page actually renders. Verified live at desktop and
  375px mobile widths: renders correctly positioned, and clicking it
  navigates to the board.
- **Four new fields: `roles.timezone_overlap`/`classification`, `candidates.source_platform`/`communication_rating`.**
  New migration `20260919110000_add_role_and_candidate_fields.sql` —
  `roles.timezone_overlap` (text, nullable, free text e.g. "4hrs
  PHT/EST"), `roles.classification` (text, nullable, `check` constrained
  to `'embedded_operator'`/`'project_based'`), `candidates.source_platform`
  (text, nullable — JobStreet/Kalibrr/OnlineJobs.ph/LinkedIn/Bossjob/
  Referral/Other), `candidates.communication_rating` (int, nullable,
  `check (between 1 and 5)`). Applied by the user via the established
  `supabase db push --db-url` workaround (this session has no DB
  password, only the API keys), confirmed live afterward via a REST
  check on both tables, and confirmed the check constraint actually
  rejects an invalid `classification` value. No RLS/grant changes needed
  — both tables' existing "update within org" policies and the blanket
  `ALTER DEFAULT PRIVILEGES` grant already cover any column added to
  them. `timezone_overlap`/`classification` are on the roles create/edit
  form and row (`new-role-form.tsx`/`role-row.tsx`), the latter shown as
  a small colored `Badge`. `source_platform` is a dropdown on the New
  Candidate dialog and the candidate detail page; `communication_rating`
  is a 1–5 dropdown on the detail page only (not required at creation —
  it's normally set after a phone screen) — both render as plain text
  inside their `Select` trigger ("Source: Kalibrr", "Communication:
  4/5"), not a colored badge, per the task's explicit ask. Hit and fixed
  a real bug: `SOURCE_PLATFORMS` was originally exported as a plain
  `const` from `candidates-actions.ts` (a `"use server"` file) — that
  file's transform only preserves async-function exports for the client
  reference and silently drops everything else, so it type-checked and
  built cleanly but threw `SOURCE_PLATFORMS.map is not a function` the
  first time a client component actually rendered with it. Fixed by
  moving it to its own plain module, `src/lib/talent-acquisition/
  source-platforms.ts`. Verified live end-to-end: created and edited
  roles with both new fields (persisted after reload); created a
  candidate with a source platform via the dialog and confirmed it
  carried through to the detail page; set a communication rating on the
  detail page and confirmed it persisted after reload. Test data cleaned
  up afterward.
### Changed
- **Sidebar layout follow-up (cosmetic, no schema/Server Action changes).**
  Two changes to the sidebar built in the previous entry. (1) The
  greeting + display name moved from the top (below the logo) to the
  bottom, directly above "Sign out" — same `Greeting` component, just
  relocated in `layout.tsx` and `mobile-nav.tsx`'s JSX (grouped into the
  bottom `<div>` with the sign-out `<form>` instead of the top one with
  `Wordmark`/`SidebarNav`). (2) `SidebarNav` now renders two visually
  distinct groups instead of one flat list: the modules (Talent
  Acquisition Desk, plus the disabled Onboarding/Kickoff placeholders)
  stay together at the top; Settings and Admin (when `isAdmin`) moved to
  a second group below a `stone`-toned `<hr>` divider
  (`border-stone/20`, per DESIGN_SYSTEM.md's border-color token — the
  same color card borders/dividers already use elsewhere). Verified live
  at both desktop and 375px mobile widths — the mobile slide-out `Sheet`
  is a separate component (`mobile-nav.tsx`) from the desktop `<aside>`
  and needed its own check, not just an assumption that fixing
  `SidebarNav` (shared by both) was sufficient: confirmed the divider
  and bottom-greeting placement both render correctly inside the Sheet
  too, not just the always-visible desktop sidebar.
### Security
- **Sidebar polish — step 4 of 4 on the admin/assignment feature (closes it out).**
  UI-only, no schema or Server Action changes. Three parts: (1) the
  sidebar and mobile nav now show the signed-in user's own
  `profiles.display_name` — previously the only identity shown anywhere
  in the shell was the org wordmark ("upscalesupport") and a static
  "Client Fulfillment App" label, with no per-user information at all.
  `layout.tsx` fetches it via a plain own-row `SELECT` (already covered
  by the existing "profiles: select own row" RLS policy — no new grant)
  and passes it to both `layout.tsx`'s desktop sidebar and
  `mobile-nav.tsx`'s slide-out `Sheet`. (2) A new `Greeting` component
  (`src/components/shell/greeting.tsx`) shows one of eight greetings —
  "What's up", "Aloha", "Hola", "Mabuhay", "Kumusta", "Good night",
  "Magandang gabi", "Buon giorno" — picked at random next to the display
  name, small and plain per DESIGN_SYSTEM.md's tone. Hit a real
  hydration mismatch building this (picking randomly in `useState`'s
  lazy initializer runs once during SSR and again on the client with a
  different `Math.random()` result); fixed with `suppressHydrationWarning`
  on just the greeting text node, the correct tool for intentional
  client-only randomness, rather than restructuring into an
  effect-based two-render pattern (which would have tripped this repo's
  `react-hooks/set-state-in-effect` ESLint error, the same rule
  `mobile-nav.tsx` already works around for its Sheet-close logic). (3)
  `Wordmark` (`src/components/shell/wordmark.tsx`) is now a real
  `<Link href="/talent-acquisition/board">` with a hover state, in both
  the desktop sidebar and the mobile top bar/Sheet, instead of static
  markup — the board is the closest thing this app has to a home route
  (there's no `src/app/page.tsx` at `/`), matching `SidebarNav`'s own
  default destination. Verified live with two accounts: non-admin and
  admin each see their own distinct display name and a randomly-differing
  greeting (confirming genuinely per-user, per-load values, not a shared
  or cached one); the admin additionally sees the "Admin" nav link;
  clicking the logo navigates correctly from `/settings` and from the
  board itself, at both desktop and 390px mobile width, including from
  inside the mobile Sheet. Checked grants: none needed. This closes out
  all 4 steps of the admin/assignment feature.
- **Candidate assignment — step 3 of 4 on the admin/assignment feature.**
  Surfaces `candidates.assigned_to` (added in step 1) on
  `/talent-acquisition/candidates/[id]`: everyone sees who a candidate is
  currently assigned to (display name, or "Unassigned"); only admins get
  a control to change it. New `assignment-field.tsx` renders read-only
  text or an admin-only `Select` based on `isAdmin`, decided server-side
  via `getUserRole()` in `page.tsx` — the same "convenience UI, not the
  boundary" pattern as the admin nav link (step 2). The actual boundary
  is the new `updateCandidateAssignment` (in
  `talent-acquisition/candidates-actions.ts`), which requires two checks
  per the task's explicit ask: `requireAdminUser()`, and that the target
  profile is visible to the caller — mirroring `assertRoleIsVisible`'s
  exact mechanism for `role_id` (a plain scoped `SELECT`, "not found"
  treated as "not visible," not a bare trust of the foreign key).
  Notably, this action uses the **normal RLS-scoped client, not
  `admin-client.ts`** — RLS's "candidates: update within org" policy
  already lets any org member write `assigned_to`, so nothing in the
  database stops a non-admin from calling this; `requireAdminUser()` is
  the *only* thing that does, a clean illustration of SECURITY.md's
  authorization-beyond-RLS rule with zero help from the database. Same
  reasoning for the assignable-profiles dropdown list (`id`,
  `display_name` via the normal client) — RLS's "profiles: select own
  org" already permits this read for any signed-in user, admin or not,
  so there's no wall to bypass; reserving `admin-client.ts` for cases
  that actually need it (per the architecture decision from step 2).
  The current assignee's name is fetched via a
  `profiles!assigned_to(id, display_name)` embed — `candidates` now has
  *two* FKs to `profiles` (`created_by`, `assigned_to`), so the
  column-name disambiguation hint is required; verified this exact
  syntax directly against the live REST API (both null and populated
  cases) before wiring it into the page. Verified live end-to-end with
  two accounts: the member sees plain read-only "Unassigned" text with
  no control; the admin sees the `Select`, correctly lists both org
  profiles (with an "Unnamed teammate" fallback for a null
  `display_name`), and both assigning and clearing an assignment persist
  across a full page reload. Checked grants: none needed, no new
  migration — both queries go through already-granted tables via
  RLS-respecting clients.
- **Admin page (`/admin`) — step 2 of 4 on the admin/assignment feature.**
  Explicit page-level authorization, not just a hidden nav link:
  `getUserRole()` is checked in `page.tsx` before any data fetch, and a
  non-admin navigating there directly gets a real `notFound()` (404), not
  a redirect that would confirm the route exists. Verified live with two
  separate accounts, not just "as me": the admin sees the full page; the
  member gets the 404 and sees no "Admin" link in either the desktop
  sidebar or the mobile menu. New `src/lib/supabase/admin-client.ts`
  (renamed from a previously-scaffolded, never-used `service.ts` —
  same service-role implementation, reused rather than duplicated) is
  now **the one place in this codebase that intentionally bypasses
  RLS**; see the fragile-area note added to `PROJECT_STATE.md` §10.
  Lists every user (email via `supabase.auth.admin.listUsers()` — the
  only way to get email, since `profiles` doesn't store it — joined with
  `profiles` for role/display_name). An "Invite a teammate" form
  (`inviteUser` in new `src/lib/admin-actions.ts`) uses
  `supabase.auth.admin.inviteUserByEmail()`, not a signup + admin-set
  password, so the admin never sets or sees another user's password —
  verified live that both a Supabase-rejected bad-domain address and a
  real-looking one hitting Supabase's own project email rate limit both
  correctly surface as this app's generic "Couldn't send the invite"
  message (SECURITY.md's fail-securely rule), never the raw Supabase
  error. Per-row role `Select` (`updateUserRole`) and inline display-name
  edit (`updateUserDisplayName`) both write through the admin client, not
  the normal RLS-scoped one — RLS's "profiles: update own row" policy
  only ever lets a caller touch their *own* row, so there's no policy an
  admin editing someone *else's* row could go through otherwise.
  `updateUserRole` guards two failure modes, per the task's explicit
  ask, both verified live: an admin can't demote themselves
  (unconditional, not dependent on admin count — tried it, got "You
  can't demote yourself.", role reverted in the UI); demoting the last
  remaining admin is blocked by counting current admins before allowing
  the change (code-reviewed rather than independently live-reproduced —
  with two test accounts, reaching "the target is the sole admin" always
  also means the target is the acting user, which the self-demotion
  guard already catches first). All three actions call
  `requireAdminUser()` (new addition to `src/lib/auth/get-user-role.ts`,
  alongside the existing `getUserRole()`/`requireAdmin()` — returns the
  acting user too, needed for the self-demotion comparison) independently
  of the page's own check, since Server Actions are reachable as their
  own endpoints regardless of what page links to them (SECURITY.md).
  **Flagged for rate-limiting review**: `inviteUser` sends an external
  email with no app-level rate limit implemented yet — noted in the
  action's own code comment; Supabase's project-level email rate limit is
  the only backstop today (confirmed it's live, see above). Checked
  grants: none needed — `auth.admin.*` runs off the service-role key
  directly (not a PostgREST/RLS table read), and the `profiles` writes go
  through the already-granted service-role Postgres role. Also confirms
  the step-1 migrations below are now live in the database (verified
  directly against `profiles`/`candidates`, not just assumed).
- **Role-based authorization foundation — step 1 of 4 toward an admin
  page + candidate-assignment feature. Schema and a helper only. This is
  a genuine security-model shift, not just a feature add**: every
  authorization check in this app before this had been org-membership-only
  (RLS's `org_id = current_org_id()`); this added the app's first
  role-based (admin vs. member) concept. Two migrations — **now confirmed
  applied** (were written but not yet applied when first added; see the
  step-2 entry above): `profiles.role` (`text`, `check (role in
  ('admin','member'))`, default `'member'`), and `candidates.assigned_to`
  (`uuid references profiles(id)`, nullable, indexed — unused until the
  reassignment feature itself is built). The `profiles.role` migration
  also adds a `before update` trigger, `prevent_self_role_escalation`:
  the existing "profiles: update own row" RLS policy has no column-level
  restriction, so without this trigger any authenticated user could
  `PATCH` their own `role` to `'admin'` via a direct Supabase REST call,
  entirely bypassing this app's own Server Actions (which never expose a
  raw arbitrary-column update). The trigger blocks that specific attack
  vector while still allowing a service-role/SQL-Editor session through
  (`auth.uid()` is null there) — which is what made the first admin's
  manual SQL bootstrap possible, and is also why `/admin`'s own
  service-role writes (step 2, above) aren't blocked by this same
  trigger. New `src/lib/auth/get-user-role.ts` (`getUserRole()`,
  `requireAdmin()`) — every admin-only Server Action must call this (or
  `requireAdminUser()`, step 2) and check the result explicitly inside
  the action itself, not just hide the UI that links to it, per
  SECURITY.md's authorization-beyond-RLS rule. Checked grants: none
  needed, both tables are already covered by the existing blanket
  table-level grant (new columns on an existing granted table don't need
  a fresh grant).

### Changed
- Mobile responsiveness pass across the whole shell and every existing
  page. The sidebar (`src/app/(shell)/layout.tsx`) was a fixed `w-64`
  always-visible `<aside>` with no responsive behavior at all; below `md`
  it's now hidden in favor of a new `src/components/shell/mobile-nav.tsx`
  — a compact top bar (monogram + app name + hamburger) that opens the same
  `SidebarNav` content in a slide-out `Sheet`. Root padding on the board,
  roles, candidate detail, and settings pages changed from a flat `p-8` to
  `p-4 sm:p-8` so phone-width viewports get a sane gutter instead of 64px
  of desktop padding. The board's and candidate detail page's title-row
  layouts (name/title next to a badge or link) got `flex-wrap` + `min-w-0`
  on the growable side so long content wraps instead of overflowing at
  narrow widths — this turned out to be the same flex-shrink bug category
  as the board's `min-w-0` scrolling fix, just showing up on ordinary
  content rows instead of a scroll container (see `PROJECT_STATE.md` §3).
  Verified live via Playwright MCP at 1440px and 375px for all four pages
  (shell/board/roles/candidate-detail), plus the "+ New Candidate" dialog
  and the board's candidate drawer, which were already responsive with no
  changes needed.
- Fixed a real bug surfaced while building the above: Base UI's `Sheet`
  (the mobile nav menu) didn't close itself after tapping a nav link
  inside it — there's no implicit auto-close on navigation the way some
  UI kits provide. Made it a controlled component that closes on route
  change via `usePathname`, with the state reset done **during render**
  (comparing against a tracked last-seen pathname) rather than in a
  `useEffect`, since the effect version trips this repo's
  `react-hooks/set-state-in-effect` ESLint error. See the Base-UI-Sheet
  gotcha added to `PROJECT_STATE.md` §3.
- Board columns are narrower so all seven fit on a typical desktop viewport
  without horizontal scrolling: column width `w-64 shrink-0` (256px, fixed)
  → `min-w-[140px] flex-1`, the row's `gap-4` → `gap-3`. Sizing only — no
  DESIGN_SYSTEM.md colors, radius, borders, or fonts changed. Narrow windows
  still scroll horizontally, which is expected kanban behavior.
- Fixed the board's column row clipping instead of scrolling at narrower
  widths: `src/app/(shell)/layout.tsx`'s `<main>` was missing `min-w-0`, so
  as a `flex-1` item it grew to fit the columns' full intrinsic width
  instead of respecting the available viewport width, preventing the
  board's own `overflow-x-auto` row from ever needing to scroll. Added
  `min-w-0` to `main`. Verified live via Playwright MCP at 1440px (no
  scroll needed), 1100px and 800px (scrollbar present, scrolling to the end
  reveals every column, nothing clipped).
- The board's horizontal scroll worked but had no visible affordance — the
  native scrollbar only appears on hover/active-scroll (or not at all,
  depending on OS "show scrollbars" settings; confirmed unreliable even
  with `::-webkit-scrollbar`/`scrollbar-color`/`scrollbar-width` CSS during
  testing). Replaced it with a custom always-visible scroll-position
  indicator: `useHorizontalScrollThumb` in `board-client.tsx` tracks scroll
  extent and renders a thin on-brand (`stone` track, `ink-navy`-tinted
  thumb) bar below the column row, shown only when the row actually
  overflows; the native scrollbar is hidden via the `.board-scrollbar`
  utility in `globals.css`. Verified live via Playwright MCP: indicator
  absent at 1440px, present immediately on fresh page load (no scroll/hover
  needed) at 1100px/800px, and its thumb position/width tracks real scroll
  state correctly.

### Added
- `/settings` (app-level, outside `talent-acquisition/`): company name
  (`org_settings.company_name`, org-scoped — any signed-in user can edit
  it) and the signed-in user's own display name (`profiles.display_name`,
  restricted by RLS to the caller's own row), both save-on-blur following
  the same pattern as `role-row.tsx`/`candidate-detail-form.tsx`. New
  `src/lib/settings-actions.ts` (`updateCompanyName`, `updateDisplayName`).
  Checked grants: no new migration needed, both tables already covered by
  the existing `ALTER DEFAULT PRIVILEGES` migration. Added a real
  "Settings" nav link to `SidebarNav` (previously only the one Talent
  Acquisition Desk item plus the disabled Onboarding/Kickoff placeholders).
- `loading.tsx` for the board, roles, candidate detail, and settings
  routes — plain centered muted text, matching this app's no-spinner
  tone. None of the four routes had one before, so a slow fetch during
  navigation showed a blank page instead of any feedback. The existing
  empty states from earlier prompts (roles: "No roles yet…", board:
  "No one here yet" per column, candidate detail's job-description/
  next-action/history empty text) were checked and are still correct —
  no changes needed there.
- `/talent-acquisition/candidates/[id]`: the full candidate detail page —
  stage dropdown (`updateCandidateStage`), role reassignment dropdown
  including "No role — Talent Pool" (`reassignCandidateRole`), notes and
  tags fields (save-on-blur, `updateCandidateNotes`/`updateCandidateTags`),
  a read-only job-description panel sourced from the assigned role with a
  link to `/talent-acquisition/roles` to edit it, the next-action label with
  its rendered script, and the full `candidate_history` log (newest first).
  The board's drawer stays intentionally minimal (stage + next-action only)
  — its "coming soon" note is now a "View full profile →" link to this page.
  Added `src/lib/talent-acquisition/scripts.ts`, porting the prototype's
  `scriptText()` templates verbatim as a pure function taking
  `companyName`/`recruiterName` as explicit params (sourced from
  `org_settings` and the caller's own `profiles` row) instead of the
  prototype's local-storage settings object. Pulled the status-badge
  style/label maps — previously duplicated in `candidate-card.tsx` and
  `candidate-drawer.tsx` — into a shared
  `src/lib/talent-acquisition/status-styles.ts` now that a third place
  needed them. Checked whether this page's reads/writes
  (`candidates`, `roles`, `org_settings`, `profiles`, `candidate_history`)
  need any grants beyond the existing `ALTER DEFAULT PRIVILEGES` migration:
  no, all five are already covered — no new migration needed.
- Fixed the new-candidate form's role `Select` showing each option's raw
  UUID as the trigger's visible value instead of its title — Base UI's
  `Select.Value` renders the underlying value literally unless given a
  `children` render-prop mapping value → label. Added a `roleLabelFor()`
  helper and passed it to `SelectValue` as that render prop; the submitted
  `role_id` (the UUID) was unaffected.
- Follow-up to the candidate detail page: re-checked grants (still none
  needed — `profiles`/`org_settings`/`candidate_history` are all covered by
  the existing `ALTER DEFAULT PRIVILEGES` migration, confirmed by reading
  the migration directly, not just re-asserting the earlier note) and
  ported-script fidelity (`scripts.ts` diffed line-by-line against the
  prototype's `scriptText()` in `recruiting-desk.html` — verbatim match).
  Added `revalidatePath` for the candidate's own detail path
  (`/talent-acquisition/candidates/[id]`) to `updateCandidateStage`,
  `updateCandidateNotes`, `updateCandidateTags`, and
  `reassignCandidateRole` in `candidates-actions.ts` — these only
  revalidated the board path before, so the page's own History log and
  next-action display wouldn't reflect an edit made from this page without
  a hard refresh. Fixed the History list's date column getting clipped by
  the card's `overflow-hidden` at narrow widths (missing `min-w-0 flex-1`
  on the label span let it push the date past the card edge instead of
  wrapping — same category of flex-shrink bug as the board's `min-w-0`
  gotcha, see `PROJECT_STATE.md` §3). Verified live via Playwright MCP
  (manual-login-pause convention): screenshotted a real candidate
  (Gil Demiar) at 1440px — clean, no cramping/misalignment — and confirmed
  the page has no internal scrollable region (the only `overflow-y: auto`
  element is the empty notes `<textarea>`, not actually overflowing), so
  the board's custom-scroll-indicator pattern doesn't apply here; normal
  full-page scroll is correct as-is.
- A "+ New Candidate" button on the board opens a `Dialog` form
  (`new-candidate-form.tsx`) calling `createCandidate` — name, an optional
  notes field and a comma-separated tags field (matching the prototype's
  add-candidate modal plus the tags field it didn't have), and a role picker
  offering an existing role, "+ Create new role" (shows an inline title
  field, creates the role alongside the candidate), or "No role — Talent
  Pool" (defaults the candidate to the `talent_pool` stage). The board page
  now also fetches the roles list to populate the picker. Closing the dialog
  on success relies on the same `revalidatePath` the action already calls,
  so the new card just appears in its column.
- `/talent-acquisition/board`: seven columns (Talent Pool, then the six
  pipeline stages), reading live from `candidates` joined to `roles` for the
  title shown on each card, sorted by next-action due date ascending within
  each column. A search box filters visible cards by name, role title, and
  tags (client-side for v1, per the brief). Clicking a card opens a
  drawer (shadcn `Sheet`) with a stage selector wired to
  `updateCandidateStage`; deeper editing (notes, tags, role reassignment)
  is intentionally left for the candidate detail page next, not duplicated
  here. Layout/interaction (columns, drawer, status badges) is ported from
  the prototype; all visual styling is `DESIGN_SYSTEM.md`'s tokens instead
  of the prototype's own look — Warm Paper background, Stone-bordered cards,
  Work Blue accents, Bricolage Grotesque headers, tabular numerals on the
  per-column counts.
- `src/lib/talent-acquisition/cadence.ts`: `STAGE_CONFIG`, `nextActionFor`,
  and `statusFor` ported from the prototype's cadence math as pure functions,
  plus a `talent_pool` stage config (no touches, no recurring reminder — a
  deliberate no-pressure resting state, not an oversight) and its own status
  outcome (`'parked'`, always shown instead of overdue/soon/ok regardless of
  the underlying action). 13 unit tests in `cadence.test.ts` cover touch-index
  progression, the exhausted→terminal and exhausted→recurring transitions,
  the recurring-reminder date math (from `last_action_at` when present,
  `stage_entered_at` otherwise), and the overdue/soon/ok status boundaries.
  Added `vitest` as a dev dependency to run them (`npm test`) — the first
  automated tests in this repo.
- Checked whether the board's queries need any grants beyond the existing
  `ALTER DEFAULT PRIVILEGES` migration: no new tables were added and the
  board only reads `candidates`/`roles`, both already covered — no new
  migration needed.
- Server-side CRUD for candidates:
  `src/lib/talent-acquisition/candidates-actions.ts` (`createCandidate`,
  `updateCandidateStage`, `updateCandidateNotes`, `updateCandidateTags`,
  `reassignCandidateRole`) — same auth pattern as the roles actions
  (`getUser()`-derived user, fail-securely on errors). Candidate creation
  matches the prototype's add-candidate flow (name, notes, tags) plus a role
  choice the prototype didn't have to make (its "role" was free text; ours is
  a real FK): pick an existing role, create one inline, or leave it unset —
  unset defaults the candidate to `talent_pool` instead of `sourced`.
  `updateCandidateStage` mirrors the prototype's `moveStage()` exactly
  (resets `stage_entered_at`/`last_action_at`/`touch_index` and logs a
  `candidate_history` row). Added an explicit authorization check beyond RLS
  for any action that accepts a `role_id`: a role's RLS `select` policy
  governs direct reads of that table, but doesn't stop an arbitrary UUID from
  another org being accepted as a foreign key elsewhere, so `role_id`s are
  re-verified visible to the caller before use. No UI for this yet — the
  add-candidate form and board live in the next prompt.
- Server-side CRUD for roles: `src/lib/talent-acquisition/roles-actions.ts`
  (`createRole`, `updateRoleTitle`, `updateRoleJobDescription`,
  `updateRoleStatus`, `deleteRole`) — every action derives the user via
  `getUser()` server-side (never a client-passed id), relies on RLS org
  scoping for authorization (no external side effect to separately check),
  and fails securely with generic messages while logging real errors
  server-side. `/talent-acquisition/roles` lists roles with an inline-editable
  title, job description, and status (save-on-blur / save-on-select, each
  field its own Server Action call), a status badge, a live candidate count
  per role, delete (blocked with a friendly message if candidates still
  reference the role), and a form to add a new role.
- Found and fixed a real bug while building this: the tables from the Prompt 3
  migration had RLS but no table-level Postgres `GRANT`s, so every request —
  even with the service-role key — failed with "permission denied", before
  RLS was ever evaluated. Added
  `supabase/migrations/20260914060451_fix_grants_and_roles_delete_policy.sql`
  (grants + default privileges for `authenticated`/`service_role`, deliberately
  none for `anon`) alongside the roles `delete` RLS policy this task needed.
  Neither this nor the Prompt 3 migration has been applied yet — see
  `docs/PROJECT_STATE.md`.
- Database schema as a Supabase migration
  (`supabase/migrations/20260914053122_initial_schema.sql`), not applied —
  `profiles`, `roles`, `candidates`, `candidate_history`, `candidate_drafts`,
  and `org_settings` per `BUILD_BRIEF.md` §4, with RLS enabled on every table
  and org-scoped select/insert/update policies (derived through the parent
  `candidates` row for the two tables without their own `org_id` column). Adds
  a `security definer` `current_org_id()` helper so the `profiles` table's own
  policy can check org membership without recursive RLS. Seeds the single
  hardcoded org's `org_settings` row.
- Invite-only Supabase email/password auth: a `/login` page (outside the shell)
  backed by a `login` Server Action, and a `(shell)` route group whose layout
  checks `supabase.auth.getUser()` server-side and redirects unauthenticated
  requests to `/login` — no public sign-up route. The shell sidebar shows a
  text-based stand-in for the UpScaleSupport wordmark alongside "Client
  Fulfillment App", with "Talent Acquisition Desk" active and "Onboarding" /
  "Kickoff" as disabled "Coming soon" items. Added a sign-out Server Action.
  Root `/` now lives inside the shell and redirects to
  `/talent-acquisition/board` (placeholder page for now), replacing the
  Prompt 1 demo page. Verified locally against a real Supabase project and
  redeployed to Vercel with the real project's env vars.
- Scaffolded the Next.js (App Router, TypeScript) project, Tailwind CSS v4 with a
  CSS-first `@theme` config carrying the UpScaleSupport brand tokens (colors,
  Bricolage Grotesque + Inter, no dark mode), and shadcn/ui. Wired up
  `@supabase/ssr` (cookie-based client/server/proxy helpers, `getUser()` only —
  never `getSession()`) plus a server-only service-role client. Added
  `.env.example` and deployed a minimal build to Vercel to confirm the pipeline
  works end to end.

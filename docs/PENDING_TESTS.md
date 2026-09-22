# Pending Tests — Blocked on ANTHROPIC_WORKSPACE_ID

Run this entire file top to bottom once `ANTHROPIC_WORKSPACE_ID` (or a workspace-scoped key) is confirmed working via the `curl` check from earlier. Check items off as you go rather than trusting memory — there are three separate features queued up here.

**Before starting:** confirm the key actually works first —
```bash
source <(grep -E '^(ANTHROPIC_API_KEY|ANTHROPIC_WORKSPACE_ID)=' .env.local)
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  ${ANTHROPIC_WORKSPACE_ID:+-H "anthropic-workspace-id: $ANTHROPIC_WORKSPACE_ID"} \
  -d '{"model":"claude-sonnet-4-6","max_tokens":16,"messages":[{"role":"user","content":"Say OK"}]}'
```
Real content back, not an `error` block, before touching anything below. Also add `ANTHROPIC_WORKSPACE_ID` to Vercel's production environment variables if you haven't yet — the local fix alone doesn't reach the deployed app.

---

## 1. Prompt 8 — AI draft generation (BUILD_BRIEF.md §5)

- [ ] Open a candidate with a role + real job description assigned → trigger "generate suggested message" → confirm a sensible, specific result, not an error.
- [ ] Reload → confirm the draft persisted from `candidate_drafts`, not regenerated.
- [ ] Generate a second draft for the same candidate → confirm both save as separate rows.
- [ ] Try a candidate with no role (talent pool) → confirm it handles the missing job description gracefully, no crash.
- [ ] Confirm the generated message renders styled per `DESIGN_SYSTEM.md`, not raw/unstyled text.

## 2. ATS Step 3 — Resume extraction + normalization (existing candidate)

Use the sample resumes already generated: `Andrea_Villanueva_Resume.pdf` and `Andrea_Villanueva_Resume.docx`.

- [ ] Upload the PDF to an existing candidate, trigger extraction.
- [ ] Confirm these auto-match confidently (exact/near-exact canonical names): **TypeScript, Python, Docker, Git, SQL**.
- [ ] Confirm these alias-form skills resolve correctly, either auto-matched or landing in the review queue (check `candidate_skill_reviews` if unsure which): **Prompt Eng → Prompt Engineering, RAG → Advanced Retrieval Techniques, Vector DB → Vector Database Management, CI/CD → CI/CD Pipelines, Node.js → Node.js, LoRA → Model Fine-Tuning, n8n → Workflow Automation**.
- [ ] Confirm **"QC"** resolves to **Quezon City, Metro Manila** (`location_id` set correctly).
- [ ] Repeat the same checks with the `.docx` version on a different candidate — confirm both file types extract equivalently.
- [ ] For anything that landed in the review queue rather than auto-matching, note it — this tells us whether the 0.6/0.35 thresholds from `ATS_FEATURES.md` need adjusting.

## 3. New Candidate creation with resume autofill

- [ ] In the "New Candidate" form, upload `Andrea_Villanueva_Resume.pdf`.
- [ ] Confirm **Name** pre-fills to "Andrea Villanueva" (and remains editable).
- [ ] Confirm a skills list appears as chips (confidently-matched and needs-review items visually distinguished), editable/removable before submit.
- [ ] Confirm **Location** pre-fills (from "QC") and remains editable.
- [ ] Edit one pre-filled value before submitting (e.g. remove a skill chip) → confirm the edit is respected, not silently overwritten.
- [ ] Submit → confirm the candidate is created with: `resume_path` set, confirmed skills in `candidate_skills`, unresolved ones in `candidate_skill_reviews` (now tied to a real `candidate_id`), `location_id` set, and the same skills mirrored into the `tags` column.
- [ ] Open the new candidate's detail page → confirm the resume is attached and downloadable/viewable.
- [ ] Confirm manual candidate creation **without** a resume still works exactly as before — this feature was additive, verify nothing broke for the plain path.

---

Once every box above is checked, this file has served its purpose — fine to delete it or fold a short summary into `PROJECT_STATE.md`'s Current State and clear the corresponding "blocked" notes there.

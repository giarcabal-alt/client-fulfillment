# Client Fulfillment App — Design System

_Source: UpScaleSupport Brand Guide v2 (FINAL), logo locked 2026-07-23. This doc translates the brand guide into dev-usable tokens and app-specific rules. The brand guide itself is canon — if this doc and the brand guide ever conflict, the brand guide wins and this file needs fixing._

---

## 1. Brand context (why the choices below are what they are)

- One line: **AI becomes someone's job.**
- UpScaleSupport embeds trained, AI-fluent operators into client teams, backed by an engineering bench. This internal app (Client Fulfillment App) is how those operators get sourced, onboarded, and deployed — so the tone should read the same way the brand does: accountable, warm, working. Never "AI product" flashy.
- Gut-check for any UI choice not covered explicitly below: **if it would fit on a crypto site, it's wrong.** No gradients, no neon, no glassmorphism, no dark mode.

## 2. Color tokens

| Token | Hex | Usage |
|---|---|---|
| `ink-navy` | `#10243E` | Primary. Headlines, nav, footer, logo. |
| `work-blue` | `#2E6ADF` | CTAs, links, primary buttons, logo accents. |
| `sun-gold` | `#F5B301` | Sparing accent only — **max 5% of any layout.** Never a background, never a large fill. |
| `warm-paper` | `#F7F5F0` | Default background, everywhere. Never pure white, never dark mode. |
| `stone` | `#E8E6DF` | Card borders, dividers. |
| `slate-text` | `#3D4657` | Body copy. |
| `growth-green` | `#1E7A5A` | Success states and positive metrics **only** — don't reach for it decoratively. |

Tailwind v4 `@theme` block (CSS-first, no `tailwind.config.js`) — drop into `globals.css`:

```css
@theme {
  --color-ink-navy: #10243E;
  --color-work-blue: #2E6ADF;
  --color-sun-gold: #F5B301;
  --color-warm-paper: #F7F5F0;
  --color-stone: #E8E6DF;
  --color-slate-text: #3D4657;
  --color-growth-green: #1E7A5A;

  --font-display: "Bricolage Grotesque", sans-serif;
  --font-body: "Inter", sans-serif;
}
```

## 3. Typography

- **Headlines:** Bricolage Grotesque ExtraBold (display), Bold (section heads).
- **Body/UI:** Inter, 1.6 line height.
- **Metrics/numbers:** Inter, tabular figures, semibold — use `font-variant-numeric: tabular-nums` wherever a number sits next to another number (tables, stat cards) so digits align.

## 4. Layout & components

- Background: `warm-paper`, always. No dark mode — don't build a theme toggle.
- Max content width: 1120px.
- Cards: 12px radius, 1px `stone` border, `warm-paper` or white-adjacent fill (don't introduce pure white).
- Buttons: `work-blue` solid fill, white text, 8px radius, **verb-first labels** ("Generate suggested message", not "Message generation"). This app already mostly does this — worth double-checking every button label during the UI build prompts.
- Motion: fade/rise on scroll only. No other animation flourishes.
- Microcopy: plain verbs, first person plural ("we," "our"), use real numbers wherever numbers exist rather than vague language.

## 5. Density

The app had drifted toward reading as visibly AI-generated: oversized type, generous padding, every field boxed in its own bordered input, and too many separate stacked cards for what's really one record. This section locks in a tighter, working-tool density. It doesn't touch colors, fonts, or the radius scale (§2/§3/§4 stay canon) — only type scale, spacing, and how fields/sections are grouped.

- **Type scale:** Body/UI text 14px (Inter). Field labels 12px (the existing `text-xs uppercase tracking-wide text-muted-foreground` label convention already meets this — keep it). Page title ~20px, not the larger 24px+ display headline this app defaulted to for every page `h1`. Section headings 13–14px semibold — Bricolage Grotesque at label size, not the large display weight reserved for the page title itself.
- **Padding:** Tighter than the app's original default throughout — cards/sections use a smaller internal gutter, form rows sit close together. A daily-use operations tool reads dense on purpose; it is not a marketing page.
- **Fewer containers.** Default to **one card with internal 1px `stone` dividers** between logical groups of the same record, not a new bordered card per group. Reserve a separate card/container for content that's genuinely a different object (e.g. a tabbed panel's own surface), not for every subsection of one record.
- **Properties-list pattern**, for a record's own fields (candidate/role attributes, settings, etc.): a small label on the left, the plain value on the right — not a grid of individually bordered inputs. The value reads as plain text at rest; editing affordances (a control's border, a select's chevron) appear only on hover or focus, never at rest. Keyboard focus must still show the Work Blue ring regardless of hover state — density never trades away the existing focus-visible contract.
- **Shared primitives:** `PropertyRow`/`propertyControlClass`/`propertySelectTriggerClass` (`src/components/ui/property-row.tsx`) and `Section`/`SectionDivider` (`src/components/ui/section.tsx`) implement the properties-list and single-card-with-dividers patterns respectively — reuse them for any future record-detail or settings-style page rather than re-deriving the same spacing/hover rules per page.

## 6. Logo usage (for app chrome specifically)

- **Use the digital lowercase wordmark variant** in the app sidebar/header — the brand guide reserves this variant for "social handles and app contexts only," which this is. Never use it in anything printed or client-facing like proposals.
- The **"us." monogram** (spells "us." — embedded operators, on your team) is the brand's strongest asset beyond the wordmark. Good candidates for it inside this app: a small mark on the sidebar collapsed state, an avatar placeholder for operator/candidate records, or a stamp-style mark on any exported report (e.g., a future monthly impact report feature). Navy tile is the primary variant; use blue or outline tile only if navy doesn't have contrast against its background.
- Blue letters + gold dot appear together or not at all — don't recolor or split them. Below 20px display size, use the solid one-color (navy) version only.
- Clear space around the wordmark: the height of its capital "U" on all sides, minimum.
- Never place the full-color mark on a Work Blue background — only the approved blue monogram tile is allowed there.
- No gradients on the mark, ever, in any context.

## 7. What this replaces

The `recruiting-desk.html` prototype used a manila-folder/index-card aesthetic to explore the *interaction design* (kanban columns, drawer pattern, status badges, generate-draft flow). That visual skin does **not** carry forward — it predates this brand guide. When Claude Code builds the real UI, it should:

- Keep: the column layout, the drawer/detail-panel pattern, the badge-as-status-indicator concept, the generate/copy button flow.
- Replace: every color, the typewriter/serif paper styling, the folder-tab shapes, the stamp-rotation effects — none of that matches UpScaleSupport's system. Build from this doc's tokens instead.

## 8. Implementation notes

- **Framework:** Tailwind CSS v4 (CSS-first `@theme` config, no `tailwind.config.js`) + shadcn/ui — this resolves the open "CSS framework not yet chosen" item from `PROJECT_STATE.md`, and matches the pattern already working on the 3PL project.
- Load Bricolage Grotesque and Inter as web fonts (Google Fonts or self-hosted — Claude Code's call during scaffold, either is fine).
- Tabular numerals: Inter supports `tnum` — apply via Tailwind's `tabular-nums` utility on any stat/metric display.

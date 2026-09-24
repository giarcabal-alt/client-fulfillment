---
name: Client Fulfillment App
description: UpScaleSupport's internal tool for sourcing, tracking, and deploying embedded AI-fluent operators.
colors:
  ink-navy: "#10243E"
  work-blue: "#2E6ADF"
  sun-gold: "#F5B301"
  warm-paper: "#F7F5F0"
  stone: "#E8E6DF"
  slate-text: "#3D4657"
  growth-green: "#1E7A5A"
typography:
  display:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontWeight: 800
  section-head:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontWeight: 700
  body:
    fontFamily: "Inter, sans-serif"
    fontWeight: 400
    lineHeight: 1.6
  metric:
    fontFamily: "Inter, sans-serif"
    fontWeight: 600
    fontFeature: "tnum"
rounded:
  button: "8px"
  input: "8px"
  card: "12px"
  badge: "9999px"
components:
  button-primary:
    backgroundColor: "{colors.work-blue}"
    textColor: "#FFFFFF"
    rounded: "{rounded.button}"
    padding: "8px 12px"
  button-primary-hover:
    backgroundColor: "{colors.work-blue}"
  card:
    backgroundColor: "{colors.warm-paper}"
    rounded: "{rounded.card}"
  badge-success:
    backgroundColor: "{colors.growth-green}"
    textColor: "#FFFFFF"
    rounded: "{rounded.badge}"
---

# Design System: Client Fulfillment App

<!-- Authoritative source: DESIGN_SYSTEM.md (repo root), itself a translation of the UpScaleSupport Brand Guide v2 (FINAL, logo locked 2026-07-23). Where this file and DESIGN_SYSTEM.md ever conflict, DESIGN_SYSTEM.md wins — update this file to match it, never the reverse. Token values below are copied verbatim from DESIGN_SYSTEM.md and cross-checked against the shipped `@theme` block in src/app/globals.css; no token here was invented or renamed. -->

## Overview

**Creative North Star: "AI becomes someone's job."**

UpScaleSupport embeds trained, AI-fluent operators into client teams, backed by an engineering bench. This app is how those operators get sourced, onboarded, and deployed — so its interface reads the way the brand does: accountable, warm, working. It is an internal operations tool, not a marketing surface; every choice optimizes for a recruiter moving fast through a real pipeline, not for impressing a visitor.

The system is deliberately restrained. One confirmed anti-reference governs every choice not spelled out explicitly below: **if it would fit on a crypto site, it's wrong** — no gradients, no neon, no glassmorphism, no dark mode. Surfaces are flat at rest; color is functional (status, action, hierarchy), never decorative.

**Key Characteristics:**
- Flat, bordered surfaces on a warm off-white ground — never pure white, never dark.
- One primary action color (Work Blue); the brand's gold accent is rationed, not decorative.
- Bricolage Grotesque for headlines, Inter for everything else, tabular numerals wherever digits sit next to digits.
- No animation beyond a scroll fade/rise — this is a working tool, not a showcase.

## Colors

Seven tokens total, each with one confirmed job — the palette's discipline is that no token does double duty.

### Primary
- **Work Blue** (`#2E6ADF`): CTAs, links, primary buttons, focus rings, logo accents. The app's one true action color — if something is clickable and important, it's this color.

### Secondary
- **Sun Gold** (`#F5B301`): Sparing accent only. **Max 5% of any layout, never a background, never a large fill.** Reserve it the way the brand guide does — it marks rarity, not routine UI.

### Tertiary
- **Growth Green** (`#1E7A5A`): Success states and positive metrics **only**. Don't reach for it decoratively — it means something went right, specifically.

### Neutral
- **Ink Navy** (`#10243E`): Primary text color for headlines, the sidebar/nav background, footer, and the wordmark itself.
- **Warm Paper** (`#F7F5F0`): The default background, everywhere, always. Never swapped for pure white; never a dark variant.
- **Stone** (`#E8E6DF`): Card borders, dividers, input borders — the system's one border color.
- **Slate Text** (`#3D4657`): Body copy color, on the warm-paper background.

### Named Rules
**The Five Percent Rule.** Sun Gold is a sparing accent only — it never exceeds roughly 5% of any given layout and never appears as a background or large fill. Its rarity is what makes it read as an accent rather than a second primary.

**The No-Dark-Mode Rule.** Warm Paper is the background in every context, permanently. This is a brand decision, not an unfinished theme — do not build a dark variant or a theme toggle.

## Typography

**Display Font:** Bricolage Grotesque (with sans-serif fallback)
**Body Font:** Inter (with sans-serif fallback)

**Character:** A confident, slightly unconventional display face over a completely neutral, highly legible body face — the personality lives in headlines and gets out of the way for working text.

### Hierarchy
- **Display** (ExtraBold, 800): Page-level headlines. Bricolage Grotesque's boldest weight.
- **Section head** (Bold, 700): Card titles, section headers — Bricolage Grotesque, one weight down from display.
- **Body** (Regular, 1.6 line height): All UI copy and body text — Inter.
- **Metric** (Semibold, tabular numerals): Any number sitting next to another number — stat cards, counts, tables. Uses `font-variant-numeric: tabular-nums` so digits align.

### Named Rules
**The Tabular Numerals Rule.** Any UI number adjacent to another number (a candidate count, a table column, a stat tile) renders with tabular figures so columns of digits align — a working-tool precision cue, not a display flourish.

## Layout

App screens use the full available width beside the sidebar, with the app's standard page padding (`p-4 sm:p-6`) as the gutter — not a centered, capped column. The 1120px max width from the brand guide's marketing-site context is reserved for long-form reading text specifically (e.g. a job description's full text block), where line length matters for readability; it is not a page-level rule. Density favors scanability over airiness — this is a daily-use operations tool, not an editorial page. Responsive down to ~375px: the sidebar collapses to a top bar + slide-out sheet below the `md` breakpoint; content padding steps down from the desktop default to a smaller gutter so a phone-width viewport isn't eaten by desktop spacing.

### Named Rules
**The Full-Width Rule.** App screens fill the width available beside the sidebar; only long-form reading text (a job description block, prose) gets the 1120px reading-width cap. Adopted 2026-09-24 after the original blanket 1120px cap — inherited from the brand guide's marketing-site context — was found to waste space and force heavy scrolling on data-dense pages like role/candidate detail and the Job Openings/Clients tables. See `PROJECT_STATE.md` §8.

## Density

The app had drifted toward reading as visibly AI-generated: oversized type, generous padding, every field boxed in its own bordered input, and too many separate stacked cards for what's really one record. Density is locked in tighter here — a working-tool feel, not an editorial one — without touching colors, fonts, or the radius scale above.

- **Type scale:** Body/UI text 14px. Field labels 12px. Page title ~20px, not a large display headline. Section headings 13–14px semibold — Bricolage Grotesque at label size, not the large display weight reserved for the page title.
- **Padding:** Tighter than an editorial default — cards/sections use a smaller internal gutter, form rows sit close together.
- **Fewer containers.** Default to one card with internal 1px Stone dividers between logical groups of the same record, not a new bordered card per group. A separate card is reserved for content that's genuinely a different object, not every subsection of one record.
- **Properties-list pattern**, for a record's own fields: a small label on the left, the plain value on the right — not a grid of individually bordered inputs. The value reads as plain text at rest; editing affordances (a control's border, a select's chevron) appear only on hover or focus. Keyboard focus always shows the Work Blue ring regardless of hover state.
- **Shared primitives:** a `PropertyRow` component (properties-list rows) and a `Section` component (single-card-with-dividers) implement these patterns for reuse across any future record-detail or settings-style page.

### Named Rules
**The One-Card Rule.** A record's own fields default to one card with internal dividers, not one card per subsection — a second card is for a genuinely different object, not another group of the same record's fields.
**The Hover-To-Edit Rule.** A properties-list value shows its editing affordance (border, chevron) only on hover or focus, never at rest — but the Work Blue focus-visible ring is never conditional on hover, only on actual keyboard/programmatic focus.

## Elevation & Depth

Flat by default — cards, buttons, and inputs rest on borders, not shadows. Shadow is reserved strictly for floating/overlay elements that need to visually separate from the page beneath them (dropdown/select panels, slide-out sheets); it is never used on static, in-flow surfaces like cards. This matches the brand's flat, unglossy character — depth comes from borders and spacing, not light and shadow.

### Named Rules
**The Flat-At-Rest Rule.** Anything that sits in the normal page flow — cards, buttons, inputs — is flat, bordered, no shadow. Shadow appears only on things that float above the page (menus, panels), never as decoration on static content.

## Shapes

Two radius scales, used consistently by role: **8px** for anything you interact with directly (buttons, inputs, badges' pill shape aside), **12px** for containers (cards). Borders are 1px `stone` throughout — the system's only border color, used for every card, input, and divider. No pure-white fills; card surfaces sit on warm-paper or a near-white "card" tone, never true `#FFFFFF`.

## Components

### Buttons
- **Shape:** 8px radius.
- **Primary:** Work Blue solid fill, white text; verb-first labels ("Generate suggested message," not "Message generation").
- **Hover / Focus:** Primary darkens toward ~80% opacity on hover; focus shows a Work Blue ring.
- **Secondary / Ghost / Outline:** Stone-bordered, transparent or near-white fill, text in Ink Navy/Slate Text — used for lower-emphasis or destructive-adjacent actions (e.g. "Delete," "Back to board").

### Badges
- **Style:** Fully rounded (pill), 20px height, small type. Status-only — color follows the Colors section's role assignments (Work Blue for active/open, Growth Green for success/filled states, Stone for neutral/closed).

### Cards / Containers
- **Corner Style:** 12px radius.
- **Background:** Warm Paper or a near-white "card" tone — never pure white.
- **Shadow Strategy:** None (see Elevation & Depth) — flat, bordered.
- **Border:** 1px Stone.

### Inputs / Fields
- **Style:** 1px Stone border, transparent/warm-paper fill, 8px radius.
- **Focus:** Border shifts to Work Blue with a matching ring.
- **Error / Disabled:** Destructive-red border/ring for invalid state; reduced opacity and no pointer events when disabled.

### Navigation
- **Style:** Ink Navy background sidebar with Warm Paper text — the one place the palette inverts. Active/hover items get a lighter navy tint, not a color-token change. Below `md`, collapses to a top bar (monogram + app name + menu button) opening the same nav in a slide-out sheet.

## Do's and Don'ts

### Do:
- **Do** keep Warm Paper as the background in every context — no dark mode, ever.
- **Do** treat Sun Gold as rare (**≤5% of a layout, never a fill**) — it's an accent, not a second primary.
- **Do** use tabular numerals wherever a number sits beside another number.
- **Do** keep buttons and cards flat (border only); reserve shadow for floating/overlay elements.
- **Do** use verb-first button labels.

### Don't:
- **Don't** introduce gradients, neon, or glassmorphism anywhere — the brand's own gut-check test: if it would fit on a crypto site, it's wrong.
- **Don't** use pure white (`#FFFFFF`) as a surface fill — warm-paper or the near-white card tone only.
- **Don't** recolor, split, or gradient the "us." monogram/wordmark — blue letters + gold dot appear together or not at all, and never on a Work Blue background except the approved blue monogram tile.
- **Don't** use Growth Green decoratively — success/positive-metric states only.
- **Don't** invent new color tokens or rename the existing seven — `ink-navy`, `work-blue`, `sun-gold`, `warm-paper`, `stone`, `slate-text`, `growth-green` are the complete, locked palette.

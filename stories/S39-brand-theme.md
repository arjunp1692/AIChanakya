# S39 — Kubera Now brand theme
model: sonnet · deps: S04 · PRD: §11 (usability) · Design: `docs/DESIGN.md`

## Goal
Make Chanakya look like a Kubera Now product: navy/cyan palette, Noto Sans, lavender surfaces, brand app shell. Do it now so every later story builds on the themed components.

## Scope
- Read `docs/DESIGN.md` (whole file — it is the spec for this story).
- `src/app/globals.css`: add brand tokens to `@theme inline` and remap shadcn `:root` variables exactly as DESIGN §5. Leave the `.dark` block as is. Brand scrollbar colours.
- `src/app/layout.tsx`: replace Geist with Noto Sans + Noto Sans Gujarati via `next/font/google` (DESIGN §2); keep `font-mono` for ticket IDs.
- App shell `src/app/(app)/layout.tsx` + `nav-links.tsx`: navy sidebar (`bg-dark-navy1`), active item cyan text + `border-r-4 border-cyan-blue` + `bg-background-hover`; topbar white + `shadow-sm`; mobile horizontal nav uses the gradient bar with cyan underline on active (DESIGN §4).
- Shared components in `src/components/`:
  - `section-header.tsx` — accent-bar section title (DESIGN §4).
  - `ai-badge.tsx` — "AI-generated" label (cyan on navy) for later AI stories.
- `src/components/ui/badge.tsx`: add `chip` variant (lavender pill). `button.tsx`: primary hover `bg-background-hover`, add visible focus ring `ring-primary-navy/40`.
- Restyle existing pages to use these: tickets list (table header tint, row hover, divider borders), ticket detail (cards `rounded-md border-divider`, section headers), create ticket form, login page, forbidden + placeholder pages. Only class changes, no logic changes.
- Add a line to `CLAUDE.md` Conventions: "UI follows `docs/DESIGN.md`; use brand tokens, no raw hex in components."

## Out of scope
Dark mode, new pages, layout restructuring, chart theming beyond `--chart-*` vars.

## Acceptance criteria
1. Page background `#F3F4FF`, cards white with `#DADCFF` borders, primary buttons `#010874`; body font is Noto Sans (check computed style).
2. Sidebar is navy and the active route shows the cyan indicator; works on mobile width (no horizontal page scroll at 375px).
3. Ticket list, ticket detail, create ticket, login, forbidden pages use brand tokens; no Geist and no neutral-grey shadcn defaults remain visible.
4. `SectionHeader`, `AiBadge` and the badge `chip` variant exist and are used at least once.
5. No raw hex colours in `src/app/**` or `src/components/**` TSX (tokens only), except `docs/DESIGN.md`-listed arbitrary shadows.
6. Focus ring visible on buttons, links and inputs with the keyboard.

## Validation
- `pnpm validate` green.
- `pnpm dev`; log in as ceo@ and edt.m1@; visit `/`, `/tickets`, a ticket detail page, `/tickets/new`, `/settings` (as edt.m1@ → forbidden). Check the colours and font against DESIGN §1–2 in DevTools.
- `grep -rnE "#[0-9a-fA-F]{6}" src/app src/components --include=*.tsx` returns only allowed shadow values.

## Implementation notes
- Tokens: `src/app/globals.css` `@theme inline` (brand colours + `text-heading-*`/`text-content-*` sizes) and `:root` remapped per DESIGN §5; `.dark` untouched; scrollbars branded.
- Fonts: next/font vars are `--font-noto`/`--font-guj` (not `--font-sans`, avoids a self-referencing var); `--font-mono` = system mono stack (Geist Mono was never loaded).
- Shell: `NavLinks` takes `variant: "sidebar" | "bar"`, active state via `data-active` + `aria-current`. Main content capped at `max-w-7xl`; topbar sticky.
- New: `src/components/section-header.tsx` (`title`, `as`, optional right-side children), `src/components/ai-badge.tsx`; Badge `chip` variant (used for Dept column). Card/table/input/textarea/button primitives restyled at source, so later stories get the look for free.
- Page titles use `text-heading-big font-bold text-career-dark`; native `<select>`s share the brand `selectClass` string (3 copies, tickets list/new/detail forms).
- Follow-ups: STATUS/PRIORITY badge constants still use Tailwind -100/-800 soft colours (DESIGN allows); consider a shared `selectClass` in `src/lib`.

# Chanakya AI — Design guideline (Kubera Now visual language)

Source: tokens and markup extracted from the live kuberanow.com build (Next.js + Tailwind v4, 2026-10-27).
Goal: Chanakya should feel like an internal tool of the same brand — deep navy, cyan accent, Noto Sans, flat
surfaces, thin lavender borders. It is a dense work app, not a news site, so adopt the *language*, not the layout.

## 1. Brand tokens (exact values from kuberanow.com)

| Token (site name)          | Hex        | Use |
|----------------------------|------------|-----|
| `primary` / `dark-blue`    | `#010874`  | Primary text accents, headings on hover, primary buttons, section bar |
| `primary-navy`             | `#000EC0`  | Gradient end, link hover, focus ring |
| `dark-navy1`               | `#00065C`  | Footer / sidebar background |
| `dark-navy2`               | `#000764`  | Gradient start |
| `indigo-dark`              | `#0D1483`  | Deep surface on navy |
| `indigo-light`             | `#262D94`  | Muted surface on navy |
| `background-hover`         | `#00219A`  | Hover / active item on navy surfaces |
| `cyan-blue` / `career-accent` | `#00FFEE` | **The accent.** Active nav indicator, underline, label text on navy. Never as large fill. |
| `background-color`         | `#F3F4FF`  | App page background (lavender-tinted, not grey) |
| `surface`                  | `#FFFFFF`  | Cards, tables, dialogs |
| `career-tint`              | `#EFEFFF`  | Subtle row/section tint, scrollbar track |
| `light-navy4` / `career-chip-bg` (ours: `chip-bg`) | `#D7D9FF` | Chip / badge background, text on navy |
| `career-chip-border` (ours: `chip-border`) | `#CACDFF` | Chip hover bg / chip ring |
| `main-page-badge-border` (ours: `badge-border`) | `#B8BDF7` | Badge outline |
| `divider` / `career-stroke`| `#DADCFF`  | Card borders, dividers, table lines, scrollbar thumb |
| `border-gray`              | `#DEDEDE`  | Neutral borders (inputs) |
| `career-input-border`      | `#CECECE`  | Input outline |
| `career-heading`           | `#1A1411`  | Strongest body headings |
| `career-dark` / `text-disclaimer` | `#313131` | Body text |
| `text-soft`                | `#374151`  | Secondary text |
| `career-muted`             | `#6E6E6E`  | Muted / meta text (timestamps, IDs) |
| `content-link`             | `#1E2EFF`  | Inline links inside body copy |
| `error`                    | `#C4313F`  | Destructive (text/border); bg `#FDECEE`, border `#F5C4CA`, text `#7A3742` |
| `skeleton`                 | `#EFEFF8`  | Loading skeletons |

Gradient (brand bar, hero strips, CTA panels):
`linear-gradient(268.06deg, #000EC0 2.86%, #000764 106.43%)` — Tailwind: `bg-linear-to-r from-dark-navy2 to-primary-navy`.
The site also ships two variants with shifted stops (`-48.01%`/`98.53%` and `48.38%`/`106.43%`); use the one above unless matching a specific site panel.

Status colours for tickets keep Tailwind defaults the site already ships: red-600 `#E40014`, amber-600 `#DD7400`,
green (emerald/green-600), sky-600 `#0084CC`, slate-500 `#62748E`. Use them only as soft badges (`-50` bg, `-700` text).

## 2. Typography

- Font: **Noto Sans** (variable 100–900) for everything; **Noto Sans Gujarati** as fallback for Gujarati text.
  Replace Geist in `src/app/layout.tsx`:
  ```ts
  import { Noto_Sans, Noto_Sans_Gujarati } from "next/font/google";
  const noto = Noto_Sans({ subsets: ["latin"], variable: "--font-noto", display: "swap" });
  const notoGuj = Noto_Sans_Gujarati({ subsets: ["gujarati"], variable: "--font-guj", display: "swap" });
  // <html className={cn("font-sans", noto.variable, notoGuj.variable)}>
  ```
  and set `--font-sans: var(--font-noto), var(--font-guj), sans-serif` in `@theme`.
- Scale (site's named sizes):

  | Role | Size / line-height | Weight | Class |
  |---|---|---|---|
  | Page title | 24px / 30px | 700 | `text-heading-big font-bold` |
  | Section title | 18px / 22px | 700 | `text-heading-small font-bold leading-5.5` |
  | Card title | 14px → 18px (sm) / snug | 700 | `text-sm sm:text-lg leading-snug font-bold` |
  | Large subheading | 22px | 600 | `text-subheading-big font-semibold` |
  | Subheading | 16px / 22px | 600 | `text-subheading-small font-semibold` |
  | Body | 14–16px / 1.5 | 400 | `text-sm` / `text-content-big` |
  | Meta / table secondary | 12px | 400 | `text-content-small text-career-muted` |
  | Over-line label | 14px uppercase, `tracking-wider` | 400 | used in cyan on navy |
  | Tag text | 10px, `tracking-[1px]` | 700 | chips |

- Headings are bold, never light. No italics. Titles use `line-clamp-2/3` instead of wrapping forever.
- Ticket IDs (`KN-FIN-2026-00012`) use `font-mono text-xs text-career-muted` — the only mono text.

## 3. Shape, depth, spacing

- Radius: small. Cards `rounded-md` (6px), inputs/buttons `rounded-md`, images/large panels/dialogs `rounded-lg` (8px),
  chips/badges `rounded-full`. Set shadcn `--radius: 0.375rem` (site never uses 10px corners), and pin the scale to
  fixed values as in §5: shadcn's `--radius` multipliers would make `rounded-md` 4.8px and `rounded-lg` 6px.
- Borders do the work, not shadows: `border border-divider` (`#DADCFF`). Shadows only `shadow-sm` on the sticky
  header and `shadow-md` on popovers/dialogs. Card hover: `shadow-[0_2px_3px_#0000001a]` (`job-card-hover`).
- Spacing: Tailwind 4px grid. Cards `p-4` (`p-2.5` mobile), list gaps `gap-3`/`gap-4`, page gutter `px-4 md:px-6`.
  Max content width `max-w-7xl` (80rem).
- Motion: `transition-colors` 150ms, ease `cubic-bezier(.4,0,.2,1)`. No bouncy or scale effects.

## 4. Signature components

**Section header with accent bar** (used above every content block on the site):
```tsx
<div className="relative flex h-8.25 items-center pl-3">
  <span aria-hidden className="absolute left-0 h-5.5 w-1 rounded-xs bg-primary shadow-[2px_0_0_0_var(--color-cyan-blue)]" />
  <h2 className="text-heading-small font-bold leading-5.5 text-career-dark">Escalations</h2>
</div>
```

**Brand bar / top nav** (navy gradient, cyan underline on active):
```tsx
<nav className="bg-linear-to-r from-dark-navy2 to-primary-navy border-b border-cyan-blue text-white">
  <a className="flex items-center border-b-2 px-3.5 py-3 transition-colors border-transparent
                hover:border-cyan-blue hover:text-cyan-blue hover:bg-background-hover
                data-[active=true]:border-cyan-blue data-[active=true]:text-cyan-blue data-[active=true]:bg-background-hover">
```

**Sidebar** (the app shell in `src/app/(app)/layout.tsx` + `nav-links.tsx`), mirroring the site's mobile drawer:
background `bg-dark-navy1`, items `px-6 py-3 text-sm font-semibold text-white border-r-4 border-transparent
hover:bg-background-hover`; active item `bg-background-hover text-cyan-blue border-cyan-blue rounded-r-sm`.
Group labels: `text-sm uppercase tracking-wider text-cyan-blue`. Secondary text on navy: `text-light-navy4`.

**Chip / tag** (department, category):
`inline-flex items-center rounded-full border border-badge-border bg-chip-bg px-2 py-0.5 text-xs leading-none text-primary`
Clickable variant: `ring-1 ring-inset ring-chip-border hover:bg-chip-border text-[10px] font-bold tracking-[1px]`.

**Card** (tickets, decisions, report blocks):
`group rounded-md border border-divider bg-surface p-4 transition-colors hover:shadow-[0_2px_3px_#0000001a]`;
title gets `group-hover:text-primary transition-colors`.

**Buttons**
- Primary: `bg-primary text-white hover:bg-background-hover font-semibold rounded-md`
- Secondary: `border border-divider bg-surface text-primary hover:bg-career-tint`
- Ghost/link: `text-primary hover:text-primary-navy`; body links `text-content-link underline underline-offset-2`
- Destructive: `bg-error text-white`; destructive soft: `bg-error-bg text-error-text border-error-border`
- Focus ring everywhere: `ring-2 ring-primary-navy/40` (site has no custom focus — add it for a11y).

**Tables** (ticket list): white surface, header row `bg-career-tint text-xs font-semibold uppercase tracking-wider
text-text-soft`, rows `border-b border-divider last:border-b-0 hover:bg-career-tint/60`.

**Inputs**: `border-career-input-border bg-white rounded-md focus:border-primary-navy focus:ring-primary-navy/30`.

**Footer / CTA panel**: `bg-dark-navy1 border-t-2 border-primary-navy text-gray-300`.

**AI-generated label** (project rule): chip variant in cyan-on-navy —
`rounded-full bg-primary text-cyan-blue px-2 py-0.5 text-[10px] font-bold tracking-[1px] uppercase` reading "AI-generated".

**Scrollbars**: thumb `#DADCFF`, track `#EFEFFF`.

## 5. Implementation — `src/app/globals.css`

Add brand tokens to `@theme inline` and remap shadcn variables so existing `ui/*` components inherit the look:
```css
@theme inline {
  --color-primary-navy: #000ec0;  --color-dark-navy1: #00065c;  --color-dark-navy2: #000764;
  --color-background-hover: #00219a; --color-cyan-blue: #00ffee; --color-light-navy4: #d7d9ff;
  --color-surface: #fff; --color-career-tint: #efefff; --color-chip-bg: #d7d9ff;
  --color-chip-border: #cacdff; --color-badge-border: #b8bdf7; --color-divider: #dadcff;
  --color-career-input-border: #cecece; --color-career-dark: #313131; --color-career-muted: #6e6e6e;
  --color-text-soft: #374151; --color-content-link: #1e2eff; --color-error: #c4313f; --color-error-bg: #fdecee;
  --color-error-border: #f5c4ca; --color-error-text: #7a3742;
  --text-heading-big: 24px; --text-heading-small: 18px; --text-subheading-big: 22px; --text-subheading-small: 16px;
  --text-content-big: 16px; --text-content-small: 12px;
  --radius-sm: 0.25rem; --radius-md: 0.375rem; --radius-lg: 0.5rem; --radius-xl: 0.75rem;
  --radius-2xl: 1rem; --radius-3xl: 1.5rem; --radius-4xl: 2rem;
}
:root {
  --radius: 0.375rem;
  --background: #f3f4ff;  --foreground: #313131;
  --card: #ffffff;        --card-foreground: #313131;
  --popover: #ffffff;     --popover-foreground: #313131;
  --primary: #010874;     --primary-foreground: #ffffff;
  --secondary: #efefff;   --secondary-foreground: #010874;
  --muted: #efefff;       --muted-foreground: #6e6e6e;
  --accent: #d7d9ff;      --accent-foreground: #010874;
  --destructive: #c4313f;
  --border: #dadcff;      --input: #cecece;   --ring: #000ec0;
  --sidebar: #00065c;     --sidebar-foreground: #ffffff;
  --sidebar-primary: #00ffee; --sidebar-primary-foreground: #010874;
  --sidebar-accent: #00219a;  --sidebar-accent-foreground: #00ffee;
  --sidebar-border: #0d1483;  --sidebar-ring: #00ffee;
  --chart-1: #010874; --chart-2: #000ec0; --chart-3: #00b7d7; --chart-4: #dd7400; --chart-5: #62748e;
}
```
Dark mode: the site has none. Keep the existing `.dark` block untouched for now; light is the supported theme.

## 6. Do / Don't

- Do: lavender page bg + white cards + `#DADCFF` borders; cyan only as a 2–4px indicator or small text on navy.
- Do: bold, compact headings; section-bar headers; chips for department/priority.
- Don't: cyan text on white (fails contrast), big rounded (>8px) cards, heavy shadows, grey (`#f5f5f5`) backgrounds,
  more than one gradient per screen, non-Noto fonts.
- Contrast checks: `#010874` on `#F3F4FF` ≈ 15:1 ✓; `#00FFEE` on `#00065C` ≈ 14:1 ✓; `#6E6E6E` on white ≈ 5.1:1 ✓;
  `#374151` on `#EFEFFF` ≈ 9:1 ✓. `#6E6E6E` on `#EFEFFF` ≈ 4.48:1 ✗ (below AA) — use `text-text-soft` on tinted surfaces.

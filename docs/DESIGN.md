# Beripika design system

Two interchangeable style presets share one set of components. **IBM Carbon is the default**;
users can switch per device in **Settings → Appearance → Interface style** (cookie `ui_style`).
Set `VITE_UI_STYLE=coinbase` in `.env` to change the default.

| | Carbon (default) | Coinbase (`html.theme-coinbase`) |
|---|---|---|
| Feel | Square, structured, enterprise | Rounded, calm, editorial |
| Font | IBM Plex Sans / Plex Mono | Inter / JetBrains Mono |
| Display weight | 300 | 400, tight tracking |
| Blue | IBM Blue `#0f62fe` | `#0052ff` |
| Neutrals | Carbon gray (`#161616` → `#f4f4f4`) | cool gray (`#0a0b0d` → `#f7f8f9`) |
| Buttons / fields / cards | 0px corners; filled fields with bottom rule | pill buttons, 12px fields, 16px cards |
| Tabs / side nav | underline tabs, 3px blue rail on selected item | pill tabs and pill nav |

Shape is controlled by CSS variables used in the components: `--radius-button`, `--radius-field`,
`--radius-card`, `--radius-popover`, `--radius-nav`, `--radius-hero` (e.g. `rounded-(--radius-card)`).
Tailwind `rounded-lg…3xl`, `blue-*` and `gray-*` follow the active preset automatically.

---

## Coinbase preset notes — "institutional calm"

Inspired by the Coinbase DESIGN.md analysis (getdesign.md): a trust-first financial-services look,
adapted for a government verification registry. We borrow the *style* only — CHED logo and name stay.

## Principles
- White canvas, near-black ink, **one brand blue used sparingly** (primary actions, active nav, links).
- Calm display type: large headings at **weight 400** with tight tracking (`.text-display`).
- **Pill actions** (buttons, search, badges, tabs, nav items); **flat cards** with hairline borders, no drop shadows.
- Dark editorial hero band on the public page; soft-gray elevation bands elsewhere.
- Status colours are semantic only: success green, destructive red, warning amber.

## Tokens (`resources/css/app.css`)
| Token | Light | Dark |
|---|---|---|
| primary (Beripika Blue) | `#0052ff` | `#2a6aff` |
| foreground / ink | `#0a0b0d` | `#ffffff` |
| background | `#ffffff` | `#0a0b0d` |
| card | `#ffffff` | `#16181c` |
| muted / secondary | `#eef0f3` | `#1c1f24` / `#22252b` |
| muted-foreground | `#5b616e` | `#a8acb3` |
| border / input | `#dee1e6` | `#2a2e35` |
| success / destructive / warning | `#05b169` / `#cf202f` / `#f4b000` | `#2fd38a` / `#e5484d` / `#ffc53d` |
| sidebar | `#f7f8f9` | `#0f1114` |

Tailwind `blue-*` and `gray-*` scales are remapped to the brand blue and cool neutrals, so older
markup (`bg-blue-600`, `text-gray-500`) automatically follows the theme. Prefer semantic classes
(`bg-primary`, `text-muted-foreground`, `border`) in new code.

## Type
- Sans: **Inter** (400/500/600/700). Mono: **JetBrains Mono** — use `.num` for codes, SO numbers, counts.
- Headings: page `text-xl font-semibold`; hero/section `text-display text-4xl…7xl`.

## Shape & spacing
- Radius: inputs/selects `rounded-xl` (12px), cards `rounded-2xl` (16px), hero/feature cards `rounded-3xl` (24px),
  buttons/badges/tabs `rounded-full`.
- Buttons: default `h-10`, `sm` `h-8`, `lg` `h-12`; variants default (blue), secondary (gray pill), outline, ghost, destructive.
- Page padding `p-4 md:p-6`; section rhythm on public pages `py-14 lg:py-24`.

## Do / don't
- ✅ One primary button per area; secondary actions use `secondary`/`ghost`.
- ✅ Numbers and codes in `.num`.
- ❌ No gradients on buttons, no heavy shadows on cards, no bold (700+) display headings.

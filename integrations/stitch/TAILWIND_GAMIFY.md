# Gamify theme — Tailwind notes

The gamified UI uses **Tailwind v4 utility classes** already available in the Stitch desktop preset (`indigo`, `violet`, `emerald`, `amber`, `rose`, `slate`). No extra `tailwind.config.js` keys are required for the integration copies in this repo.

If you centralize design tokens in the real Stitch app, you can add `@theme` entries such as:

```css
/* Example only — merge into apps/desktop/src/index.css or @theme block */
@theme {
  --color-quest-primary: #6366f1;
  --color-quest-accent: #8b5cf6;
  --color-quest-success: #10b981;
}
```

Then map `bg-quest-primary` etc. via `@utility` or use the hex palette directly in components as today.

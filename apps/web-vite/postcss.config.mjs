/**
 * Tailwind v4 runs as a PostCSS plugin. Vite picks this file up
 * automatically because it lives at the app root.
 *
 * Tailwind configuration is declared inline in src/styles/globals.css
 * via `@import "tailwindcss"` + `@theme inline { ... }` — no
 * tailwind.config.* file by design (Tailwind v4 CSS-first convention).
 */
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

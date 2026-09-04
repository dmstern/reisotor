## 2026-08-31 - Intentional Hardcoded Contrast Colors on Glass & Badges

**Learning:** Certain floating UI elements (like `DeleteButton.vue` / `EditButton.vue` floating variants over background photos) and high-contrast badges (like `PendingSyncBadge.vue` on `--color-accent`) intentionally use specific dark/light contrast colors (`#2b2a28`, `#f2efe9`, `#fff`). Replacing them blindly with global theme tokens (`var(--color-surface)`, `var(--color-text)`) causes severe contrast regressions on dark mode or over dynamic photo backgrounds.
**Action:** Do not convert hardcoded hex/contrast colors in floating glassmorphic buttons or accent badges to general theme CSS variables without verifying contrast in both light and dark modes over image/color backgrounds.

## 2026-09-03 - Component Primitives and Design Tokens in Filters & Password Inputs

**Learning:** Search/filter bars and input controls often re-implement buttons, dropdown items, or hardcoded priority colors (`#2f9e44`, `#e8a30c`, `#d6336c`, `#ef4444`). Using primitives (`IconButton`, `DropdownItem`) and semantic tokens (`var(--color-success)`, `var(--color-accent)`, `var(--color-danger)`) improves design consistency, theme adaptability, and keyboard accessibility.
**Action:** Always prefer design system primitives (`IconButton`, `DropdownItem`) and design token variables over custom HTML elements with hardcoded colors or custom hover styles.

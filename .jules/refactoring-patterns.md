# JULES KNOWLEDGE - REFACTORING & DESIGN SYSTEM PATTERNS

## Component Primitives over Global CSS & Ad-hoc Styles

**Learning:** When refactoring UI elements (such as badges, chips, buttons, inputs, cards):

1. **Component Primitive Encapsulation:** Instead of maintaining ad-hoc custom styles in local views or global CSS utility classes in `style.css` (e.g. `.badge`, `.badge--*`), encapsulate variant styles inside primitive components under `frontend/src/components/primitives/` (e.g. `Badge.vue`).
2. **Consolidate Related Components:** Refactor existing domain/wrapper components (`CategoryChip.vue`, `PendingSyncBadge.vue`, `DraftBadge.vue`) and views (`SettingsView.vue`) to use the primitive component.
3. **Remove Duplicate Global CSS:** Remove redundant utility declarations from `frontend/src/style.css` so that component styles are fully scoped and modular.
4. **Co-locate Storybook Documentation:** Add a co-located Storybook file (e.g. `Badge.stories.ts`) alongside the primitive component to document all variants (`default`, `primary`, `success`, `danger`, `accent`, `warning`, `accent-secondary`) and keep the interactive design showcase in sync.

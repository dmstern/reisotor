# feat: elevated glassmorphism design adaptations and micro-interactions (#267)

Implemented modern visual enhancements across the Reisotor web application UI:

- **Glassmorphism Design System**: Introduced `--color-surface-glass`, `--color-surface-glass-border`, and `--backdrop-blur-md` tokens in `style.css`.
- **Navigation & Overlays**: Enhanced floating mobile bottom navigation (`NavBar.vue`) and modal backdrops with backdrop blur (`12px saturate(180%)`).
- **Tactile Micro-Interactions**: Upgraded `Button.vue` with springy scale active feedback (`scale(0.96)`) and subtle hover lifts.
- **Card Depth**: Refined `Card.vue` with cubic-bezier transitions, multi-layered soft drop shadows, and glowing accent borders for highlighted items.
- **Unread Indicators**: Added subtle pulsing keyframe animations (`@keyframes badgePulse`) for unseen activity indicator dots.

# Sentinel Security Journal

## 2026-09-05 - Centralized RichText Rendering for XSS Hardening

**Vulnerability:** Direct usage of `v-html` with `renderRichText()` in components like `SpotCard.vue` bypasses component-level sanitization layer consistency and risks DOM XSS if sanitization is omitted in future refactors.
**Learning:** Raw `v-html` directives across multiple Vue components create unnecessary attack surface and make XSS auditing error-prone.
**Prevention:** Always delegate rich text HTML rendering to the `<RichTextDisplay />` component, which enforces `DOMPurify.sanitize()` prior to mounting in the DOM.

## 2026-09-05 - Defense-in-Depth Documentation on Un-gated Utility Routes

**Vulnerability:** Endpoint `/spots/preview` lacks `requireTripMember` checks, which could raise security concerns during access control audits.
**Learning:** Utility routes that perform public link preview fetches (e.g. Google Maps preview) do not touch database entities or trip state, so `requireTripMember` is intentionally absent while `requireAuth` protects against unauthenticated abuse.
**Prevention:** Clearly comment security rationale on utility routes that intentionally omit trip membership checks to prevent false positives and maintain defense-in-depth documentation.

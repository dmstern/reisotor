# Sentinel Security Journal

## 2026-09-05 - Centralized RichText Rendering for XSS Hardening

**Vulnerability:** Direct usage of `v-html` with `renderRichText()` in components like `SpotCard.vue` bypasses component-level sanitization layer consistency and risks DOM XSS if sanitization is omitted in future refactors.
**Learning:** Raw `v-html` directives across multiple Vue components create unnecessary attack surface and make XSS auditing error-prone.
**Prevention:** Always delegate rich text HTML rendering to the `<RichTextDisplay />` component, which enforces `DOMPurify.sanitize()` prior to mounting in the DOM.

## 2026-09-05 - Defense-in-Depth Documentation on Un-gated Utility Routes

**Vulnerability:** Endpoint `/spots/preview` lacks `requireTripMember` checks, which could raise security concerns during access control audits.
**Learning:** Utility routes that perform public link preview fetches (e.g. Google Maps preview) do not touch database entities or trip state, so `requireTripMember` is intentionally absent while `requireAuth` protects against unauthenticated abuse.
**Prevention:** Clearly comment security rationale on utility routes that intentionally omit trip membership checks to prevent false positives and maintain defense-in-depth documentation.

## 2026-09-09 - SSRF Hardening on Maps Link Resolution & Restricted Mode Consistency

**Vulnerability:** Maps link resolution and preview utilities accepted arbitrary URL input for server-side `fetch()`, introducing Server-Side Request Forgery (SSRF) risk to internal/loopback endpoints (`localhost`, `127.0.0.1`, `169.254.169.254`), including via HTTP redirects (`redirect: 'follow'`) and IPv6-mapped IPv4 representations (`::ffff:127.0.0.1`). Additionally, generic image upload (`POST /images`) lacked restricted user mode checks.
**Learning:** Any server-side fetching utility must strictly validate target protocols and destination IP ranges (including IPv4-mapped IPv6, CGNAT, benchmark ranges, wildcard DNS rebinding, and single-label hosts) before issuing requests. Furthermore, automated redirect following (`redirect: 'follow'`) must never be used on untrusted input—redirects must be traversed manually with hop-by-hop validation so that malicious redirect targets cannot trigger internal requests. Restricted user mode limits must be checked across all upload endpoints uniformly.
**Prevention:** Always validate URLs against `isSafeUrl` before `fetch()` calls in server-side helpers, use manual hop-by-hop redirect verification (`redirect: 'manual'`), restrict automated redirect following to trusted domains, and enforce `isUserRestricted` checks on all file/image upload handlers.

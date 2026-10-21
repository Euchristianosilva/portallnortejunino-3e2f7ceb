<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Registration dossiers use immutable database consent/submission snapshots and retained generation records; private short-lived hashed capabilities or a verified matching account authorize access, never public tracking tokens. PDF and web sections derive from the same saved generation.
- Dossier capabilities permit bounded repeated retrieval for preview, download and printing until expiry; every request increments an atomic database counter, and saved generations are checked against canonical SHA-256 data before reuse.
- Administrative dossiers require an authenticated registrations-permission RPC before privileged reads, share the candidate source and generation pipeline, and audit only action/registration/generation identifiers; this preserves isolation and avoids duplicating consent logic.
- Business rules (voting limits, registration validation, protocol generation, status changes) live in SECURITY DEFINER Postgres functions; the UI only calls them — so they cannot be bypassed from the browser.
- Admin access is decided by `user_roles` + `user_permissions` via `has_role`/`has_permission`; never by e-mail or client state.
- Live updates use `useLiveQueries` (src/lib/realtime.ts), which invalidates React Query keys and resyncs on reconnect — never poll with fixed data.
- Hidden vote totals are only readable through `poll_tallies` RLS; never expose counts elsewhere.
- Registration tracking lookup runs in a server function with the admin client and an IP rate limit; public live status uses the PII-free `registration_live_status` table.
- Admin edits use optimistic concurrency (`guardedUpdate` on `updated_at`).
- Image references use `storage:<path>` and `StoredImage` resolves expiring signed URLs, because workspace policy requires private buckets; file reads remain authorization-gated.
- Form schema versions and per-submission field snapshots are captured by database triggers, so subsequent edits never reinterpret older answers.
- Offboarding tokens are returned once and stored only as hashes; public access goes through a server function and atomic database rate limits. The row-locked confirmation RPC validates the linked identity and current role, records submission once, and allows only identical retries; used links return a PII-free receipt. Only administrative completion revokes staff grants, never accounts.
- Master reports use a permission-checked database RPC without vote tallies; hidden totals remain exclusively behind their existing RLS.
- Motion uses global CSS tokens and PageTransition scopes keyed to the resolved route; only public main content and panel outlets animate, with one-shot IntersectionObserver item entrances and reduced-motion overrides, preserving providers and the panel shell without animation-library dispatcher conflicts.
- PWA is manifest-only (public/manifest.webmanifest + icons in public/icons, head tags in src/routes/__root.tsx); no service worker, because voting, registration and realtime require connectivity — offline states are surfaced by src/components/site/ConnectivityNotice.tsx instead of cached shells.
- Mobile rules live in src/styles.css @layer base: safe-area utilities (portal-safe-*), 44px coarse-pointer targets, 16px field font on touch (iOS zoom guard), 90dvh dialogs, overflow-x clip; keep them in @layer base so Tailwind utilities still win.

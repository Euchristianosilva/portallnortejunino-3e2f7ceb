# Portal Norte Junino — Plataforma Oficial

Build the full platform from the brief, matching the uploaded design (deep navy/royal blue, bright blue accents, white cards, bold rounded sans headings with blue highlighted words, star motif). Everything runs on Lovable Cloud with real data — no fake numbers; empty states when nothing is published.

## Pages
- **Início** — hero ("O movimento junino também é feito de pessoas."), 3 shortcut cards (Votações, Inscrições, Agenda), "Em destaque" cards fed by real open votes/registrations, "Por que participar", CTA band, footer. Live updates.
- **Votações** — list of active/closed votes; vote detail page with candidates, vote button, live results only when release is allowed.
- **Inscrições** — open registration forms; form page with fields defined by admin; confirmation with 4‑digit protocol.
- **Acompanhar** — look up a registration by protocol + e‑mail; shows name, protocol, form, received date, status, last update, notes. Updates live when coordination changes status.
- **Comunicados / Agenda** — published announcements and dates.
- **Sobre**, **Contato**, **Privacidade**, **Regulamentos**.
- **Entrar / Criar conta** — Google + e‑mail/senha (name, e‑mail, senha, cidade, estado), forgot/reset password.
- **Painel Master** (protected) — registrations (search, filters, pagination, detail, status change with notes + history), form builder and periods, votes (create/edit/publish/close, candidates with images, rules, result visibility), announcements, operator permissions, audit log, real indicators. Live updates and edit-conflict warnings.

## Roles
- Usuário: public areas, voting, own registrations.
- Coordenação/Operador: only permissions the master grants (e.g. review registrations).
- Master: everything. Granted server-side via a roles table — never by e‑mail check in the browser. I'll assign master to your account after you sign up (please tell me the e‑mail).

## Rules enforced on the server
- Registrations: validation, server timestamp, closed forms rejected, duplicate prevention per form, unique 4‑digit protocol per form with retry on collision; status history with who/when.
- Status set: Recebida, Em análise, Informações solicitadas, Aprovada, Não aprovada.
- Votes: states rascunho/agendada/ativa/encerrada/cancelada; single or multiple votes, public or restricted, per-vote limits enforced in the database (constraints + transactional function); hidden results never leave the server.
- Tracking lookup rate-limited; protocol alone never reveals data.

## Technical section
- Enable Lovable Cloud; tables: profiles, user_roles (+ permissions), registration_forms, form_fields, registrations, registration_status_history, polls, poll_options, votes, announcements, events, audit_log. RLS + GRANTs on all.
- Server functions (createServerFn) for voting, submitting, tracking lookup, admin actions; `has_role`/`has_permission` security-definer helpers.
- Realtime on public tables (polls, announcements, forms, aggregated results table updated by trigger only when visible); tracking uses a per-registration channel token returned by lookup; admin tables subscribe under RLS. Connection indicator, reconnect resync, dedupe.
- Optimistic concurrency via `updated_at` version check in admin edits.
- Hero/card imagery generated in the reference style; logo recreated as "PNJ" mark.
- Built in phases: design system + public pages + auth → registrations + tracking → votes → master panel → realtime polish + tests for the rules.


create table public.contact_messages(
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 100),
  email text not null check (length(email) <= 255),
  message text not null check (length(message) between 5 and 2000),
  handled boolean not null default false,
  created_at timestamptz not null default now()
);
grant insert on public.contact_messages to anon, authenticated;
grant select, update on public.contact_messages to authenticated;
grant all on public.contact_messages to service_role;
alter table public.contact_messages enable row level security;
create policy "anyone send" on public.contact_messages for insert to anon, authenticated with check (handled = false);
create policy "master read" on public.contact_messages for select to authenticated using (public.has_role(auth.uid(),'master'));
create policy "master update" on public.contact_messages for update to authenticated using (public.has_role(auth.uid(),'master'));

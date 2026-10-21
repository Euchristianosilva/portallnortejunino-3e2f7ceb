
-- ENUMS
create type public.app_role as enum ('master','coordenacao','operador','user');
create type public.admin_permission as enum ('registrations','polls','announcements','forms');
create type public.reg_status as enum ('recebida','em_analise','info_solicitada','aprovada','nao_aprovada');
create type public.poll_status as enum ('rascunho','agendada','ativa','encerrada','cancelada');
create type public.results_visibility as enum ('oculto','ao_vivo','apos_encerramento');
create type public.poll_audience as enum ('publica','restrita');

-- updated_at helper
create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path=public as $$
begin new.updated_at = now(); return new; end $$;

-- PROFILES
create table public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  city text,
  state text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- ROLES
create table public.user_roles(
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
grant select, insert, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create table public.user_permissions(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  permission admin_permission not null,
  granted_by uuid,
  created_at timestamptz not null default now(),
  unique(user_id, permission)
);
grant select, insert, delete on public.user_permissions to authenticated;
grant all on public.user_permissions to service_role;
alter table public.user_permissions enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.user_roles where user_id=_user_id and role=_role)
$$;
create or replace function public.has_permission(_user_id uuid, _perm admin_permission) returns boolean
language sql stable security definer set search_path=public as $$
  select public.has_role(_user_id,'master') or exists(
    select 1 from public.user_permissions p
    where p.user_id=_user_id and p.permission=_perm
      and exists(select 1 from public.user_roles r where r.user_id=_user_id and r.role in ('coordenacao','operador')))
$$;
create or replace function public.is_staff(_user_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.user_roles where user_id=_user_id and role in ('master','coordenacao','operador'))
$$;

create policy "own profile read" on public.profiles for select to authenticated using (id=auth.uid() or public.is_staff(auth.uid()));
create policy "own profile insert" on public.profiles for insert to authenticated with check (id=auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());

create policy "roles read" on public.user_roles for select to authenticated using (user_id=auth.uid() or public.has_role(auth.uid(),'master'));
create policy "roles master insert" on public.user_roles for insert to authenticated with check (public.has_role(auth.uid(),'master') and role <> 'master');
create policy "roles master delete" on public.user_roles for delete to authenticated using (public.has_role(auth.uid(),'master') and role <> 'master');

create policy "perms read" on public.user_permissions for select to authenticated using (user_id=auth.uid() or public.has_role(auth.uid(),'master'));
create policy "perms master insert" on public.user_permissions for insert to authenticated with check (public.has_role(auth.uid(),'master'));
create policy "perms master delete" on public.user_permissions for delete to authenticated using (public.has_role(auth.uid(),'master'));

-- New user -> profile + user role
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id, full_name, email, city, state, avatar_url)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.email,
    new.raw_user_meta_data->>'city',
    new.raw_user_meta_data->>'state',
    new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  insert into public.user_roles(user_id, role) values (new.id,'user') on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- AUDIT
create table public.audit_log(
  id bigserial primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "audit master read" on public.audit_log for select to authenticated using (public.has_role(auth.uid(),'master'));

create or replace function public.audit_trigger() returns trigger language plpgsql security definer set search_path=public as $$
declare rid text;
begin
  rid := coalesce((to_jsonb(new)->>'id'), (to_jsonb(old)->>'id'));
  insert into public.audit_log(actor_id, action, entity, entity_id, details)
  values (auth.uid(), lower(tg_op), tg_table_name, rid,
    case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end);
  return coalesce(new, old);
end $$;
create trigger audit_user_roles after insert or delete on public.user_roles for each row execute function public.audit_trigger();
create trigger audit_user_permissions after insert or delete on public.user_permissions for each row execute function public.audit_trigger();

-- REGISTRATION FORMS
create table public.registration_forms(
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  category text not null default '',
  image_url text,
  fields jsonb not null default '[]'::jsonb,
  published boolean not null default false,
  opens_at timestamptz,
  closes_at timestamptz,
  unique_per_email boolean not null default true,
  require_login boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.registration_forms to anon;
grant select, insert, update, delete on public.registration_forms to authenticated;
grant all on public.registration_forms to service_role;
alter table public.registration_forms enable row level security;
create policy "forms public read" on public.registration_forms for select to anon, authenticated using (published or public.has_permission(auth.uid(),'forms') or public.has_permission(auth.uid(),'registrations'));
create policy "forms admin insert" on public.registration_forms for insert to authenticated with check (public.has_permission(auth.uid(),'forms'));
create policy "forms admin update" on public.registration_forms for update to authenticated using (public.has_permission(auth.uid(),'forms'));
create policy "forms admin delete" on public.registration_forms for delete to authenticated using (public.has_permission(auth.uid(),'forms'));
create trigger forms_touch before update on public.registration_forms for each row execute function public.touch_updated_at();
create trigger audit_forms after insert or update or delete on public.registration_forms for each row execute function public.audit_trigger();

-- REGISTRATIONS
create table public.registrations(
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.registration_forms(id) on delete restrict,
  user_id uuid,
  protocol char(4) not null,
  full_name text not null,
  email text not null,
  answers jsonb not null default '{}'::jsonb,
  status reg_status not null default 'recebida',
  public_note text,
  tracking_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(form_id, protocol)
);
create index registrations_form_idx on public.registrations(form_id, created_at desc);
create index registrations_email_idx on public.registrations(lower(email));
create unique index registrations_form_email_uniq on public.registrations(form_id, lower(email));
grant select on public.registrations to authenticated;
grant all on public.registrations to service_role;
alter table public.registrations enable row level security;
create policy "reg read own or staff" on public.registrations for select to authenticated using (user_id=auth.uid() or public.has_permission(auth.uid(),'registrations'));
create trigger registrations_touch before update on public.registrations for each row execute function public.touch_updated_at();

create table public.registration_status_history(
  id bigserial primary key,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  status reg_status not null,
  note text,
  changed_by uuid,
  created_at timestamptz not null default now()
);
create index rsh_reg_idx on public.registration_status_history(registration_id, created_at);
grant select on public.registration_status_history to authenticated;
grant all on public.registration_status_history to service_role;
alter table public.registration_status_history enable row level security;
create policy "hist staff read" on public.registration_status_history for select to authenticated using (public.has_permission(auth.uid(),'registrations'));

-- Public status mirror (no personal data) for live tracking
create table public.registration_live_status(
  tracking_token uuid primary key,
  status reg_status not null,
  updated_at timestamptz not null default now()
);
grant select on public.registration_live_status to anon, authenticated;
grant all on public.registration_live_status to service_role;
alter table public.registration_live_status enable row level security;
create policy "live status read" on public.registration_live_status for select to anon, authenticated using (true);

create or replace function public.sync_live_status() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.registration_live_status(tracking_token, status, updated_at)
  values (new.tracking_token, new.status, now())
  on conflict (tracking_token) do update set status=excluded.status, updated_at=now();
  return new;
end $$;
create trigger registrations_live after insert or update on public.registrations for each row execute function public.sync_live_status();

-- Submit registration
create or replace function public.submit_registration(_form_id uuid, _full_name text, _email text, _answers jsonb)
returns table(protocol text, registration_id uuid) language plpgsql security definer set search_path=public as $$
declare f public.registration_forms; fld jsonb; v text; p text; rid uuid; tries int := 0;
begin
  select * into f from public.registration_forms where id=_form_id for share;
  if not found or not f.published then raise exception 'Inscrição não encontrada.'; end if;
  if f.opens_at is not null and now() < f.opens_at then raise exception 'As inscrições ainda não foram abertas.'; end if;
  if f.closes_at is not null and now() > f.closes_at then raise exception 'As inscrições estão encerradas.'; end if;
  if f.require_login and auth.uid() is null then raise exception 'Entre na sua conta para se inscrever.'; end if;
  _full_name := btrim(coalesce(_full_name,'')); _email := lower(btrim(coalesce(_email,'')));
  if length(_full_name) < 3 or length(_full_name) > 150 then raise exception 'Informe o nome completo.'; end if;
  if _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(_email) > 255 then raise exception 'E-mail inválido.'; end if;
  if jsonb_typeof(coalesce(_answers,'{}'::jsonb)) <> 'object' then raise exception 'Respostas inválidas.'; end if;
  for fld in select * from jsonb_array_elements(f.fields) loop
    v := btrim(coalesce(_answers->>(fld->>'key'),''));
    if coalesce((fld->>'required')::boolean,false) and v = '' then
      raise exception 'Campo obrigatório: %', fld->>'label';
    end if;
    if length(v) > 5000 then raise exception 'Resposta muito longa: %', fld->>'label'; end if;
  end loop;
  if f.unique_per_email and exists(select 1 from public.registrations r where r.form_id=_form_id and lower(r.email)=_email) then
    raise exception 'Já existe uma inscrição com este e-mail nesta modalidade.';
  end if;
  loop
    tries := tries + 1;
    p := lpad((floor(random()*10000))::int::text, 4, '0');
    begin
      insert into public.registrations(form_id, user_id, protocol, full_name, email, answers)
      values (_form_id, auth.uid(), p, _full_name, _email, coalesce(_answers,'{}'::jsonb))
      returning id into rid;
      exit;
    exception when unique_violation then
      if tries >= 50 then raise exception 'Não foi possível gerar o protocolo. Tente novamente.'; end if;
      if exists(select 1 from public.registrations r where r.form_id=_form_id and lower(r.email)=_email) then
        raise exception 'Já existe uma inscrição com este e-mail nesta modalidade.';
      end if;
    end;
  end loop;
  insert into public.registration_status_history(registration_id, status, note, changed_by) values (rid,'recebida','Inscrição recebida.', auth.uid());
  return query select p, rid;
end $$;
revoke all on function public.submit_registration(uuid,text,text,jsonb) from public;
grant execute on function public.submit_registration(uuid,text,text,jsonb) to anon, authenticated;

-- Lookup (server only, rate limited)
create table public.lookup_attempts(id bigserial primary key, ip text not null, created_at timestamptz not null default now());
create index lookup_attempts_ip_idx on public.lookup_attempts(ip, created_at);
grant all on public.lookup_attempts to service_role;
alter table public.lookup_attempts enable row level security;

create or replace function public.lookup_registration(_protocol text, _email text, _ip text)
returns table(full_name text, protocol text, form_title text, status reg_status, public_note text, created_at timestamptz, updated_at timestamptz, tracking_token uuid)
language plpgsql security definer set search_path=public as $$
begin
  delete from public.lookup_attempts where created_at < now() - interval '1 hour';
  if (select count(*) from public.lookup_attempts a where a.ip=_ip and a.created_at > now() - interval '10 minutes') >= 15 then
    raise exception 'Muitas tentativas. Aguarde alguns minutos.';
  end if;
  insert into public.lookup_attempts(ip) values (coalesce(_ip,'unknown'));
  return query select r.full_name, r.protocol::text, f.title, r.status, r.public_note, r.created_at, r.updated_at, r.tracking_token
    from public.registrations r join public.registration_forms f on f.id=r.form_id
    where r.protocol = _protocol and lower(r.email) = lower(btrim(_email))
    order by r.created_at desc limit 10;
end $$;
revoke all on function public.lookup_registration(text,text,text) from public, anon, authenticated;
grant execute on function public.lookup_registration(text,text,text) to service_role;

create or replace function public.lookup_by_token(_token uuid)
returns table(full_name text, protocol text, form_title text, status reg_status, public_note text, created_at timestamptz, updated_at timestamptz, tracking_token uuid)
language sql security definer set search_path=public as $$
  select r.full_name, r.protocol::text, f.title, r.status, r.public_note, r.created_at, r.updated_at, r.tracking_token
  from public.registrations r join public.registration_forms f on f.id=r.form_id where r.tracking_token=_token
$$;
revoke all on function public.lookup_by_token(uuid) from public, anon, authenticated;
grant execute on function public.lookup_by_token(uuid) to service_role;

-- Status change
create or replace function public.update_registration_status(_id uuid, _status reg_status, _note text, _public_note text, _expected_updated_at timestamptz)
returns timestamptz language plpgsql security definer set search_path=public as $$
declare cur public.registrations; nu timestamptz;
begin
  if not public.has_permission(auth.uid(),'registrations') then raise exception 'Sem permissão.'; end if;
  select * into cur from public.registrations where id=_id for update;
  if not found then raise exception 'Inscrição não encontrada.'; end if;
  if _expected_updated_at is not null and date_trunc('milliseconds', cur.updated_at) <> date_trunc('milliseconds', _expected_updated_at) then
    raise exception 'Esta inscrição foi alterada por outra pessoa. Recarregue antes de salvar.';
  end if;
  update public.registrations set status=_status, public_note=nullif(btrim(coalesce(_public_note,'')),'') where id=_id returning updated_at into nu;
  insert into public.registration_status_history(registration_id, status, note, changed_by) values (_id,_status,nullif(btrim(coalesce(_note,'')),''),auth.uid());
  insert into public.audit_log(actor_id, action, entity, entity_id, details) values (auth.uid(),'status_change','registrations',_id::text, jsonb_build_object('from',cur.status,'to',_status,'note',_note));
  return nu;
end $$;
revoke all on function public.update_registration_status(uuid,reg_status,text,text,timestamptz) from public, anon;
grant execute on function public.update_registration_status(uuid,reg_status,text,text,timestamptz) to authenticated;

-- POLLS
create table public.polls(
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  category text not null default '',
  image_url text,
  status poll_status not null default 'rascunho',
  starts_at timestamptz,
  ends_at timestamptz,
  audience poll_audience not null default 'publica',
  votes_per_user int not null default 1 check (votes_per_user between 1 and 100),
  allow_repeat_option boolean not null default false,
  rules text not null default '',
  results_visibility results_visibility not null default 'apos_encerramento',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.polls to anon;
grant select, insert, update, delete on public.polls to authenticated;
grant all on public.polls to service_role;
alter table public.polls enable row level security;
create policy "polls public read" on public.polls for select to anon, authenticated using (status <> 'rascunho' or public.has_permission(auth.uid(),'polls'));
create policy "polls admin insert" on public.polls for insert to authenticated with check (public.has_permission(auth.uid(),'polls'));
create policy "polls admin update" on public.polls for update to authenticated using (public.has_permission(auth.uid(),'polls'));
create policy "polls admin delete" on public.polls for delete to authenticated using (public.has_permission(auth.uid(),'polls'));
create trigger polls_touch before update on public.polls for each row execute function public.touch_updated_at();
create trigger audit_polls after insert or update or delete on public.polls for each row execute function public.audit_trigger();

create table public.poll_voters(
  poll_id uuid not null references public.polls(id) on delete cascade,
  email text not null,
  primary key(poll_id, email)
);
grant select, insert, delete on public.poll_voters to authenticated;
grant all on public.poll_voters to service_role;
alter table public.poll_voters enable row level security;
create policy "voters admin" on public.poll_voters for all to authenticated using (public.has_permission(auth.uid(),'polls')) with check (public.has_permission(auth.uid(),'polls'));

create table public.poll_options(
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  name text not null,
  description text not null default '',
  image_url text,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index poll_options_poll_idx on public.poll_options(poll_id, position);
grant select on public.poll_options to anon;
grant select, insert, update, delete on public.poll_options to authenticated;
grant all on public.poll_options to service_role;
alter table public.poll_options enable row level security;
create policy "options read" on public.poll_options for select to anon, authenticated using (exists(select 1 from public.polls p where p.id=poll_id and (p.status <> 'rascunho' or public.has_permission(auth.uid(),'polls'))));
create policy "options admin insert" on public.poll_options for insert to authenticated with check (public.has_permission(auth.uid(),'polls'));
create policy "options admin update" on public.poll_options for update to authenticated using (public.has_permission(auth.uid(),'polls'));
create policy "options admin delete" on public.poll_options for delete to authenticated using (public.has_permission(auth.uid(),'polls'));
create trigger audit_options after insert or update or delete on public.poll_options for each row execute function public.audit_trigger();

create table public.votes(
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now()
);
create index votes_poll_user_idx on public.votes(poll_id, user_id);
grant select on public.votes to authenticated;
grant all on public.votes to service_role;
alter table public.votes enable row level security;
create policy "votes own read" on public.votes for select to authenticated using (user_id=auth.uid());

create table public.poll_tallies(
  option_id uuid primary key references public.poll_options(id) on delete cascade,
  poll_id uuid not null references public.polls(id) on delete cascade,
  votes int not null default 0,
  updated_at timestamptz not null default now()
);
grant select on public.poll_tallies to anon, authenticated;
grant all on public.poll_tallies to service_role;
alter table public.poll_tallies enable row level security;
create policy "tallies visible" on public.poll_tallies for select to anon, authenticated using (
  public.has_permission(auth.uid(),'polls') or exists(select 1 from public.polls p where p.id=poll_id and p.status <> 'rascunho' and p.status <> 'cancelada' and (
    p.results_visibility='ao_vivo' or (p.results_visibility='apos_encerramento' and (p.status='encerrada' or (p.ends_at is not null and now() > p.ends_at))))));

create table public.poll_participation(
  poll_id uuid primary key references public.polls(id) on delete cascade,
  voters int not null default 0,
  updated_at timestamptz not null default now()
);
grant select on public.poll_participation to anon, authenticated;
grant all on public.poll_participation to service_role;
alter table public.poll_participation enable row level security;
create policy "participation visible" on public.poll_participation for select to anon, authenticated using (
  public.has_permission(auth.uid(),'polls') or exists(select 1 from public.polls p where p.id=poll_id and p.status <> 'rascunho' and p.results_visibility <> 'oculto'));

create or replace function public.cast_vote(_poll_id uuid, _option_ids uuid[]) returns int
language plpgsql security definer set search_path=public as $$
declare p public.polls; uid uuid := auth.uid(); used int; oid uuid; uemail text; first_vote boolean;
begin
  if uid is null then raise exception 'Entre na sua conta para votar.'; end if;
  if _option_ids is null or array_length(_option_ids,1) is null then raise exception 'Selecione uma opção.'; end if;
  select * into p from public.polls where id=_poll_id for update;
  if not found then raise exception 'Votação não encontrada.'; end if;
  if p.status <> 'ativa' then raise exception 'Esta votação não está aberta.'; end if;
  if p.starts_at is not null and now() < p.starts_at then raise exception 'A votação ainda não começou.'; end if;
  if p.ends_at is not null and now() > p.ends_at then raise exception 'A votação foi encerrada.'; end if;
  if p.audience='restrita' then
    select lower(email) into uemail from auth.users where id=uid;
    if not exists(select 1 from public.poll_voters v where v.poll_id=_poll_id and lower(v.email)=uemail) then
      raise exception 'Você não está habilitado para esta votação.';
    end if;
  end if;
  select count(*) into used from public.votes where poll_id=_poll_id and user_id=uid;
  first_vote := used = 0;
  if used + array_length(_option_ids,1) > p.votes_per_user then
    raise exception 'Limite de votos atingido (% por participante).', p.votes_per_user;
  end if;
  foreach oid in array _option_ids loop
    if not exists(select 1 from public.poll_options o where o.id=oid and o.poll_id=_poll_id) then raise exception 'Opção inválida.'; end if;
    if not p.allow_repeat_option and exists(select 1 from public.votes v where v.poll_id=_poll_id and v.user_id=uid and v.option_id=oid) then
      raise exception 'Você já votou nesta opção.';
    end if;
    insert into public.votes(poll_id, option_id, user_id) values (_poll_id, oid, uid);
    insert into public.poll_tallies(option_id, poll_id, votes) values (oid, _poll_id, 1)
      on conflict (option_id) do update set votes = public.poll_tallies.votes + 1, updated_at=now();
  end loop;
  if (select count(distinct x) from unnest(_option_ids) x) <> array_length(_option_ids,1) and not p.allow_repeat_option then
    raise exception 'Opções repetidas.';
  end if;
  if first_vote then
    insert into public.poll_participation(poll_id, voters) values (_poll_id,1)
      on conflict (poll_id) do update set voters = public.poll_participation.voters + 1, updated_at=now();
  end if;
  return p.votes_per_user - used - array_length(_option_ids,1);
end $$;
revoke all on function public.cast_vote(uuid, uuid[]) from public, anon;
grant execute on function public.cast_vote(uuid, uuid[]) to authenticated;

-- ANNOUNCEMENTS & EVENTS
create table public.announcements(
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  published boolean not null default false,
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.announcements to anon;
grant select, insert, update, delete on public.announcements to authenticated;
grant all on public.announcements to service_role;
alter table public.announcements enable row level security;
create policy "ann read" on public.announcements for select to anon, authenticated using (published or public.has_permission(auth.uid(),'announcements'));
create policy "ann admin insert" on public.announcements for insert to authenticated with check (public.has_permission(auth.uid(),'announcements'));
create policy "ann admin update" on public.announcements for update to authenticated using (public.has_permission(auth.uid(),'announcements'));
create policy "ann admin delete" on public.announcements for delete to authenticated using (public.has_permission(auth.uid(),'announcements'));
create trigger ann_touch before update on public.announcements for each row execute function public.touch_updated_at();
create trigger audit_ann after insert or update or delete on public.announcements for each row execute function public.audit_trigger();

create table public.events(
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  location text not null default '',
  starts_at timestamptz not null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.events to anon;
grant select, insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;
create policy "events read" on public.events for select to anon, authenticated using (published or public.has_permission(auth.uid(),'announcements'));
create policy "events admin insert" on public.events for insert to authenticated with check (public.has_permission(auth.uid(),'announcements'));
create policy "events admin update" on public.events for update to authenticated using (public.has_permission(auth.uid(),'announcements'));
create policy "events admin delete" on public.events for delete to authenticated using (public.has_permission(auth.uid(),'announcements'));
create trigger events_touch before update on public.events for each row execute function public.touch_updated_at();
create trigger audit_events after insert or update or delete on public.events for each row execute function public.audit_trigger();

-- REALTIME
alter publication supabase_realtime add table public.polls, public.poll_options, public.poll_tallies, public.poll_participation,
  public.announcements, public.events, public.registration_forms, public.registration_live_status,
  public.registrations, public.registration_status_history, public.audit_log;

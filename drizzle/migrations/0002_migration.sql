
create or replace function public.grant_owner_master() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if lower(new.email) = 'christianosilva1999@gmail.com' and new.email_confirmed_at is not null then
    insert into public.user_roles(user_id, role) values (new.id, 'master') on conflict do nothing;
  end if;
  return new;
end $$;
create trigger on_auth_user_owner_master after insert or update of email_confirmed_at on auth.users
  for each row execute function public.grant_owner_master();

insert into public.user_roles(user_id, role)
select id, 'master' from auth.users
where lower(email) = 'christianosilva1999@gmail.com' and email_confirmed_at is not null
on conflict do nothing;

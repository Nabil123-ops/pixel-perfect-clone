-- =====================================================================
-- n9n — disable email confirmation for sign-ups
-- Run this in the Supabase SQL editor of project ersfbxnrouwgnpzyvqed.
--
-- ALSO turn the toggle off in the dashboard (this is the real switch):
--   Authentication -> Sign In / Providers -> Email -> "Confirm email" = OFF
-- The SQL below makes every existing AND future user confirmed, so even if
-- the toggle is ever re-enabled nobody gets blocked at sign-in.
-- =====================================================================

-- 1. Confirm everyone who already signed up.
update auth.users
set    email_confirmed_at = coalesce(email_confirmed_at, now()),
       confirmed_at       = coalesce(confirmed_at, now())
where  email_confirmed_at is null;

-- 2. Auto-confirm every future sign-up.
create or replace function public.auto_confirm_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  new.confirmation_token := '';
  return new;
end;
$$;

drop trigger if exists auto_confirm_new_user on auth.users;
create trigger auto_confirm_new_user
  before insert on auth.users
  for each row execute function public.auto_confirm_new_user();

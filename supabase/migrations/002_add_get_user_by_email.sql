-- ============================================================
-- KRYPTA: Add get_user_by_email RPC function
-- This allows server-side lookups of auth users by email
-- via the service role client (bypasses RLS)
-- ============================================================

-- Create function to look up user by email
-- This uses SECURITY DEFINER to access auth.users table
create or replace function public.get_user_by_email(p_email text)
returns table (
  id uuid,
  email text,
  full_name text,
  avatar_url text,
  plan text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select 
    u.id,
    u.email,
    p.full_name,
    p.avatar_url,
    p.plan
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.email = p_email
  limit 1;
end;
$$;

-- Grant execution to authenticated users and service role
grant execute on function public.get_user_by_email(text) to authenticated, service_role;

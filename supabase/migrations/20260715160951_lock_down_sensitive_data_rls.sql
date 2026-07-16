-- ============================================================
-- Migration: Lock down sensitive data with Row Level Security
-- ============================================================
-- Rules agreed with club leadership:
--   members (phone/email)   -> admins/leadership only
--   contributions           -> logged-in members see totals only,
--                              per-person rows are admin/treasurer only
--   choir_members (contact) -> any logged-in, approved member
--
-- Assumes a `profiles` table: id (= auth.uid()), role, approved
-- (matches js/shared-auth.js, which already relies on this shape).
-- ============================================================

-- ---- Helper: is the current user an approved admin? ----
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and approved = true
  );
$$;

-- ---- Helper: is the current user an approved member (any role)? ----
create or replace function public.is_approved_member()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and approved = true
  );
$$;

-- ============================================================
-- members — admins/leadership only
-- ============================================================
alter table public.members enable row level security;

drop policy if exists "members_select_admin_only" on public.members;
create policy "members_select_admin_only"
  on public.members for select
  using (public.is_admin());

drop policy if exists "members_write_admin_only" on public.members;
create policy "members_write_admin_only"
  on public.members for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- choir_members — any approved member can view; admins can write
-- ============================================================
alter table public.choir_members enable row level security;

drop policy if exists "choir_members_select_approved" on public.choir_members;
create policy "choir_members_select_approved"
  on public.choir_members for select
  using (public.is_approved_member());

drop policy if exists "choir_members_write_admin_only" on public.choir_members;
create policy "choir_members_write_admin_only"
  on public.choir_members for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- contributions — per-row detail is admin/treasurer only.
-- Approved members can see totals via a separate view, not raw rows.
-- ============================================================
alter table public.contributions enable row level security;

drop policy if exists "contributions_select_admin_only" on public.contributions;
create policy "contributions_select_admin_only"
  on public.contributions for select
  using (public.is_admin());

drop policy if exists "contributions_write_admin_only" on public.contributions;
create policy "contributions_write_admin_only"
  on public.contributions for all
  using (public.is_admin())
  with check (public.is_admin());

-- Aggregate-only view: safe for any approved member to query.
-- No names, no per-person amounts — just category/month totals.
-- IMPORTANT: this view is intentionally NOT security_invoker, so it
-- runs with the view owner's privileges and bypasses the base
-- table's RLS. Do not add a broader SELECT policy on contributions
-- for approved members, or they'd gain direct row-level access too.
create or replace view public.contribution_totals as
select
  category,
  date_trunc('month', contributed_at) as month,
  sum(amount) as total_amount,
  count(*) as contribution_count
from public.contributions
group by category, date_trunc('month', contributed_at);

grant select on public.contribution_totals to authenticated;

-- Application update signups. Run this in the Supabase SQL Editor.
create table if not exists public.application_notifications (
  id uuid primary key default gen_random_uuid(),
  contact_type text not null check (contact_type in ('email', 'whatsapp')),
  contact_value text not null,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  constraint application_notifications_unique_contact
    unique (contact_type, contact_value)
);

alter table public.application_notifications enable row level security;
revoke all on table public.application_notifications from anon, authenticated;
grant all on table public.application_notifications to service_role;

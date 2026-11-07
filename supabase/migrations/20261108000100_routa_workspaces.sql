-- ROUTA account workspace: one private, versioned workspace per authenticated user.
-- Apply through the Supabase SQL Editor after reviewing this migration.

create table if not exists public.routa_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null default 1 check (schema_version > 0),
  revision bigint not null default 1 check (revision > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.routa_workspaces enable row level security;
alter table public.routa_workspaces force row level security;

revoke all on table public.routa_workspaces from anon, authenticated;
grant select, insert, update on table public.routa_workspaces to authenticated;

drop policy if exists "Users can read their own ROUTA workspace" on public.routa_workspaces;
create policy "Users can read their own ROUTA workspace"
  on public.routa_workspaces for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own ROUTA workspace" on public.routa_workspaces;
create policy "Users can create their own ROUTA workspace"
  on public.routa_workspaces for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own ROUTA workspace" on public.routa_workspaces;
create policy "Users can update their own ROUTA workspace"
  on public.routa_workspaces for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Compare-and-swap save. A stale device cannot silently overwrite a newer revision.
create or replace function public.save_routa_workspace(
  p_expected_revision bigint,
  p_schema_version integer,
  p_payload jsonb
)
returns table (revision bigint, updated_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_revision bigint;
  v_updated_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_expected_revision < 0 or p_schema_version < 1 or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid workspace payload' using errcode = '22023';
  end if;

  if p_expected_revision = 0 then
    insert into public.routa_workspaces (user_id, schema_version, revision, payload)
    values (v_user_id, p_schema_version, 1, p_payload)
    on conflict (user_id) do nothing
    returning routa_workspaces.revision, routa_workspaces.updated_at
      into v_revision, v_updated_at;
  else
    update public.routa_workspaces
       set schema_version = p_schema_version,
           revision = routa_workspaces.revision + 1,
           payload = p_payload,
           updated_at = now()
     where user_id = v_user_id
       and routa_workspaces.revision = p_expected_revision
    returning routa_workspaces.revision, routa_workspaces.updated_at
      into v_revision, v_updated_at;
  end if;

  if v_revision is null then
    raise exception 'Workspace revision conflict; reload before saving' using errcode = '40001';
  end if;

  return query select v_revision, v_updated_at;
end;
$$;

revoke all on function public.save_routa_workspace(bigint, integer, jsonb) from public, anon;
grant execute on function public.save_routa_workspace(bigint, integer, jsonb) to authenticated;

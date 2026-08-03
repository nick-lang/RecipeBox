-- RecipeBox initial schema
-- Users -> groups -> collections -> recipes -> images, secured with RLS
-- keyed off group membership.

-- ---------------------------------------------------------------------------
-- Profiles (mirror of auth.users we can safely expose)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Groups and membership
-- ---------------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  description text,
  invite_code text not null unique
    default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_idx on public.group_members (user_id);

-- Membership helpers run as SECURITY DEFINER so RLS policies can consult
-- group_members without recursing into its own policies.
create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create or replace function public.group_role(gid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from group_members
  where group_id = gid and user_id = auth.uid();
$$;

-- Joining by invite code must bypass RLS (the joiner can't see the group yet).
create or replace function public.join_group(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  gid uuid;
begin
  select id into gid from groups where invite_code = code;
  if gid is null then
    raise exception 'invalid invite code';
  end if;
  insert into group_members (group_id, user_id, role)
  values (gid, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;
  return gid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Collections (e.g. "2026 Cookbook") and recipes
-- ---------------------------------------------------------------------------
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  description text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index collections_group_idx on public.collections (group_id);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id),
  status text not null default 'processing'
    check (status in ('processing', 'draft', 'published', 'failed')),
  title text,
  attribution text,
  category text,
  tags text[] not null default '{}',
  body_md text,
  transcription_notes text,
  -- Which transcriber/model/prompt produced the draft; kept per-recipe so
  -- pipeline experiments can be compared after the fact.
  pipeline_meta jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recipes_collection_idx on public.recipes (collection_id);
create index recipes_uploader_idx on public.recipes (uploaded_by);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger recipes_touch_updated_at
  before update on public.recipes
  for each row execute function public.touch_updated_at();

create table public.recipe_images (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  kind text not null default 'original' check (kind in ('original', 'cleaned')),
  storage_path text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index recipe_images_recipe_idx on public.recipe_images (recipe_id);

-- Resolve a recipe's group for policy checks.
create or replace function public.recipe_group_id(rid uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.group_id
  from recipes r
  join collections c on c.id = r.collection_id
  where r.id = rid;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.collections enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_images enable row level security;

-- Profiles: any signed-in user may read (needed to show member/uploader
-- names); users manage only their own row.
create policy "profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "users update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Groups
create policy "members read their groups"
  on public.groups for select
  to authenticated
  using (public.is_group_member(id));

create policy "authenticated users create groups"
  on public.groups for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "owners and admins update groups"
  on public.groups for update
  to authenticated
  using (public.group_role(id) in ('owner', 'admin'))
  with check (public.group_role(id) in ('owner', 'admin'));

create policy "owners delete groups"
  on public.groups for delete
  to authenticated
  using (public.group_role(id) = 'owner');

-- Group members
create policy "members see fellow members"
  on public.group_members for select
  to authenticated
  using (public.is_group_member(group_id));

-- Direct inserts are only for the creator bootstrapping their own owner row;
-- everyone else joins through join_group() (security definer).
create policy "group creator bootstraps owner membership"
  on public.group_members for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and role = 'owner'
    and exists (
      select 1 from public.groups g
      where g.id = group_id and g.created_by = auth.uid()
    )
  );

create policy "members leave, admins remove"
  on public.group_members for delete
  to authenticated
  using (
    user_id = auth.uid()
    or public.group_role(group_id) in ('owner', 'admin')
  );

create policy "owners and admins change roles"
  on public.group_members for update
  to authenticated
  using (public.group_role(group_id) in ('owner', 'admin'))
  with check (role in ('admin', 'member'));

-- Collections
create policy "members read collections"
  on public.collections for select
  to authenticated
  using (public.is_group_member(group_id));

create policy "members create collections"
  on public.collections for insert
  to authenticated
  with check (public.is_group_member(group_id) and created_by = auth.uid());

create policy "admins or creators update collections"
  on public.collections for update
  to authenticated
  using (
    created_by = auth.uid()
    or public.group_role(group_id) in ('owner', 'admin')
  );

create policy "admins or creators delete collections"
  on public.collections for delete
  to authenticated
  using (
    created_by = auth.uid()
    or public.group_role(group_id) in ('owner', 'admin')
  );

-- Recipes
create policy "members read recipes"
  on public.recipes for select
  to authenticated
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and public.is_group_member(c.group_id)
    )
  );

create policy "members add recipes"
  on public.recipes for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.collections c
      where c.id = collection_id and public.is_group_member(c.group_id)
    )
  );

create policy "uploaders and admins update recipes"
  on public.recipes for update
  to authenticated
  using (
    uploaded_by = auth.uid()
    or public.group_role(public.recipe_group_id(id)) in ('owner', 'admin')
  );

create policy "uploaders and admins delete recipes"
  on public.recipes for delete
  to authenticated
  using (
    uploaded_by = auth.uid()
    or public.group_role(public.recipe_group_id(id)) in ('owner', 'admin')
  );

-- Recipe images follow their recipe's access.
create policy "members read recipe images"
  on public.recipe_images for select
  to authenticated
  using (public.is_group_member(public.recipe_group_id(recipe_id)));

create policy "uploaders add recipe images"
  on public.recipe_images for insert
  to authenticated
  with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and r.uploaded_by = auth.uid()
    )
  );

create policy "uploaders and admins delete recipe images"
  on public.recipe_images for delete
  to authenticated
  using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and (r.uploaded_by = auth.uid()
             or public.group_role(public.recipe_group_id(r.id)) in ('owner', 'admin'))
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: private bucket, paths are <group_id>/<recipe_id>/<file>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', false);

create policy "group members read recipe images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'recipe-images'
    and public.is_group_member(((storage.foldername(name))[1])::uuid)
  );

create policy "group members upload recipe images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'recipe-images'
    and public.is_group_member(((storage.foldername(name))[1])::uuid)
  );

create policy "owner or group admin deletes stored images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'recipe-images'
    and (
      owner = auth.uid()
      or public.group_role(((storage.foldername(name))[1])::uuid) in ('owner', 'admin')
    )
  );

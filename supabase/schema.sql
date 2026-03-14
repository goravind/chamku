-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles: user settings including family member names for assignment
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  family_member_names text[] default array['Me', 'Spouse', 'Child 1', 'Child 2'],
  updated_at timestamptz default now()
);

-- Tasks
create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id text not null,
  title text not null,
  completed boolean default false,
  notes text default '',
  due_date date,
  assigned_to text default '',
  position int default 0,
  created_at timestamptz default now()
);

-- Subtasks
create table if not exists public.subtasks (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  completed boolean default false,
  notes text default '',
  due_date date,
  assigned_to text default '',
  position int default 0,
  created_at timestamptz default now()
);

-- Attachments (file_path references Supabase Storage)
create table if not exists public.attachments (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid references public.tasks(id) on delete cascade,
  subtask_id uuid references public.subtasks(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  file_size int,
  content_type text,
  created_at timestamptz default now(),
  constraint task_or_subtask check (task_id is not null or subtask_id is not null)
);

-- Storage bucket for attachments (run in Supabase Dashboard > Storage)
-- Create bucket "attachments" with public read or use RLS

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.subtasks enable row level security;
alter table public.attachments enable row level security;

-- Auto-create profile when user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, family_member_names)
  values (new.id, array['Me', 'Spouse', 'Child 1', 'Child 2']);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Profiles: users can only read/update their own
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Tasks: users can only access their own
create policy "Users can manage own tasks" on public.tasks
  for all using (auth.uid() = user_id);

-- Subtasks: via task ownership
create policy "Users can manage subtasks of own tasks" on public.subtasks
  for all using (
    exists (select 1 from public.tasks where tasks.id = subtasks.task_id and tasks.user_id = auth.uid())
  );

-- Attachments: via task/subtask ownership
create policy "Users can manage attachments of own tasks" on public.attachments
  for all using (
    (task_id is not null and exists (select 1 from public.tasks where tasks.id = attachments.task_id and tasks.user_id = auth.uid()))
    or
    (subtask_id is not null and exists (select 1 from public.subtasks s join public.tasks t on t.id = s.task_id where s.id = attachments.subtask_id and t.user_id = auth.uid()))
  );

-- Create storage bucket "attachments" in Supabase Dashboard > Storage
-- Then add these policies in Storage > attachments > Policies:
--
-- Policy: "Users can upload to own folder"
-- INSERT with check: (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text)
--
-- Policy: "Users can read own files"
-- SELECT with check: (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text)
--
-- Policy: "Users can delete own files"
-- DELETE with check: (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text)

-- FocusFlow initial schema
-- Run via Supabase CLI (`supabase db push`) or the SQL editor.
-- Every user-owned table has user_id -> auth.users and RLS: auth.uid() = user_id.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  avatar_url text,
  education_level text check (education_level in ('school','college','university','other')),
  daily_goal_minutes int not null default 120 check (daily_goal_minutes between 10 and 960),
  timezone text not null default 'UTC',
  focus_minutes int not null default 25 check (focus_minutes between 1 and 180),
  short_break_minutes int not null default 5 check (short_break_minutes between 1 and 60),
  long_break_minutes int not null default 15 check (long_break_minutes between 1 and 120),
  sessions_before_long_break int not null default 4 check (sessions_before_long_break between 2 and 10),
  theme text not null default 'dark' check (theme in ('dark','light','system')),
  xp int not null default 0 check (xp >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- subjects, topics
-- ---------------------------------------------------------------------------
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  code text check (char_length(code) <= 32),
  description text,
  color text not null default '#7c5cff' check (color ~ '^#[0-9a-fA-F]{6}$'),
  weekly_goal_minutes int check (weekly_goal_minutes is null or weekly_goal_minutes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_subjects_user on public.subjects(user_id);
create trigger trg_subjects_updated before update on public.subjects
  for each row execute function public.set_updated_at();

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  chapter text check (char_length(chapter) <= 120),
  name text not null check (char_length(name) between 1 and 160),
  difficulty smallint not null default 3 check (difficulty between 1 and 5),
  importance smallint not null default 3 check (importance between 1 and 5),
  confidence smallint not null default 0 check (confidence between 0 and 5),
  estimated_minutes int check (estimated_minutes is null or estimated_minutes > 0),
  is_completed boolean not null default false,
  needs_revision boolean not null default false,
  completed_at timestamptz,
  last_revised_at timestamptz,
  revision_count int not null default 0 check (revision_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_topics_user_subject on public.topics(user_id, subject_id);
create index idx_topics_revision on public.topics(user_id, needs_revision, last_revised_at);
create trigger trg_topics_updated before update on public.topics
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- exams
-- ---------------------------------------------------------------------------
create table public.exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  exam_date timestamptz not null,
  weight_percent numeric(5,2) check (weight_percent is null or weight_percent between 0 and 100),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_exams_user_date on public.exams(user_id, exam_date);
create trigger trg_exams_updated before update on public.exams
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- tasks, subtasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  category text check (char_length(category) <= 60),
  priority text not null default 'medium' check (priority in ('high','medium','low')),
  importance smallint not null default 3 check (importance between 1 and 5),
  status text not null default 'not_started' check (status in ('not_started','in_progress','completed')),
  deadline timestamptz,
  estimated_minutes int check (estimated_minutes is null or estimated_minutes > 0),
  actual_minutes int not null default 0 check (actual_minutes >= 0),
  completed_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_completed_at check ((status = 'completed') = (completed_at is not null))
);
create index idx_tasks_user_status on public.tasks(user_id, status);
create index idx_tasks_user_deadline on public.tasks(user_id, deadline) where status <> 'completed';
create index idx_tasks_subject on public.tasks(subject_id);
create trigger trg_tasks_updated before update on public.tasks
  for each row execute function public.set_updated_at();

create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  is_done boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_subtasks_task on public.subtasks(task_id);
create trigger trg_subtasks_updated before update on public.subtasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- pomodoro_sessions, study_logs
-- ---------------------------------------------------------------------------
create table public.pomodoro_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete set null,
  kind text not null check (kind in ('focus','short_break','long_break')),
  planned_seconds int not null check (planned_seconds > 0),
  focused_seconds int not null default 0 check (focused_seconds >= 0),
  status text not null check (status in ('running','completed','interrupted')),
  started_at timestamptz not null,
  ended_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create index idx_pomo_user_started on public.pomodoro_sessions(user_id, started_at desc);
create index idx_pomo_task on public.pomodoro_sessions(task_id);

create table public.study_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  session_id uuid references public.pomodoro_sessions(id) on delete set null,
  log_date date not null,
  minutes int not null check (minutes > 0),
  source text not null default 'pomodoro' check (source in ('pomodoro','manual')),
  created_at timestamptz not null default now()
);
create index idx_logs_user_date on public.study_logs(user_id, log_date);
create index idx_logs_subject on public.study_logs(user_id, subject_id, log_date);

-- ---------------------------------------------------------------------------
-- schedules (user-approved plan blocks), calendar_events, reminders
-- ---------------------------------------------------------------------------
create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  block_type text not null default 'study' check (block_type in ('study','revision','assignment','exam_prep')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'planned' check (status in ('planned','done','missed','rescheduled')),
  rationale text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_schedule_range check (ends_at > starts_at)
);
create index idx_schedules_user_start on public.schedules(user_id, starts_at);
create trigger trg_schedules_updated before update on public.schedules
  for each row execute function public.set_updated_at();

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  event_type text not null default 'custom'
    check (event_type in ('study','assignment','exam','deadline','revision','custom')),
  subject_id uuid references public.subjects(id) on delete set null,
  task_id uuid references public.tasks(id) on delete cascade,
  exam_id uuid references public.exams(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_event_range check (ends_at is null or ends_at >= starts_at)
);
create index idx_events_user_start on public.calendar_events(user_id, starts_at);
create trigger trg_events_updated before update on public.calendar_events
  for each row execute function public.set_updated_at();

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  event_id uuid references public.calendar_events(id) on delete cascade,
  exam_id uuid references public.exams(id) on delete cascade,
  remind_at timestamptz not null,
  sent_at timestamptz,
  dismissed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint chk_reminder_target check (
    (task_id is not null)::int + (event_id is not null)::int + (exam_id is not null)::int = 1)
);
create index idx_reminders_due on public.reminders(user_id, remind_at) where sent_at is null and not dismissed;

-- ---------------------------------------------------------------------------
-- goals, revision_records
-- ---------------------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete cascade,
  period text not null check (period in ('daily','weekly','challenge')),
  metric text not null check (metric in ('study_minutes','tasks_completed','focus_sessions','topics_revised')),
  target int not null check (target > 0),
  starts_on date not null,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_goal_range check (ends_on is null or ends_on >= starts_on)
);
create index idx_goals_user on public.goals(user_id, period);
create trigger trg_goals_updated before update on public.goals
  for each row execute function public.set_updated_at();

create table public.revision_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  revised_at timestamptz not null default now(),
  confidence_before smallint check (confidence_before between 0 and 5),
  confidence_after smallint not null check (confidence_after between 0 and 5),
  minutes int check (minutes is null or minutes > 0),
  notes text
);
create index idx_revisions_topic on public.revision_records(user_id, topic_id, revised_at desc);

-- ---------------------------------------------------------------------------
-- achievements (global catalog) and user_achievements
-- ---------------------------------------------------------------------------
create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null,
  xp_reward int not null default 50 check (xp_reward >= 0),
  icon text
);

create table public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  unique (user_id, achievement_id)
);
create index idx_user_ach_user on public.user_achievements(user_id);

insert into public.achievements (code, name, description, xp_reward, icon) values
  ('first_focus',      'First Focus',      'Complete your first Pomodoro.',             50,  'timer'),
  ('consistency_7',    'Consistency',      'Study on seven consecutive days.',          200, 'flame'),
  ('task_master_25',   'Task Master',      'Complete 25 tasks.',                        150, 'check-circle'),
  ('deep_focus_10',    'Deep Focus',       'Complete 10 focus sessions.',               100, 'brain'),
  ('subject_explorer', 'Subject Explorer', 'Study five different subjects.',            100, 'compass');

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.subjects          enable row level security;
alter table public.topics            enable row level security;
alter table public.exams             enable row level security;
alter table public.tasks             enable row level security;
alter table public.subtasks          enable row level security;
alter table public.pomodoro_sessions enable row level security;
alter table public.study_logs        enable row level security;
alter table public.schedules         enable row level security;
alter table public.calendar_events   enable row level security;
alter table public.reminders         enable row level security;
alter table public.goals             enable row level security;
alter table public.revision_records  enable row level security;
alter table public.achievements      enable row level security;
alter table public.user_achievements enable row level security;

-- profiles: keyed by id
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- achievements catalog: readable by any signed-in user, writable by nobody via API
create policy "achievements_read" on public.achievements for select to authenticated using (true);

-- Generic owner policies for every user_id table
do $$
declare t text;
begin
  foreach t in array array[
    'subjects','topics','exams','tasks','subtasks','pomodoro_sessions','study_logs',
    'schedules','calendar_events','reminders','goals','revision_records','user_achievements'
  ] loop
    execute format('create policy "%1$s_select_own" on public.%1$I for select using (auth.uid() = user_id)', t);
    execute format('create policy "%1$s_insert_own" on public.%1$I for insert with check (auth.uid() = user_id)', t);
    execute format('create policy "%1$s_update_own" on public.%1$I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "%1$s_delete_own" on public.%1$I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Cross-table ownership guard: a child row may only reference parents owned by the same user.
-- RLS alone checks user_id, not that subject_id/task_id belong to that user.
-- ---------------------------------------------------------------------------
create or replace function public.assert_same_owner()
returns trigger language plpgsql as $$
declare
  parent_owner uuid;
begin
  if tg_table_name = 'subtasks' then
    select user_id into parent_owner from public.tasks where id = new.task_id;
  elsif tg_table_name = 'topics' or tg_table_name = 'exams' then
    select user_id into parent_owner from public.subjects where id = new.subject_id;
  elsif tg_table_name = 'revision_records' then
    select user_id into parent_owner from public.topics where id = new.topic_id;
  end if;
  if parent_owner is distinct from new.user_id then
    raise exception 'parent record does not belong to this user';
  end if;
  return new;
end $$;

create trigger trg_subtasks_owner before insert or update on public.subtasks
  for each row execute function public.assert_same_owner();
create trigger trg_topics_owner before insert or update on public.topics
  for each row execute function public.assert_same_owner();
create trigger trg_exams_owner before insert or update on public.exams
  for each row execute function public.assert_same_owner();
create trigger trg_revisions_owner before insert or update on public.revision_records
  for each row execute function public.assert_same_owner();

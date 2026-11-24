-- Carebase: animal shelter case management schema
-- Matches src/lib/types.ts (camelCase in the app ↔ snake_case here; see src/lib/adapters.ts).

create extension if not exists "pgcrypto";

-- ---------- enums ----------
create type staff_role      as enum ('Manager', 'Doctor', 'Assistant', 'Support Staff');
create type animal_type     as enum ('Dog', 'Cat', 'Other');
create type animal_sex      as enum ('Male', 'Female', 'Unknown');
create type case_status     as enum ('Newly Admitted', 'Awaiting Assessment', 'Under Assessment', 'Care Plan Decided',
                                     'Awaiting Treatment', 'In Treatment', 'Surgery Scheduled', 'Post-Surgery Recovery',
                                     'Under Observation', 'Completed');
create type surgery_status  as enum ('Scheduled', 'In Progress', 'Completed', 'Postponed');
create type update_type     as enum ('Admission', 'Token Issued', 'Assessment', 'Care Plan', 'Treatment', 'Medication',
                                     'Surgery', 'Observation', 'Feeding', 'Status Change', 'Handover', 'General Note');
create type handover_priority as enum ('Low', 'Normal', 'High', 'Urgent');
create type handover_status as enum ('Pending', 'Acknowledged');
create type task_category   as enum ('Feeding', 'Medication', 'Cleaning', 'Examination', 'Surgery Preparation',
                                     'Post-Surgery Care', 'Observation', 'General');
create type task_status     as enum ('To Do', 'In Progress', 'Completed');
create type task_priority   as enum ('Low', 'Medium', 'High');
create type shift_type      as enum ('Morning', 'Afternoon', 'Evening', 'Full Day');

-- ---------- 1. users: links Supabase Auth accounts to staff profiles ----------
create table public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  staff_id    text unique,
  created_at  timestamptz not null default now()
);

-- ---------- 2. staff ----------
create table public.staff (
  id          text primary key,                          -- STF-001
  name        text not null check (length(trim(name)) >= 2),
  role        staff_role not null,
  email       text not null unique,
  phone       text not null,
  active      boolean not null default true,
  joined_at   timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.users add constraint users_staff_fk foreign key (staff_id) references public.staff (id) on delete set null;

-- ---------- 3. animals ----------
create table public.animals (
  id              text primary key,                      -- ANM-0001
  token           text not null check (token ~ '^\d{1,4}$'),
  name            text not null,
  type            animal_type not null,
  breed           text not null default '',
  age             text not null default '',
  sex             animal_sex not null default 'Unknown',
  admission_date  timestamptz not null default now(),
  owner_name      text,
  contact_number  text,
  doctor_id       text references public.staff (id) on delete set null,
  notes           text,
  image_url       text,
  archived        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index animals_token_idx on public.animals (token);
create index animals_name_idx  on public.animals (lower(name));

-- ---------- 4. cases (one animal → many cases) ----------
create table public.cases (
  id                 text primary key,                   -- CB-1021
  animal_id          text not null references public.animals (id) on delete cascade,
  token              text not null,
  reason             text not null,
  status             case_status not null default 'Newly Admitted',
  doctor_id          text references public.staff (id) on delete set null,
  responsible_id     text references public.staff (id) on delete set null,
  last_action        text not null default '',
  next_action        text not null default '',
  opened_at          timestamptz not null default now(),
  closed_at          timestamptz,
  surgery_at         timestamptz,
  surgery_status     surgery_status,
  surgery_procedure  text,
  created_by         text not null references public.staff (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint closed_when_completed check ((status = 'Completed') = (closed_at is not null))
);
create index cases_animal_idx      on public.cases (animal_id);
create index cases_status_idx      on public.cases (status);
create index cases_responsible_idx on public.cases (responsible_id);
create index cases_doctor_idx      on public.cases (doctor_id);
-- A token identifies exactly one open case on the floor.
create unique index cases_open_token_uniq on public.cases (token) where status <> 'Completed';
-- An animal has at most one open case at a time.
create unique index cases_open_animal_uniq on public.cases (animal_id) where status <> 'Completed';

-- ---------- 5. care_updates ----------
create table public.care_updates (
  id              text primary key,                      -- CU-0001
  case_id         text not null references public.cases (id) on delete cascade,
  type            update_type not null,
  description     text not null,
  status          case_status not null,
  next_action     text not null,
  responsible_id  text references public.staff (id) on delete set null,
  created_by      text not null references public.staff (id),
  created_at      timestamptz not null default now()
);
create index care_updates_case_idx on public.care_updates (case_id, created_at);

-- ---------- 6. handovers ----------
create table public.handovers (
  id                       text primary key,             -- HO-001
  case_id                  text not null references public.cases (id) on delete cascade,
  from_id                  text not null references public.staff (id),
  to_id                    text not null references public.staff (id),
  previous_action          text not null,
  current_status           case_status not null,
  next_action              text not null,
  notes                    text,
  priority                 handover_priority not null default 'Normal',
  summary                  text not null,
  status                   handover_status not null default 'Pending',
  created_by               text not null references public.staff (id),
  created_at               timestamptz not null default now(),
  acknowledged_at          timestamptz,
  accepted_responsibility  boolean not null default false,
  constraint different_people check (from_id <> to_id),
  constraint ack_consistency check ((status = 'Acknowledged') = (acknowledged_at is not null))
);
create index handovers_case_idx on public.handovers (case_id);
create index handovers_to_idx   on public.handovers (to_id, status);
create unique index handovers_one_pending_per_case on public.handovers (case_id) where status = 'Pending';

-- ---------- 7. tasks ----------
create table public.tasks (
  id            text primary key,                        -- TSK-001
  title         text not null,
  description   text,
  category      task_category not null default 'General',
  animal_id     text references public.animals (id) on delete cascade,
  case_id       text references public.cases (id) on delete cascade,
  assignee_id   text not null references public.staff (id),
  due_date      date not null,
  due_time      time not null,
  priority      task_priority not null default 'Medium',
  status        task_status not null default 'To Do',     -- "Overdue" is derived from due_date/due_time
  completed_at  timestamptz,
  completed_by  text references public.staff (id),
  created_by    text not null references public.staff (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index tasks_assignee_idx on public.tasks (assignee_id, status);
create index tasks_due_idx      on public.tasks (due_date, due_time);
create index tasks_case_idx     on public.tasks (case_id);

-- ---------- 8. duty_schedules ----------
create table public.duty_schedules (
  id          text primary key,                          -- DS-0001
  date        date not null,
  staff_id    text not null references public.staff (id) on delete cascade,
  shift       shift_type not null,
  duty        text not null,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (date, staff_id, shift)
);
create index duty_date_idx on public.duty_schedules (date);

-- ---------- 9. activity_logs (append-only) ----------
create table public.activity_logs (
  id           text primary key,                         -- ACT-0001
  action       text not null,
  description  text not null,
  case_id      text references public.cases (id) on delete set null,
  animal_id    text references public.animals (id) on delete set null,
  staff_id     text not null references public.staff (id),
  created_at   timestamptz not null default now()
);
create index activity_created_idx on public.activity_logs (created_at desc);
create index activity_staff_idx   on public.activity_logs (staff_id);
create index activity_case_idx    on public.activity_logs (case_id);

-- ---------- 10. notifications ----------
create table public.notifications (
  id            text primary key,
  recipient_id  text not null references public.staff (id) on delete cascade,
  type          text not null,
  title         text not null,
  message       text not null,
  link          text not null,
  read          boolean not null default false,
  key           text unique,                              -- de-duplicates generated reminders
  created_at    timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications (recipient_id, read, created_at desc);

-- ---------- shelter settings (single row) ----------
create table public.shelter_settings (
  id                        int primary key default 1 check (id = 1),
  shelter_name              text not null,
  location                  text not null default '',
  surgery_days              int[] not null default '{1,2,4,5}',
  surgery_start_time        text not null default '10:00',
  handover_reminder_hours   int not null default 4 check (handover_reminder_hours between 1 and 24)
);
insert into public.shelter_settings (shelter_name, location) values ('Worli Animal Care Shelter', 'Worli, Mumbai');

-- ---------- updated_at triggers ----------
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger staff_touch   before update on public.staff          for each row execute function public.touch_updated_at();
create trigger animals_touch before update on public.animals        for each row execute function public.touch_updated_at();
create trigger tasks_touch   before update on public.tasks          for each row execute function public.touch_updated_at();
create trigger duty_touch    before update on public.duty_schedules for each row execute function public.touch_updated_at();

-- ======================================================================
-- Row Level Security
-- ======================================================================
create or replace function public.current_staff_id() returns text
language sql stable security definer set search_path = public as $$
  select u.staff_id from public.users u join public.staff s on s.id = u.staff_id
  where u.id = auth.uid() and s.active
$$;
create or replace function public.current_role() returns staff_role
language sql stable security definer set search_path = public as $$
  select s.role from public.staff s where s.id = public.current_staff_id()
$$;

alter table public.users            enable row level security;
alter table public.staff            enable row level security;
alter table public.animals          enable row level security;
alter table public.cases            enable row level security;
alter table public.care_updates     enable row level security;
alter table public.handovers        enable row level security;
alter table public.tasks            enable row level security;
alter table public.duty_schedules   enable row level security;
alter table public.activity_logs    enable row level security;
alter table public.notifications    enable row level security;
alter table public.shelter_settings enable row level security;

-- Everyone signed in as active staff can read shared shelter data (small team, shared floor).
create policy "staff read users"    on public.users          for select using (id = auth.uid() or public.current_role() = 'Manager');
create policy "staff read staff"    on public.staff          for select using (public.current_staff_id() is not null);
create policy "staff read animals"  on public.animals        for select using (public.current_staff_id() is not null);
create policy "staff read cases"    on public.cases          for select using (public.current_staff_id() is not null);
create policy "staff read updates"  on public.care_updates   for select using (public.current_staff_id() is not null);
create policy "staff read handover" on public.handovers      for select using (public.current_staff_id() is not null);
create policy "staff read tasks"    on public.tasks          for select using (public.current_staff_id() is not null);
create policy "staff read duty"     on public.duty_schedules for select using (public.current_staff_id() is not null);
create policy "staff read activity" on public.activity_logs  for select using (public.current_staff_id() is not null);
create policy "staff read settings" on public.shelter_settings for select using (public.current_staff_id() is not null);
create policy "own notifications"   on public.notifications  for select using (recipient_id = public.current_staff_id());

-- Manager: full write access to staff, schedules and settings.
create policy "manager manages staff"    on public.staff            for all using (public.current_role() = 'Manager') with check (public.current_role() = 'Manager');
create policy "manager manages duty"     on public.duty_schedules   for all using (public.current_role() = 'Manager') with check (public.current_role() = 'Manager');
create policy "manager manages settings" on public.shelter_settings for all using (public.current_role() = 'Manager') with check (public.current_role() = 'Manager');

-- Animals: Manager/Doctor/Assistant can register; Manager/Doctor edit; Manager deletes.
create policy "register animals" on public.animals for insert with check (public.current_role() in ('Manager', 'Doctor', 'Assistant'));
create policy "edit animals"     on public.animals for update using (public.current_role() in ('Manager', 'Doctor'));
create policy "delete animals"   on public.animals for delete using (public.current_role() = 'Manager');

-- Cases: Manager/Doctor create and change status; Assistants update cases they are responsible for (care progress).
create policy "create cases" on public.cases for insert with check (public.current_role() in ('Manager', 'Doctor', 'Assistant'));
create policy "update cases" on public.cases for update using (
  public.current_role() in ('Manager', 'Doctor')
  or (public.current_role() = 'Assistant' and (responsible_id = public.current_staff_id()
       or exists (select 1 from public.handovers h where h.case_id = cases.id and h.to_id = public.current_staff_id())))
);

-- Care updates: clinical staff add, attributed to themselves; never edited.
create policy "add care updates" on public.care_updates for insert
  with check (public.current_role() in ('Manager', 'Doctor', 'Assistant') and created_by = public.current_staff_id());

-- Handovers: clinical staff create; only the receiver acknowledges.
create policy "create handovers" on public.handovers for insert
  with check (public.current_role() in ('Manager', 'Doctor', 'Assistant') and created_by = public.current_staff_id());
create policy "receiver acknowledges" on public.handovers for update
  using (to_id = public.current_staff_id()) with check (to_id = public.current_staff_id());

-- Tasks: Manager/Doctor create, assign, edit any; assignees update their own; support staff only operational categories.
create policy "create tasks" on public.tasks for insert with check (
  public.current_role() in ('Manager', 'Doctor') or assignee_id = public.current_staff_id());
create policy "update tasks" on public.tasks for update using (
  public.current_role() in ('Manager', 'Doctor')
  or (assignee_id = public.current_staff_id()
      and (public.current_role() <> 'Support Staff' or category in ('Cleaning', 'Feeding', 'General'))));
create policy "delete tasks" on public.tasks for delete using (public.current_role() = 'Manager');

-- Activity log: append-only, attributed to the actor.
create policy "append activity" on public.activity_logs for insert with check (staff_id = public.current_staff_id());

-- Notifications: anyone can notify a colleague; recipients mark their own as read.
create policy "send notifications" on public.notifications for insert with check (public.current_staff_id() is not null);
create policy "read own notifications" on public.notifications for update using (recipient_id = public.current_staff_id());

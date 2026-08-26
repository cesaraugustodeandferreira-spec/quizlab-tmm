-- QuizLab · 0001 · Schema (tabelas, índices, triggers, realtime)

create extension if not exists pgcrypto;

create type public.user_role as enum ('professor', 'aluno');
create type public.difficulty as enum ('facil', 'media', 'dificil');
create type public.quiz_status as enum ('rascunho', 'publicado');
create type public.session_status as enum ('aguardando', 'em_andamento', 'encerrada');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Professor',
  email text,
  school text,
  role public.user_role not null default 'professor',
  created_at timestamptz not null default now()
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (subject_id, name)
);
create index topics_subject_idx on public.topics(subject_id);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  grade_year text not null default '',
  identifier text,
  access_code varchar(8) not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index classes_teacher_idx on public.classes(teacher_id);

create table public.class_students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (class_id, name)
);
create index class_students_class_idx on public.class_students(class_id);
create unique index class_students_norm_idx on public.class_students(class_id, lower(btrim(name)));

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id),
  topic_id uuid references public.topics(id) on delete set null,
  subtopic text,
  statement text not null,
  options jsonb not null default '["","","",""]'::jsonb
    check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  correct_index smallint not null check (correct_index between 0 and 3),
  image_url text,
  difficulty public.difficulty not null default 'media',
  time_override_seconds smallint check (time_override_seconds between 5 and 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index questions_teacher_idx on public.questions(teacher_id);
create index questions_subject_idx on public.questions(subject_id);
create index questions_topic_idx on public.questions(topic_id);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  subject_id uuid references public.subjects(id),
  topic_id uuid references public.topics(id) on delete set null,
  status public.quiz_status not null default 'rascunho',
  default_time_seconds smallint not null default 20 check (default_time_seconds between 5 and 600),
  show_ranking boolean not null default true,
  show_score boolean not null default true,
  show_correct_answers boolean not null default false,
  is_shared boolean not null default false,
  source_quiz_id uuid references public.quizzes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quizzes_teacher_idx on public.quizzes(teacher_id);
create index quizzes_status_idx on public.quizzes(status);

create table public.quiz_questions (
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  position smallint not null check (position >= 1),
  created_at timestamptz not null default now(),
  primary key (quiz_id, question_id)
);
create unique index quiz_questions_position_key
  on public.quiz_questions(quiz_id, position) deferrable initially deferred;
create index quiz_questions_question_idx on public.quiz_questions(question_id);

create table public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  room_code varchar(6) not null unique,
  status public.session_status not null default 'aguardando',
  current_index smallint not null default 0,
  question_started_at timestamptz,
  question_seconds smallint,
  reveal_current boolean not null default false,
  started_at timestamptz,
  ended_at timestamptz,
  show_ranking boolean not null default true,
  show_score boolean not null default true,
  show_correct_answers boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index quiz_sessions_quiz_idx on public.quiz_sessions(quiz_id);
create index quiz_sessions_class_idx on public.quiz_sessions(class_id);
create index quiz_sessions_room_idx on public.quiz_sessions(room_code);

create table public.session_students (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  class_student_id uuid references public.class_students(id) on delete cascade,
  name text not null,
  token uuid not null default gen_random_uuid() unique,
  joined_at timestamptz not null default now(),
  total_points numeric not null default 0,
  correct_count integer not null default 0
);
create index session_students_session_idx on public.session_students(session_id);
create index session_students_class_student_idx on public.session_students(class_student_id);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  session_student_id uuid not null references public.session_students(id) on delete cascade,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_index smallint,
  is_correct boolean not null default false,
  points_earned numeric not null default 0,
  time_ms integer,
  answered_at timestamptz not null default now(),
  unique (session_student_id, question_id)
);
create index answers_session_idx on public.answers(session_id);
create index answers_question_idx on public.answers(question_id);
create index answers_class_idx on public.answers(class_id);
create index answers_quiz_idx on public.answers(quiz_id);
create index answers_student_idx on public.answers(session_student_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger classes_updated_at before update on public.classes
  for each row execute function public.set_updated_at();
create trigger questions_updated_at before update on public.questions
  for each row execute function public.set_updated_at();
create trigger quizzes_updated_at before update on public.quizzes
  for each row execute function public.set_updated_at();

create or replace function public.random_code(p_len integer default 6)
returns text language sql volatile as $$
  select string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', ceil(random() * 31)::int, 1), ''
  ) from generate_series(1, p_len);
$$;

create or replace function public.assign_class_code()
returns trigger language plpgsql as $$
begin
  if new.access_code is null or length(new.access_code) = 0 then
    loop
      new.access_code := public.random_code(6);
      exit when not exists (select 1 from public.classes c where c.access_code = new.access_code);
    end loop;
  end if;
  return new;
end $$;

create trigger classes_assign_code before insert on public.classes
  for each row execute function public.assign_class_code();

create or replace function public.assign_room_code()
returns trigger language plpgsql as $$
begin
  if new.room_code is null or length(new.room_code) = 0 then
    loop
      new.room_code := public.random_code(6);
      exit when not exists (select 1 from public.quiz_sessions s where s.room_code = new.room_code);
    end loop;
  end if;
  return new;
end $$;

create trigger quiz_sessions_assign_room before insert on public.quiz_sessions
  for each row execute function public.assign_room_code();

create or replace function public.sync_session_settings()
returns trigger language plpgsql security definer set search_path = public as $$
declare q public.quizzes%rowtype;
begin
  select * into q from public.quizzes where id = new.quiz_id;
  if q.id is not null then
    new.show_ranking := q.show_ranking;
    new.show_score := q.show_score;
    new.show_correct_answers := q.show_correct_answers;
  end if;
  return new;
end $$;

create trigger quiz_sessions_sync_settings before insert on public.quiz_sessions
  for each row execute function public.sync_session_settings();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, school, role)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'), ''), 'Professor'),
    new.email,
    nullif(btrim(new.raw_user_meta_data->>'school'), ''),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'professor')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

do $$
begin
  alter publication supabase_realtime add table public.quiz_sessions;
  alter publication supabase_realtime add table public.session_students;
  alter publication supabase_realtime add table public.answers;
exception
  when undefined_object then null;
  when duplicate_object then null;
end $$;

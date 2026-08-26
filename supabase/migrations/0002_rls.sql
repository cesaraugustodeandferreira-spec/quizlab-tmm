-- QuizLab · 0002 · Row Level Security

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.classes enable row level security;
alter table public.class_students enable row level security;
alter table public.questions enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_sessions enable row level security;
alter table public.session_students enable row level security;
alter table public.answers enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "subjects_select" on public.subjects
  for select to authenticated, anon using (true);

create policy "topics_select" on public.topics
  for select to authenticated, anon using (true);

create policy "classes_all_own" on public.classes
  for all to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy "class_students_select_via_class" on public.class_students
  for select to authenticated
  using (exists (
    select 1 from public.classes c
    where c.id = class_id and c.teacher_id = auth.uid()
  ));
create policy "class_students_write_via_class" on public.class_students
  for all to authenticated
  using (exists (
    select 1 from public.classes c
    where c.id = class_id and c.teacher_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.classes c
    where c.id = class_id and c.teacher_id = auth.uid()
  ));

create policy "questions_select_own" on public.questions
  for select to authenticated using (teacher_id = auth.uid());
create policy "questions_write_own" on public.questions
  for all to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy "quizzes_select_own" on public.quizzes
  for select to authenticated using (teacher_id = auth.uid());
create policy "quizzes_write_own" on public.quizzes
  for all to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy "quiz_questions_select_own" on public.quiz_questions
  for select to authenticated
  using (exists (
    select 1 from public.quizzes q where q.id = quiz_id and q.teacher_id = auth.uid()
  ));
create policy "quiz_questions_insert_own" on public.quiz_questions
  for insert to authenticated
  with check (
    exists (select 1 from public.quizzes q where q.id = quiz_id and q.teacher_id = auth.uid())
    and exists (select 1 from public.questions qs where qs.id = question_id and qs.teacher_id = auth.uid())
  );
create policy "quiz_questions_delete_own" on public.quiz_questions
  for delete to authenticated
  using (exists (
    select 1 from public.quizzes q where q.id = quiz_id and q.teacher_id = auth.uid()
  ));

create policy "sessions_select_host" on public.quiz_sessions
  for select to authenticated
  using (exists (
    select 1 from public.quizzes q where q.id = quiz_id and q.teacher_id = auth.uid()
  ));
create policy "sessions_select_active_public" on public.quiz_sessions
  for select to anon, authenticated
  using (status in ('aguardando', 'em_andamento'));
create policy "sessions_insert_host" on public.quiz_sessions
  for insert to authenticated
  with check (
    exists (
      select 1 from public.quizzes q
      where q.id = quiz_id and q.teacher_id = auth.uid() and q.status = 'publicado'
    )
    and exists (
      select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid()
    )
  );
create policy "sessions_update_host" on public.quiz_sessions
  for update to authenticated
  using (exists (
    select 1 from public.quizzes q where q.id = quiz_id and q.teacher_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.quizzes q where q.id = quiz_id and q.teacher_id = auth.uid()
  ));
create policy "sessions_delete_host" on public.quiz_sessions
  for delete to authenticated
  using (exists (
    select 1 from public.quizzes q where q.id = quiz_id and q.teacher_id = auth.uid()
  ));

create policy "session_students_select_host" on public.session_students
  for select to authenticated
  using (exists (
    select 1
    from public.quiz_sessions s
    join public.quizzes q on q.id = s.quiz_id
    where s.id = session_id and q.teacher_id = auth.uid()
  ));

create policy "answers_select_host" on public.answers
  for select to authenticated
  using (exists (
    select 1
    from public.quiz_sessions s
    join public.quizzes q on q.id = s.quiz_id
    where s.id = session_id and q.teacher_id = auth.uid()
  ));

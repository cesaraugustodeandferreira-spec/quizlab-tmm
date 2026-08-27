-- QuizLab · 0007 · Exclusão em cascata de disciplinas

-- 1. Quizzes vinculados a uma disciplina excluída são apagados em cascata
alter table public.quizzes drop constraint if exists quizzes_subject_id_fkey;
alter table public.quizzes add constraint quizzes_subject_id_fkey
  foreign key (subject_id) references public.subjects(id) on delete cascade;

-- 2. Questões vinculadas a uma disciplina excluída são apagadas em cascata
--    (as respostas caem em cascata pelas FKs já existentes: quiz_questions, quiz_sessions, answers)
alter table public.questions drop constraint if exists questions_subject_id_fkey;
alter table public.questions add constraint questions_subject_id_fkey
  foreign key (subject_id) references public.subjects(id) on delete cascade;

-- 3. RLS: só o dono pode excluir a própria disciplina (catálogo global permanece protegido)
drop policy if exists "subjects_delete_own" on public.subjects;
create policy "subjects_delete_own" on public.subjects
  for delete to authenticated
  using (teacher_id = auth.uid());

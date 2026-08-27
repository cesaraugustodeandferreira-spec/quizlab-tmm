-- QuizLab · 0006 · Disciplinas pertencem ao professor + criação

-- 1. Garantir coluna teacher_id (já existe em alguns ambientes; idempotente)
alter table public.subjects add column if not exists teacher_id uuid references public.profiles(id) on delete cascade;

-- 2. Reescrever políticas de RLS para disciplinas
--    - visível: própria OU global (teacher_id is null, catálogo inicial)
--    - inserção: somente própria (teacher_id = auth.uid())
drop policy if exists "subjects_select" on public.subjects;
drop policy if exists "subjects_teacher_all" on public.subjects;
drop policy if exists "subjects_insert_own" on public.subjects;

create policy "subjects_select" on public.subjects
  for select to authenticated, anon
  using (teacher_id = auth.uid() or teacher_id is null);

create policy "subjects_insert_own" on public.subjects
  for insert to authenticated
  with check (teacher_id = auth.uid());

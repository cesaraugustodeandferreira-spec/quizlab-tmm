-- QuizLab · 0013 · Feedback de professores (relato de problemas)
-- Tabela: id, professor_id, professor_email, mensagem, url_contexto, created_at

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.profiles(id) on delete cascade,
  professor_email text not null,
  mensagem text not null check (length(btrim(mensagem)) >= 3),
  url_contexto text,
  created_at timestamptz not null default now()
);
create index feedback_professor_idx on public.feedback(professor_id);
create index feedback_created_idx on public.feedback(created_at desc);

alter table public.feedback enable row level security;

-- Qualquer professor autenticado pode INSERIR (mas não ler/editar/excluir)
create policy "feedback_insert_own"
  on public.feedback
  for insert
  to authenticated
  with check (
    professor_id = auth.uid()
    and professor_email = coalesce(auth.jwt() ->> 'email', '')
  );

-- Apenas o administrador (cesaraugustodeandferreira@gmail.com) pode SELECT
create policy "feedback_select_admin"
  on public.feedback
  for select
  to authenticated
  using (auth.jwt() ->> 'email' = 'cesaraugustodeandferreira@gmail.com');
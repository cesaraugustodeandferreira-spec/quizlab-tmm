-- QuizLab · 0004 · Catálogo inicial de disciplinas

insert into public.subjects (name) values
  ('Matemática'),
  ('Física'),
  ('Química'),
  ('Biologia'),
  ('História'),
  ('Geografia'),
  ('Português'),
  ('Literatura'),
  ('Inglês'),
  ('Filosofia'),
  ('Sociologia'),
  ('Artes'),
  ('Educação Física'),
  ('Redação')
on conflict (name) do nothing;

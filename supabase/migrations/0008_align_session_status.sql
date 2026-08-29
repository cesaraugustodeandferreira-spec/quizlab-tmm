-- QuizLab · 0008 · Align live schema with app/RPC/RLS status & difficulty values
--
-- The running database had drifted from the migrations: quiz_sessions.status used
-- 'lobby'/'active'/'finished' and questions.difficulty used 'easy'/'medium'/'hard',
-- while the application code, the SQL RPCs (0003_functions.sql) and the RLS policies
-- (0002_rls.sql) all expect 'aguardando'/'em_andamento'/'encerrada' and
-- 'facil'/'media'/'dificil'. That mismatch broke the lobby (status never matched
-- "aguardando") and would reject question inserts on difficulty.
--
-- Order matters: drop the old check constraints BEFORE remapping the data, then add
-- the new constraints.

-- 1) drop old checks
ALTER TABLE public.quiz_sessions DROP CONSTRAINT IF EXISTS quiz_sessions_status_check;
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_difficulty_check;

-- 2) remap existing data
UPDATE public.quiz_sessions SET status = 'aguardando' WHERE status = 'lobby';
UPDATE public.quiz_sessions SET status = 'em_andamento' WHERE status = 'active';
UPDATE public.quiz_sessions SET status = 'encerrada' WHERE status = 'finished';

UPDATE public.questions SET difficulty = 'facil' WHERE difficulty = 'easy';
UPDATE public.questions SET difficulty = 'media' WHERE difficulty = 'medium';
UPDATE public.questions SET difficulty = 'dificil' WHERE difficulty = 'hard';

-- 3) fix default + add new checks
ALTER TABLE public.quiz_sessions ALTER COLUMN status SET DEFAULT 'aguardando';
ALTER TABLE public.quiz_sessions
  ADD CONSTRAINT quiz_sessions_status_check
  CHECK (status = ANY (ARRAY['aguardando'::text, 'em_andamento'::text, 'encerrada'::text]));

ALTER TABLE public.questions
  ADD CONSTRAINT questions_difficulty_check
  CHECK (difficulty = ANY (ARRAY['facil'::text, 'media'::text, 'dificil'::text]));

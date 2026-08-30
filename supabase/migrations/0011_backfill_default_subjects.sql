-- QuizLab · 0011 · Backfill default subjects for existing professors
--
-- One-time script: adds missing default subjects to all existing professor
-- accounts that were created before migration 0010.
-- Safe to run multiple times (uses ON CONFLICT DO NOTHING).

DO $$
DECLARE
  v_professor record;
  v_inserted integer := 0;
  v_professors_updated integer := 0;
BEGIN
  FOR v_professor IN
    SELECT p.id FROM public.profiles p WHERE p.role = 'professor'
  LOOP
    INSERT INTO public.subjects (teacher_id, name) VALUES
      (v_professor.id, 'Língua Portuguesa'),
      (v_professor.id, 'Matemática'),
      (v_professor.id, 'Ciências'),
      (v_professor.id, 'Biologia'),
      (v_professor.id, 'Física'),
      (v_professor.id, 'Química'),
      (v_professor.id, 'História'),
      (v_professor.id, 'Geografia'),
      (v_professor.id, 'Arte'),
      (v_professor.id, 'Educação Física'),
      (v_professor.id, 'Língua Inglesa')
    ON CONFLICT (teacher_id, name) DO NOTHING;

    -- Count how many were actually inserted for this professor
    IF FOUND THEN
      v_professors_updated := v_professors_updated + 1;
    END IF;
  END LOOP;

  -- Get total count of default subjects that now exist
  SELECT count(*) INTO v_inserted
  FROM public.subjects
  WHERE name IN (
    'Língua Portuguesa', 'Matemática', 'Ciências', 'Biologia',
    'Física', 'Química', 'História', 'Geografia', 'Arte',
    'Educação Física', 'Língua Inglesa'
  );

  RAISE NOTICE 'Backfill complete: % professor accounts processed, % total default subjects now exist', v_professors_updated, v_inserted;
END $$;

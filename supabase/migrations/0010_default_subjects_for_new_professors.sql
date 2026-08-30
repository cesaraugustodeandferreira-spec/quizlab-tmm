-- QuizLab · 0010 · Default subjects for new professor accounts
--
-- Creates a function that inserts 11 default subjects for a newly created
-- professor. Called automatically by the on_auth_user_created trigger.
-- Uses ON CONFLICT DO NOTHING to safely handle edge cases.

-- 1. Create the function that inserts default subjects
CREATE OR REPLACE FUNCTION public.create_default_subjects_for_teacher(p_teacher_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.subjects (teacher_id, name) VALUES
    (p_teacher_id, 'Língua Portuguesa'),
    (p_teacher_id, 'Matemática'),
    (p_teacher_id, 'Ciências'),
    (p_teacher_id, 'Biologia'),
    (p_teacher_id, 'Física'),
    (p_teacher_id, 'Química'),
    (p_teacher_id, 'História'),
    (p_teacher_id, 'Geografia'),
    (p_teacher_id, 'Arte'),
    (p_teacher_id, 'Educação Física'),
    (p_teacher_id, 'Língua Inglesa')
  ON CONFLICT (teacher_id, name) DO NOTHING;
END $$;

-- 2. Update the trigger to also create default subjects for professors
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text := coalesce((new.raw_user_meta_data->>'role')::text, 'professor');
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, full_name, email, school, role)
  VALUES (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'), ''), 'Professor'),
    new.email,
    nullif(btrim(new.raw_user_meta_data->>'school'), ''),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'professor')
  );

  -- Create default subjects for professors
  IF v_role = 'professor' THEN
    PERFORM public.create_default_subjects_for_teacher(new.id);
  END IF;

  RETURN new;
END $$;

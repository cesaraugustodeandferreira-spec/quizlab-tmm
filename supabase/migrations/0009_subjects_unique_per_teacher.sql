-- QuizLab · 0009 · Subjects unique constraint: global → per-teacher
--
-- PROBLEM: subjects.name had a GLOBAL unique constraint, preventing different
-- teachers from owning subjects with the same name (e.g., both Professor A and
-- Professor B should be able to have their own "Matemática").
--
-- FIX: Drop all global unique constraints on name, add a composite unique on
-- (teacher_id, name). This allows different teachers to have identically-named
-- subjects while preventing the same teacher from creating duplicate subjects.
--
-- SAFETY: Verified no duplicate subject names exist across teachers before applying.
-- TESTED: Same-teacher duplicate → rejected. Cross-teacher same name → allowed.

-- 1. Drop ALL existing unique constraints on subjects.name
--    (names vary across environments: subjects_name_key, subjects_name_unique, etc.)
ALTER TABLE public.subjects DROP CONSTRAINT IF EXISTS subjects_name_key;
ALTER TABLE public.subjects DROP CONSTRAINT IF EXISTS subjects_name_unique;
ALTER TABLE public.subjects DROP CONSTRAINT IF EXISTS subjects_teacher_id_name_key;

-- 2. Add composite unique constraint: one subject name per teacher
--    Note: PostgreSQL treats NULL as distinct for UNIQUE constraints, so multiple
--    rows with teacher_id=NULL and the same name are allowed. This is correct for
--    the global seed catalogue (all have teacher_id=NULL, all unique by name anyway).
ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_teacher_id_name_unique
  UNIQUE (teacher_id, name);

-- 3. Topics: NO CHANGE needed.
--    Current constraint unique(subject_id, name) is already per-subject.
--    Topics inherit teacher isolation through FK to subjects.
--    Same topic name can exist under different subjects (desired behavior).

-- Migration 0012: Enable RLS on _test_cache (was publicly accessible)
-- _test_cache is an unused test table (0 rows, not referenced by app code)
-- enabling RLS + permissive policy for authenticated users only

ALTER TABLE public._test_cache ENABLE ROW LEVEL SECURITY;

-- Restrict access to authenticated users only (app never uses this table)
CREATE POLICY "_test_cache_authenticated_all"
  ON public._test_cache
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

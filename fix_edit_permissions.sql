-- ============================================================
-- Fix: Allow anyone to edit imported entries (created_by_email IS NULL)
-- New entries remain locked to the person who registered them
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Update the UPDATE policy
DROP POLICY IF EXISTS "Own rows update" ON public.inquiries;

CREATE POLICY "Own rows update" ON public.inquiries
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND (
      auth.jwt() ->> 'email' = created_by_email  -- own entries
      OR created_by_email IS NULL                 -- imported entries (anyone can edit)
    )
  );

-- Update the DELETE policy
DROP POLICY IF EXISTS "Own rows delete" ON public.inquiries;

CREATE POLICY "Own rows delete" ON public.inquiries
  FOR DELETE USING (
    auth.role() = 'authenticated' AND (
      auth.jwt() ->> 'email' = created_by_email  -- own entries
      OR created_by_email IS NULL                 -- imported entries (anyone can delete)
    )
  );

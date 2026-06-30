-- ============================================================
-- Migration v2: New fields + row ownership
-- Run in: Supabase Dashboard → SQL Editor
-- Run AFTER migration_add_cps.sql if you already ran that
-- ============================================================

-- 1. Rename city → site_location
ALTER TABLE public.inquiries RENAME COLUMN city TO site_location;

-- 2. Add new columns
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS project_value         NUMERIC;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS region                TEXT;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS meeting_with_client   TEXT;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS legacy_new            TEXT;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS products_offered      TEXT;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS project_details_received BOOLEAN DEFAULT FALSE;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS project_details_date  DATE;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS source                TEXT;

-- 3. Row ownership — split the single policy into SELECT / INSERT / UPDATE / DELETE
DROP POLICY IF EXISTS "Authenticated users only" ON public.inquiries;

CREATE POLICY "All can view inquiries" ON public.inquiries
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "All can insert inquiries" ON public.inquiries
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Own rows update" ON public.inquiries
  FOR UPDATE USING (auth.jwt() ->> 'email' = created_by_email);

CREATE POLICY "Own rows delete" ON public.inquiries
  FOR DELETE USING (auth.jwt() ->> 'email' = created_by_email);

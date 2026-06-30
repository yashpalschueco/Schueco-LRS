-- ============================================================
-- COMPLETE MIGRATION — Run this ONCE in Supabase SQL Editor
-- Covers all changes: CPS field + new columns + row ownership
-- Safe: uses IF NOT EXISTS throughout
-- ============================================================

-- 1. Add CPS notes column
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS cps_notes TEXT;

-- 2. Rename city → site_location (only if city column still exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inquiries' AND column_name = 'city'
  ) THEN
    ALTER TABLE public.inquiries RENAME COLUMN city TO site_location;
  END IF;
END $$;

-- 3. Add site_location if it doesn't exist yet (covers edge cases)
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS site_location TEXT;

-- 4. Add all new columns
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS project_value              NUMERIC;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS region                     TEXT;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS meeting_with_client        TEXT;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS legacy_new                 TEXT;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS products_offered           TEXT;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS project_details_received   BOOLEAN DEFAULT FALSE;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS project_details_date       DATE;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS source                     TEXT;

-- 5. Row Level Security — split into per-operation policies
--    Drop old single policy first, then create new ones
DROP POLICY IF EXISTS "Authenticated users only"   ON public.inquiries;
DROP POLICY IF EXISTS "All can view inquiries"     ON public.inquiries;
DROP POLICY IF EXISTS "All can insert inquiries"   ON public.inquiries;
DROP POLICY IF EXISTS "Own rows update"            ON public.inquiries;
DROP POLICY IF EXISTS "Own rows delete"            ON public.inquiries;

CREATE POLICY "All can view inquiries" ON public.inquiries
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "All can insert inquiries" ON public.inquiries
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Own rows update" ON public.inquiries
  FOR UPDATE USING (auth.jwt() ->> 'email' = created_by_email);

CREATE POLICY "Own rows delete" ON public.inquiries
  FOR DELETE USING (auth.jwt() ->> 'email' = created_by_email);

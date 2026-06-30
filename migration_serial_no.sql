-- ============================================================
-- Add serial_no field and assign numbers to existing entries
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Add the column
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS serial_no INTEGER;

-- 2. Assign serial numbers to all existing entries (oldest = 1, newest = highest)
WITH numbered AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM public.inquiries
  WHERE serial_no IS NULL
)
UPDATE public.inquiries
SET serial_no = numbered.rn
FROM numbered
WHERE public.inquiries.id = numbered.id;

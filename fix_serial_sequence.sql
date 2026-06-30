-- ============================================================
-- Fix: Make serial_no a real auto-incrementing sequence
-- This removes the race-condition risk of computing "max+1" in
-- JavaScript, which can produce duplicate/out-of-order numbers
-- if two people save at the same moment.
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Step 1: Re-sequence all existing rows cleanly (1, 2, 3... in their
-- correct chronological order) — fixes any nulls or gaps from before
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY serial_no ASC NULLS LAST, created_at ASC, id ASC) AS rn
  FROM public.inquiries
)
UPDATE public.inquiries
SET serial_no = numbered.rn
FROM numbered
WHERE public.inquiries.id = numbered.id;

-- Step 2: Create a sequence starting right after the current max
DO $$
DECLARE
  max_serial INTEGER;
BEGIN
  SELECT COALESCE(MAX(serial_no), 0) INTO max_serial FROM public.inquiries;
  EXECUTE format('DROP SEQUENCE IF EXISTS inquiries_serial_seq');
  EXECUTE format('CREATE SEQUENCE inquiries_serial_seq START WITH %s', max_serial + 1);
END $$;

-- Step 3: Make the column auto-fill from the sequence going forward
ALTER TABLE public.inquiries ALTER COLUMN serial_no SET DEFAULT nextval('inquiries_serial_seq');

-- Step 4: Make sure the sequence stays in sync with the table going forward
ALTER SEQUENCE inquiries_serial_seq OWNED BY public.inquiries.serial_no;

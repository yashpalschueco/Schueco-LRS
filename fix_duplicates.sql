-- ============================================================
-- Fix: Remove duplicate architects, fabricators, and team members
-- Then add unique constraints to prevent it happening again
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Step 1: Remove duplicate architects (keeps the first one added)
DELETE FROM public.architects
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY lower(trim(name)) ORDER BY created_at) AS rn
    FROM public.architects
  ) ranked
  WHERE rn > 1
);

-- Step 2: Remove duplicate fabricators
DELETE FROM public.fabricators
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY lower(trim(name)) ORDER BY created_at) AS rn
    FROM public.fabricators
  ) ranked
  WHERE rn > 1
);

-- Step 3: Remove duplicate schueco team members
DELETE FROM public.schueco_team
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY lower(trim(name)) ORDER BY created_at) AS rn
    FROM public.schueco_team
  ) ranked
  WHERE rn > 1
);

-- Step 4: Add case-insensitive unique index so this never happens again
-- (Drops first if already exists, safe to re-run)
DROP INDEX IF EXISTS architects_name_unique;
DROP INDEX IF EXISTS fabricators_name_unique;
DROP INDEX IF EXISTS schueco_team_name_unique;

CREATE UNIQUE INDEX architects_name_unique   ON public.architects   (lower(trim(name)));
CREATE UNIQUE INDEX fabricators_name_unique  ON public.fabricators  (lower(trim(name)));
CREATE UNIQUE INDEX schueco_team_name_unique ON public.schueco_team (lower(trim(name)));

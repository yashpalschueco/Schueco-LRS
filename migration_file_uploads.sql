-- ============================================================
-- Migration: File uploads (up to 10 files per inquiry)
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Table to track uploaded files
CREATE TABLE IF NOT EXISTS public.inquiry_files (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id   TEXT REFERENCES public.inquiries(id) ON DELETE CASCADE,
  file_name    TEXT NOT NULL,
  file_path    TEXT NOT NULL,
  file_size    BIGINT,
  uploaded_by  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.inquiry_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated full access" ON public.inquiry_files;
CREATE POLICY "Authenticated full access" ON public.inquiry_files
  FOR ALL USING (auth.role() = 'authenticated');

-- 2. Storage bucket (private — accessed only via signed URLs from logged-in users)
INSERT INTO storage.buckets (id, name, public)
VALUES ('inquiry-files', 'inquiry-files', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage access policies
DROP POLICY IF EXISTS "Authenticated can upload inquiry files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view inquiry files"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete inquiry files" ON storage.objects;

CREATE POLICY "Authenticated can upload inquiry files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'inquiry-files');

CREATE POLICY "Authenticated can view inquiry files" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'inquiry-files');

CREATE POLICY "Authenticated can delete inquiry files" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'inquiry-files');

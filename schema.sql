-- ============================================================
-- Schueco Black LRS — Supabase Database Schema
-- Run this entire file in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Tables

CREATE TABLE public.architects (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.fabricators (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.schueco_team (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.inquiries (
  id                TEXT        PRIMARY KEY,
  client_name       TEXT        NOT NULL,
  project_name      TEXT        NOT NULL,
  city              TEXT,
  notes             TEXT,
  schueco_person_id UUID        REFERENCES public.schueco_team(id) ON DELETE SET NULL,
  fabricator_id     UUID        REFERENCES public.fabricators(id)  ON DELETE SET NULL,
  architect_id      UUID        REFERENCES public.architects(id)   ON DELETE SET NULL,
  status            TEXT        NOT NULL DEFAULT 'New'
                                CHECK (status IN ('New', 'Quoted', 'Won', 'Lost')),
  created_by_email  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes for performance

CREATE INDEX ON public.inquiries(status);
CREATE INDEX ON public.inquiries(created_at DESC);
CREATE INDEX ON public.inquiries(lower(client_name), lower(project_name));

-- 3. Row Level Security — only logged-in users can access data

ALTER TABLE public.architects   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabricators  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schueco_team ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users only" ON public.architects
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users only" ON public.fabricators
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users only" ON public.schueco_team
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users only" ON public.inquiries
  FOR ALL USING (auth.role() = 'authenticated');

-- 4. Enable Real-time so all users see changes instantly

ALTER PUBLICATION supabase_realtime ADD TABLE public.inquiries;

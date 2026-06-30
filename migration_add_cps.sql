-- ============================================================
-- Migration: Add CPS notes column to inquiries
-- Run this in: Supabase Dashboard → SQL Editor
-- Only needed if you already ran schema.sql before
-- ============================================================

ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS cps_notes TEXT;

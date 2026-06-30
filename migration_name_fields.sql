-- ============================================================
-- Migration: Add resolved name fields for Power Automate
-- These store the actual names alongside the IDs
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS architect_name   TEXT;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS fabricator_name  TEXT;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS responsible_name TEXT;

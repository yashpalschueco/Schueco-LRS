-- ============================================================
-- New entry: Dhanraj Parimal Nathwani (s.no 182)
-- Run in: Supabase Dashboard → SQL Editor
-- Only run this if you have already run seed_existing_inquiries.sql
-- ============================================================

INSERT INTO public.inquiries
  (id, client_name, project_name, site_location, region, cps_notes,
   meeting_with_client, legacy_new, project_details_received,
   schueco_person_id, architect_id,
   status, created_at)
VALUES (
  'LG-182',
  'Dhanraj Parimal Nathwani',
  'Imported from SB Tracker',
  'Delhi',
  'North',
  '2615745',
  'No',
  'New',
  true,
  (SELECT id FROM public.schueco_team WHERE name = 'Prateek' LIMIT 1),
  (SELECT id FROM public.architects WHERE name = 'Aparna Kaushik' LIMIT 1),
  'New',
  '2026-06-20'
);

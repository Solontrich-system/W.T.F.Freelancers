// ── Supabase client (shared singleton) ───────────────────
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const db = createClient(
  'https://bzqetkzxksmwkibbelnc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6cWV0a3p4a3Ntd2tpYmJlbG5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NTUyODcsImV4cCI6MjA5MzQzMTI4N30.Adu_SIxxDuYsZcWgcyxpADGu7k5E9pZOVBgVKGTnmug'
);

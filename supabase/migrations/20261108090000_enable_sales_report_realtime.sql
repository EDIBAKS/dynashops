-- Receipt transactions commit header and detail changes together. Publish
-- headers so open daily reports can refresh after those transactions.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'The supabase_realtime publication is required for live sales reports';
  end if;

  if not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'salesheader'
     ) then
    alter publication supabase_realtime add table public.salesheader;
  end if;
end
$$;

-- supabase/069_endomarketing_storage.sql
-- Bucket público para imagens geradas por IA do Endomarketing

insert into storage.buckets (id, name, public)
values ('endomarketing', 'endomarketing', true)
on conflict (id) do nothing;

-- RLS: leitura pública, escrita apenas autenticados
create policy "endomarketing_public_read"
  on storage.objects for select
  using (bucket_id = 'endomarketing');

create policy "endomarketing_auth_insert"
  on storage.objects for insert
  with check (bucket_id = 'endomarketing' and auth.role() = 'authenticated');

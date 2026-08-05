-- 230 — Bucket dedicado para extratos bancarios da Tesouraria
--
-- O useImportExtrato ja tentava 'tesouraria-extratos' primeiro, mas o bucket nunca
-- foi criado: todo upload caia no fallback (notas-fiscais, publico). Cria o bucket
-- privado e libera leitura/escrita para quem tem o modulo financeiro.

insert into storage.buckets (id, name, public)
values ('tesouraria-extratos', 'tesouraria-extratos', false)
on conflict (id) do nothing;

drop policy if exists "tesouraria_extratos_insert" on storage.objects;
create policy "tesouraria_extratos_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'tesouraria-extratos'
    and can_access_modulo('financeiro', auth.uid())
  );

drop policy if exists "tesouraria_extratos_select" on storage.objects;
create policy "tesouraria_extratos_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'tesouraria-extratos'
    and can_access_modulo('financeiro', auth.uid())
  );

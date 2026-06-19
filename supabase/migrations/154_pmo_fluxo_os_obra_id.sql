-- 154_pmo_fluxo_os_obra_id.sql
-- OSCs por obra: adiciona obra_id em pmo_fluxo_os (uma obra pode ter várias OSCs).
-- Usado na aba "Obras/OS Iniciadas" do EGP (Iniciação): obra -> OSCs colapsável.

alter table public.pmo_fluxo_os
  add column if not exists obra_id uuid references public.sys_obras(id);

create index if not exists idx_fluxo_os_obra on public.pmo_fluxo_os (obra_id);

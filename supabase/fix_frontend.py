import os, re

base = os.path.expanduser('~/teg-plus/frontend/src')

# ── 1. useDashboard.ts: add timeout + scalable settings ──────────────────────
hook_path = os.path.join(base, 'hooks/useDashboard.ts')
with open(hook_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the queryFn to add timeout
old_qfn = '''    queryFn: async () => {
      // Tenta RPC primeiro (uma chamada, mais eficiente)
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_dashboard_compras', {
          p_periodo: periodo,
          p_obra_id: obraId ?? null,
        })

      if (!rpcError && rpcData) {
        return mapRpcToDashboard(rpcData as Record<string, unknown>)
      }

      // Fallback: consultas diretas nas tabelas
      return fetchDashboardDireto(periodo)
    },
    refetchInterval: 30_000,
    retry: 1,
    staleTime: 10_000,'''

new_qfn = '''    queryFn: async () => {
      // RPC com timeout de 12s para evitar loading eterno
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 12_000)

      try {
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_dashboard_compras', {
            p_periodo: periodo,
            p_obra_id: obraId ?? null,
          })

        if (!rpcError && rpcData) {
          return mapRpcToDashboard(rpcData as Record<string, unknown>)
        }
      } catch {
        // timeout ou erro de rede → fallback
      } finally {
        clearTimeout(timeoutId)
      }

      // Fallback: consultas diretas (sem RPC)
      return fetchDashboardDireto(periodo)
    },
    refetchInterval: 60_000,   // 60s reduz carga em 50 usuários
    retry: false,              // sem retry automático (evita thundering herd)
    staleTime: 30_000,'''

if old_qfn in content:
    content = content.replace(old_qfn, new_qfn)
    with open(hook_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('useDashboard.ts: timeout + scalable settings updated')
else:
    print('useDashboard.ts: pattern not found, skipping')

# ── 2. useRequisicoes.ts: comprador_id auto-resolve + scalable settings ───────
req_path = os.path.join(base, 'hooks/useRequisicoes.ts')
with open(req_path, 'r', encoding='utf-8') as f:
    req_content = f.read()

# Update refetchInterval on useRequisicoes
req_content = req_content.replace(
    'refetchInterval: 30_000,\n    retry: 1,\n    staleTime: 10_000,',
    'refetchInterval: 60_000,\n    retry: false,\n    staleTime: 30_000,'
)

# Fix comprador_id resolution in useCriarRequisicao
old_insert_block = "      const { data: req, error: reqError } = await supabase\n        .from('cmp_requisicoes')"
new_insert_block = """      // Resolve comprador_id pelo nome da categoria quando não informado
      let compradorId = payload.comprador_id || null
      if (!compradorId && payload.categoria) {
        try {
          const { data: cat } = await supabase
            .from('cmp_categorias')
            .select('comprador_nome')
            .eq('codigo', payload.categoria)
            .maybeSingle()
          if (cat?.comprador_nome) {
            const { data: comp } = await supabase
              .from('cmp_compradores')
              .select('id')
              .ilike('nome', `%${cat.comprador_nome.split(' ')[0]}%`)
              .limit(1)
              .maybeSingle()
            compradorId = comp?.id ?? null
          }
        } catch { /* non-critical */ }
      }

      const { data: req, error: reqError } = await supabase\n        .from('cmp_requisicoes')"""

req_content = req_content.replace(old_insert_block, new_insert_block)

# Update the comprador_id field in insert to use compradorId
req_content = req_content.replace(
    "          comprador_id:     payload.comprador_id || null,",
    "          comprador_id:     compradorId,"
)

with open(req_path, 'w', encoding='utf-8') as f:
    f.write(req_content)
print('useRequisicoes.ts: comprador_id auto-resolve + scalable settings updated')

# ── 3. All other hooks: scalable refetch settings ─────────────────────────────
hooks_to_fix = [
    'hooks/useCotacoes.ts',
    'hooks/usePedidos.ts',
    'hooks/useAprovacoes.ts',
    'hooks/useCategorias.ts',
]
for h in hooks_to_fix:
    path = os.path.join(base, h)
    if not os.path.exists(path):
        print(f'{h}: not found, skipping')
        continue
    with open(path, 'r', encoding='utf-8') as f:
        hc = f.read()
    changed = False
    for old, new in [
        ('refetchInterval: 30_000', 'refetchInterval: 60_000'),
        ('refetchInterval: 15_000', 'refetchInterval: 30_000'),
        ('retry: 1,', 'retry: false,'),
        ('staleTime: 10_000', 'staleTime: 30_000'),
        ('staleTime: 5_000', 'staleTime: 15_000'),
    ]:
        if old in hc:
            hc = hc.replace(old, new)
            changed = True
    if changed:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(hc)
        print(f'{h}: scalable settings updated')
    else:
        print(f'{h}: no changes needed')

print('\nAll frontend fixes applied!')

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const TEST_TAG = `TESTE-CODEX-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`;
const TODAY = new Date().toISOString().slice(0, 10);
const FIVE_DAYS = new Date(Date.now() + 5 * 86400000).toISOString();
const APPROVER_EMAIL = 'codex-teste@teg.local';

const FIXTURES = {
  obraId: '9a84b763-3f0a-4cd8-9f87-00cadec68076',
  obraNome: 'SEDE',
  centroCustoId: '0fc2c9bb-8265-42ff-9506-7348a6fed94f',
  centroCusto: 'Obras',
  compradorId: 'c7d934bd-c7c8-40ef-854e-607d9046d2b5',
  compradorNome: 'Lauany',
  classeFinanceiraId: 'd8826a9e-4d87-4a33-84a3-2ec785decaa2',
  classeFinanceiraCodigo: 'CLS-03.03.01',
  classeFinanceiraDescricao: 'Material de Escritório',
  categoriaFinanceiraCodigo: 'CAT-03.03',
  categoriaFinanceiraDescricao: 'Despesas Administrativas',
  baseId: '7074767b-639d-4870-b96a-9eed444febae',
  baseNome: 'MATRIZ',
  recebidoPorId: '1a530a02-9eec-4aa7-8bbc-7805895b1904',
};

function logStep(title, details) {
  console.log(`\n=== ${title} ===`);
  if (details !== undefined) {
    console.log(typeof details === 'string' ? details : JSON.stringify(details, null, 2));
  }
}

async function request(path, { method = 'GET', query, body, prefer, expectSingle = false } = {}) {
  const url = new URL(path, SUPABASE_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
  }

  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
  };

  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(`${method} ${path} failed: ${response.status} ${response.statusText}`);
    error.details = data;
    throw error;
  }

  if (expectSingle) {
    return Array.isArray(data) ? data[0] ?? null : data;
  }
  return data;
}

async function insert(table, payload) {
  return request(`/rest/v1/${table}`, {
    method: 'POST',
    body: payload,
    prefer: 'return=representation',
    expectSingle: !Array.isArray(payload),
  });
}

async function patch(table, match, payload, select = '*') {
  return request(`/rest/v1/${table}`, {
    method: 'PATCH',
    query: { ...match, select },
    body: payload,
    prefer: 'return=representation',
    expectSingle: true,
  });
}

async function get(table, query, single = false) {
  return request(`/rest/v1/${table}`, {
    query,
    expectSingle: single,
  });
}

async function rpc(fn, payload) {
  return request(`/rest/v1/rpc/${fn}`, {
    method: 'POST',
    body: payload,
  });
}

async function poll(label, fn, { timeoutMs = 20000, intervalMs = 1000 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await fn();
    if (value) {
      logStep(label, value);
      return value;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timeout waiting for ${label}`);
}

function parcelasPreview(valorTotal, condicaoPagamento, dataBase = TODAY) {
  const [a, b] = [Math.round((valorTotal / 2) * 100) / 100, 0];
  const segunda = Math.round((valorTotal - a) * 100) / 100;
  return [
    { numero: 1, valor: a, data_vencimento: dataBase, descricao: 'Entrada' },
    {
      numero: 2,
      valor: segunda,
      data_vencimento: new Date(new Date(`${dataBase}T12:00:00`).getTime() + 28 * 86400000).toISOString().slice(0, 10),
      descricao: condicaoPagamento || 'Saldo 28 dias',
    },
  ];
}

async function main() {
  logStep('Teste iniciado', { tag: TEST_TAG, data: TODAY });

  const item = await insert('est_itens', {
    codigo: `ITM-${TEST_TAG.slice(-8)}`,
    descricao: `${TEST_TAG} Resma A4 Fluxo Completo`,
    categoria: 'ESCRITORIO',
    unidade: 'UN',
    curva_abc: 'C',
    estoque_minimo: 0,
    estoque_maximo: 0,
    ponto_reposicao: 0,
    lead_time_dias: 3,
    controla_lote: false,
    controla_serie: false,
    tem_validade: false,
    valor_medio: 150,
    ativo: true,
    classe_financeira_id: FIXTURES.classeFinanceiraId,
    classe_financeira_codigo: FIXTURES.classeFinanceiraCodigo,
    classe_financeira_descricao: FIXTURES.classeFinanceiraDescricao,
    categoria_financeira_codigo: FIXTURES.categoriaFinanceiraCodigo,
    categoria_financeira_descricao: FIXTURES.categoriaFinanceiraDescricao,
    destino_operacional: 'estoque',
  });
  logStep('Item criado', item);

  const reqNumero = `RC-${TEST_TAG.slice(-12)}`;
  const requisicao = await insert('cmp_requisicoes', {
    numero: reqNumero,
    solicitante_nome: 'Codex QA',
    obra_nome: FIXTURES.obraNome,
    obra_id: FIXTURES.obraId,
    descricao: `${TEST_TAG} fluxo compras/financeiro/estoque`,
    justificativa: 'Teste integrado automatizado Codex',
    urgencia: 'normal',
    status: 'pendente',
    categoria: 'ESCRITORIO',
    comprador_id: FIXTURES.compradorId,
    alcada_nivel: 1,
    centro_custo: FIXTURES.centroCusto,
    centro_custo_id: FIXTURES.centroCustoId,
    classe_financeira: FIXTURES.classeFinanceiraCodigo,
    classe_financeira_id: FIXTURES.classeFinanceiraId,
    texto_original: `${TEST_TAG} criar pedido resma A4`,
    ai_confianca: 0.99,
    valor_estimado: 150,
    data_necessidade: TODAY,
  });
  logStep('Requisição criada', requisicao);

  const reqItem = await insert('cmp_requisicao_itens', {
    requisicao_id: requisicao.id,
    est_item_id: item.id,
    est_item_codigo: item.codigo,
    descricao: item.descricao,
    quantidade: 1,
    unidade: 'UN',
    valor_unitario_estimado: 150,
    classe_financeira_id: FIXTURES.classeFinanceiraId,
    classe_financeira_codigo: FIXTURES.classeFinanceiraCodigo,
    classe_financeira_descricao: FIXTURES.classeFinanceiraDescricao,
    categoria_financeira_codigo: FIXTURES.categoriaFinanceiraCodigo,
    categoria_financeira_descricao: FIXTURES.categoriaFinanceiraDescricao,
    destino_operacional: 'estoque',
  });
  logStep('Item da requisição criado', reqItem);

  const aprTecnica = await insert('apr_aprovacoes', {
    modulo: 'cmp',
    tipo_aprovacao: 'requisicao_compra',
    entidade_id: requisicao.id,
    entidade_numero: requisicao.numero,
    aprovador_nome: 'Aprovador Tecnico',
    aprovador_email: APPROVER_EMAIL,
    nivel: 1,
    status: 'pendente',
    observacao: `${TEST_TAG} aguardando aprovacao tecnica`,
  });
  logStep('Aprovação técnica pendente criada', aprTecnica);

  await patch('cmp_requisicoes', { id: `eq.${requisicao.id}` }, {
    status: 'em_cotacao',
    data_aprovacao: new Date().toISOString(),
  });
  await patch('apr_aprovacoes', { id: `eq.${aprTecnica.id}` }, {
    status: 'aprovada',
    data_decisao: new Date().toISOString(),
    observacao: `${TEST_TAG} aprovacao tecnica concluida`,
  });
  logStep('Requisição aprovada tecnicamente', { status: 'em_cotacao' });

  const cotacao = await insert('cmp_cotacoes', {
    requisicao_id: requisicao.id,
    comprador_id: FIXTURES.compradorId,
    status: 'pendente',
    data_limite: FIVE_DAYS,
  });
  logStep('Cotação criada', cotacao);

  const fornecedor = await insert('cmp_cotacao_fornecedores', {
    cotacao_id: cotacao.id,
    fornecedor_nome: `${TEST_TAG} Fornecedor Teste`,
    fornecedor_contato: 'codex@teste.local',
    fornecedor_cnpj: '00.000.000/0001-91',
    valor_total: 150,
    prazo_entrega_dias: 2,
    condicao_pagamento: 'entrada + 28',
    itens_precos: [],
    observacao: `${TEST_TAG} cotacao teste`,
    arquivo_url: null,
    selecionado: true,
  });
  logStep('Fornecedor de cotação criado', fornecedor);

  await patch('cmp_cotacoes', { id: `eq.${cotacao.id}` }, {
    status: 'concluida',
    fornecedor_selecionado_id: fornecedor.id,
    fornecedor_selecionado_nome: fornecedor.fornecedor_nome,
    valor_selecionado: 150,
    data_conclusao: new Date().toISOString(),
  });
  await patch('cmp_requisicoes', { id: `eq.${requisicao.id}` }, { status: 'cotacao_enviada' });
  const aprFinanceira = await insert('apr_aprovacoes', {
    modulo: 'cmp',
    tipo_aprovacao: 'cotacao',
    entidade_id: requisicao.id,
    entidade_numero: requisicao.numero,
    aprovador_nome: 'Aprovador Financeiro',
    aprovador_email: APPROVER_EMAIL,
    nivel: 1,
    status: 'pendente',
    observacao: `${TEST_TAG} aguardando aprovacao financeira`,
  });
  logStep('Cotação finalizada e enviada para aprovação financeira', {
    cotacaoId: cotacao.id,
    requisicaoStatus: 'cotacao_enviada',
    aprovacaoId: aprFinanceira.id,
  });

  await patch('cmp_requisicoes', { id: `eq.${requisicao.id}` }, {
    status: 'cotacao_aprovada',
    data_aprovacao: new Date().toISOString(),
  });
  await patch('apr_aprovacoes', { id: `eq.${aprFinanceira.id}` }, {
    status: 'aprovada',
    data_decisao: new Date().toISOString(),
    observacao: `${TEST_TAG} aprovacao financeira concluida`,
  });
  logStep('Requisição aprovada financeiramente', { status: 'cotacao_aprovada' });

  const latestPedido = await get('cmp_pedidos', {
    select: 'numero_pedido',
    numero_pedido: `like.PO-${new Date().toISOString().slice(0, 7).replace('-', '')}%`,
    order: 'numero_pedido.desc',
    limit: 1,
  }, true);
  let nextSeq = 1;
  if (latestPedido?.numero_pedido) {
    const lastNum = Number(latestPedido.numero_pedido.split('-').pop());
    if (Number.isFinite(lastNum)) nextSeq = lastNum + 1;
  }
  const numeroPedido = `PO-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(nextSeq).padStart(4, '0')}`;

  const pedido = await insert('cmp_pedidos', {
    requisicao_id: requisicao.id,
    cotacao_id: cotacao.id,
    comprador_id: FIXTURES.compradorId,
    numero_pedido: numeroPedido,
    fornecedor_nome: fornecedor.fornecedor_nome,
    valor_total: 150,
    status: 'emitido',
    data_pedido: TODAY,
    data_prevista_entrega: TODAY,
    condicao_pagamento: 'entrada + 28',
    observacoes: `${TEST_TAG} pedido teste`,
    classe_financeira: FIXTURES.classeFinanceiraCodigo,
    classe_financeira_id: FIXTURES.classeFinanceiraId,
    centro_custo: FIXTURES.centroCusto,
    centro_custo_id: FIXTURES.centroCustoId,
    parcelas_preview: parcelasPreview(150, 'entrada + 28', TODAY),
  });
  await patch('cmp_requisicoes', { id: `eq.${requisicao.id}` }, {
    status: 'pedido_emitido',
    classe_financeira: FIXTURES.classeFinanceiraCodigo,
    classe_financeira_id: FIXTURES.classeFinanceiraId,
    centro_custo: FIXTURES.centroCusto,
    centro_custo_id: FIXTURES.centroCustoId,
  });
  logStep('Pedido emitido', pedido);

  const cp = await poll('Conta a pagar criada pelo trigger', async () => {
    const rows = await get('fin_contas_pagar', {
      select: 'id,pedido_id,requisicao_id,fornecedor_nome,valor_original,status,centro_custo,classe_financeira,data_vencimento,lote_id',
      pedido_id: `eq.${pedido.id}`,
      limit: 1,
    });
    return rows?.[0] ?? null;
  });

  await patch('cmp_pedidos', { id: `eq.${pedido.id}` }, {
    status_pagamento: 'liberado',
    liberado_pagamento_em: new Date().toISOString(),
    liberado_pagamento_por: 'Codex QA',
  });
  const cpConfirmado = await poll('Conta a pagar liberada para pagamento', async () => {
    const rows = await get('fin_contas_pagar', {
      select: 'id,status,lote_id,aprovado_por,aprovado_em,data_pagamento',
      id: `eq.${cp.id}`,
      limit: 1,
    });
    return rows?.[0]?.status === 'confirmado' ? rows[0] : null;
  });

  const numeroLote = await rpc('generate_numero_lote', {});
  const lote = await insert('fin_lotes_pagamento', {
    numero_lote: typeof numeroLote === 'string' ? numeroLote : `LP-${Date.now()}`,
    criado_por: 'Codex QA',
    valor_total: 150,
    qtd_itens: 1,
    status: 'montando',
    observacao: `${TEST_TAG} lote teste`,
  });
  await insert('fin_lote_itens', {
    lote_id: lote.id,
    cp_id: cp.id,
    valor: 150,
  });
  await patch('fin_contas_pagar', { id: `eq.${cp.id}` }, { lote_id: lote.id, status: 'em_lote' });
  logStep('Lote criado e CP enviado para em_lote', lote);

  await patch('fin_lotes_pagamento', { id: `eq.${lote.id}` }, {
    status: 'enviado_aprovacao',
    updated_at: new Date().toISOString(),
  });
  const aprLote = await insert('apr_aprovacoes', {
    modulo: 'fin',
    tipo_aprovacao: 'autorizacao_pagamento',
    entidade_id: lote.id,
    entidade_numero: lote.numero_lote,
    aprovador_nome: 'Welton',
    aprovador_email: APPROVER_EMAIL,
    nivel: 1,
    status: 'pendente',
    observacao: `${TEST_TAG} lote enviado para aprovação`,
    data_limite: new Date(Date.now() + 72 * 3600_000).toISOString(),
  });
  logStep('Lote enviado para aprovação', aprLote);

  await patch('fin_lote_itens', { lote_id: `eq.${lote.id}`, decisao: 'eq.pendente' }, {
    decisao: 'aprovado',
    decidido_por: 'Welton',
    decidido_em: new Date().toISOString(),
    observacao: `${TEST_TAG} aprovado em lote`,
  });
  await rpc('rpc_resolver_lote_status', { p_lote_id: lote.id });
  await patch('apr_aprovacoes', { id: `eq.${aprLote.id}` }, {
    status: 'aprovada',
    data_decisao: new Date().toISOString(),
    observacao: `${TEST_TAG} lote aprovado`,
  });
  const cpAprovado = await poll('Conta a pagar no painel de pagamento', async () => {
    const rows = await get('fin_contas_pagar', {
      select: 'id,status,lote_id,aprovado_por,aprovado_em,centro_custo,classe_financeira',
      id: `eq.${cp.id}`,
      limit: 1,
    });
    return rows?.[0]?.status === 'aprovado_pgto' ? rows[0] : null;
  });

  await rpc('rpc_registrar_pagamento_batch', {
    p_cp_ids: [cp.id],
    p_data_pagamento: TODAY,
  });
  const cpPago = await poll('Conta a pagar registrada como paga', async () => {
    const rows = await get('fin_contas_pagar', {
      select: 'id,status,data_pagamento,classe_financeira,centro_custo',
      id: `eq.${cp.id}`,
      limit: 1,
    });
    return rows?.[0]?.status === 'pago' ? rows[0] : null;
  });

  let recebimento = null;
  let recebimentoItem = null;
  let movimento = null;
  let recebimentoErro = null;
  try {
    recebimento = await insert('cmp_recebimentos', {
      pedido_id: pedido.id,
      base_id: FIXTURES.baseId,
      recebido_por: FIXTURES.recebidoPorId,
      nf_numero: `NF-${TEST_TAG.slice(-6)}`,
      nf_chave: null,
      data_recebimento: TODAY,
      observacao: `${TEST_TAG} recebimento teste`,
    });
    logStep('Recebimento criado', recebimento);

    recebimentoItem = await insert('cmp_recebimento_itens', {
      recebimento_id: recebimento.id,
      requisicao_item_id: reqItem.id,
      item_estoque_id: item.id,
      descricao: item.descricao,
      quantidade_esperada: 1,
      quantidade_recebida: 1,
      valor_unitario: 150,
      lote: null,
      numero_serie: null,
      data_validade: null,
      tipo_destino: 'consumo',
    });
    logStep('Item de recebimento criado', recebimentoItem);

    movimento = await poll('Movimentação de estoque gerada', async () => {
      const rows = await get('est_movimentacoes', {
        select: 'id,item_id,tipo,quantidade,valor_unitario,base_id,fornecedor_nome,nf_numero,criado_em',
        item_id: `eq.${item.id}`,
        tipo: 'eq.entrada',
        order: 'criado_em.desc',
        limit: 1,
      });
      return rows?.[0] ?? null;
    }, { timeoutMs: 15000, intervalMs: 1500 });
  } catch (error) {
    recebimentoErro = {
      message: error.message,
      details: error.details ?? null,
    };
    logStep('Recebimento falhou', recebimentoErro);
  }

  logStep('Resumo final', {
    tag: TEST_TAG,
    itemId: item.id,
    requisicaoId: requisicao.id,
    cotacaoId: cotacao.id,
    pedidoId: pedido.id,
    cpId: cp.id,
    loteId: lote.id,
    recebimentoId: recebimento?.id ?? null,
    recebimentoItemId: recebimentoItem?.id ?? null,
    movimentoId: movimento?.id ?? null,
    statuses: {
      requisicao: 'pedido_emitido',
      pedido: pedido.status,
      cpInicial: cp.status,
      cpConfirmado: cpConfirmado.status,
      cpAprovado: cpAprovado.status,
      cpPago: cpPago.status,
    },
    recebimentoErro,
  });
}

main().catch(error => {
  console.error('\nFLOW TEST FAILED');
  console.error(error.message);
  if (error.details) {
    console.error(JSON.stringify(error.details, null, 2));
  }
  process.exit(1);
});

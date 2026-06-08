# Checklist de teste — branch `feat/compras-estoque-baixas`

> Rodar no **preview da Vercel**. ⚠️ **Antes de tudo:** confirmar que o preview aponta pro **homolog** (`VITE_SUPABASE_URL = vxxjfxhbsklwcbhfkbes`), senão bate na prod (vazia) e nada aparece.

## 0. Build
- [ ] Build da Vercel **passou** (verde no PR/dashboard).

## 1. Termo de aceite (Cautela) — *Estoque*
- [ ] Estoque → **Cautelas** → clicar num card/linha → **modal do Termo abre**.
- [ ] Dados corretos: nº cautela, solicitante, obra, datas, **itens (código/descrição/qtd/unidade)**.
- [ ] Assinar no **canvas** (mouse/touch) → limpar funciona.
- [ ] **Baixar** e **Imprimir/Abrir** o PDF → layout com logo/empresa + assinatura.

## 2. Lead Time (Compras)
- [ ] Menu Compras → **Lead Time** → abre `/compras/lead-time`.
- [ ] KPIs + tabela por categoria + barras de fase renderizam (sem erro).
- [ ] Esperado **pouco dado** (≈1 ciclo completo) — só validar que não quebra e mostra "—" onde não há amostra.

## 3. Linha do tempo no AprovAi — ⚠️ TELA CRÍTICA
- [ ] AprovAi com uma **aprovação de compra pendente** → card aparece normal.
- [ ] Botão **"Ver linha do tempo"** → expande stepper com **datas** nos marcos (criação, valid. técnica, cotação...).
- [ ] **REGRESSÃO:** Aprovar / Rejeitar / Solicitar esclarecimento **continuam funcionando** normalmente.
- [ ] Comparativo de fornecedores, histórico de esclarecimentos e edição de itens **intactos**.

## 4. Devolução de cautela (fix de status)
- [ ] Devolver itens de uma cautela → **não dá erro de banco** (antes violava o CHECK).
- [ ] Status vira **`encerrada`** (devolução total) ou **`em_devolucao`** (parcial).
- [ ] ⚠️ "Minhas Cautelas" **ainda fica vazia** — é o bug de vínculo colaborador↔login (task separada), **não é regressão**.

## 5. Painel de Estoque (Indicadores)
- [ ] Estoque → **Indicadores** → abre `/estoque/painel`.
- [ ] **Curva ABC** e **Top categorias** populam (catálogo tem ~2073 itens).
- [ ] Valor por base / Top itens ficam **pequenos** (poucos saldos) — ok.
- [ ] "Abaixo do ponto de reposição" mostra vazio/itens sem quebrar.

## 6. Export PDF de pagamentos previstos — *Financeiro*
- [ ] Financeiro → **Painel de Pagamentos** → botão **"Exportar PDF"**.
- [ ] PDF gerencial: resumo (total/vencidos/hoje) + tabela por faixa de vencimento + total geral.
- [ ] Fluxo de **registrar pagamento** (selecionar + confirmar) **intacto**.

---
**Se algum item falhar**, anotar a feature + o erro (console do navegador ajuda) pra correção rápida.

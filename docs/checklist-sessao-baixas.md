# Checklist — trabalho da branch `feat/compras-estoque-baixas`

Resumo de tudo que foi feito (06–07/06/2026). Branch com 11 commits, pushada, **aguardando build/preview da Vercel**.

## 🔧 Setup / ambiente
- [x] Sincronizar o repo no notebook secundário (`git pull`, `core.longpaths`, reset limpo — estava 844 commits atrás)
- [x] Montar verificação local sem toolchain do projeto (node do bundle Codex + `esbuild` standalone baixado do npm)

## 🛒 Compras
- [x] **Painel de Lead Time** por categoria e por fase do pipeline (`/compras/lead-time`)
- [x] **Linha do tempo datada** no AprovAi (marcos por etapa, aditivo ao card)
- [ ] *Adiado:* Painel de Savings (dado escasso + split quebra cálculo simples — fazer item a item depois)

## 📦 Estoque
- [x] **Termo de aceite** em PDF na cautela (assinatura no canvas/tablet)
- [x] **Painel detalhado** (menu Indicadores): ABC, categorias, valor por base, abaixo do mínimo
- [x] **Fix status da cautela** — `useDevolverItens` violava o CHECK (devolução quebrada)
- [x] **Fix vínculo "Minhas Cautelas"** — usava `perfil.id` em vez de `perfil.colaborador_id`
- [x] **Remoção de código morto** (`CautelaCard.tsx`, vocabulário antigo)
- [ ] *Backlog:* disparo automático de OC (pesado)

## 💰 Financeiro / Tesouraria
- [x] **Export PDF gerencial** de pagamentos previstos (por faixa de vencimento)
- [x] **Desmembrar fatura de cartão** — ratear 1 lançamento em N apontamentos
- [ ] *Backlog:* notificações para portadores (e-mail/infra), conciliação automática/remessa

## 📑 Contratos
- [x] **Validação de fluxo** (solicitação → minuta → aprovação → assinatura) — **nenhum bug**; vocabulários e integração com AprovAi conferidos
- [ ] *Build:* envio de medição → financeiro (depende de dado de medição)

## 🏠 Locação
- [x] **Fix ciclo do imóvel** — entrada `liberado`→imóvel `ativo`; saída `encerrado`→`inativo` (antes não sincronizava)
- [x] **Concluir aditivos/renovações** — avançar status + aplicar efeito ao assinar (renovação→data fim do contrato; reajuste→valor)
- [ ] *Backlog:* faturas → financeiro; OS/manutenções (não tem tabela — criar do zero)

## 🧾 NF (Contas a Receber) — pesquisa/decisão
- [x] Estudo de integração de emissão de NF (NFS-e Nacional + NF-e, MG+MS, NF-e de transferência)
- [x] Recomendação **Focus NFe** (Nuvem Fiscal descartada — desativa 31/07/2026) + PDF para o time
- [ ] **Decisão do time** sobre provedor (pendente)

## ✅ Verificação
- [x] `esbuild` local (sintaxe + JSX + resolução de imports) em todos os arquivos alterados
- [x] Camada de dados validada por SQL contra o **homolog**
- [ ] **Build da Vercel** (PENDENTE — no note principal)
- [ ] **Teste em runtime** no preview, apontando pro homolog (PENDENTE)

## 🚀 Próximos passos
- [ ] Abrir PR → build da Vercel verde
- [ ] Validar no preview (checklist em `docs/teste-feat-baixas.md`), atenção a AprovAi / desmembrar cartão / aditivos / ciclo do imóvel
- [ ] Mergear na `main` (deploy produção)
- [ ] Retomar backlog (Locação faturas→financeiro, etc.)

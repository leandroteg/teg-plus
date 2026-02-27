# TEG+ Sistema de Compras - Guia de Setup

## Arquitetura

```
[React Mobile App] ---> [n8n Webhooks] ---> [Supabase PostgreSQL]
     (Frontend)          (Orquestrador)       (Banco de Dados)
```

## 1. Supabase

### 1.1 Criar projeto
1. Acessar https://supabase.com
2. Criar novo projeto "teg-plus"
3. Anotar: Project URL, anon key, service_role key

### 1.2 Executar migrations
No SQL Editor do Supabase, executar em ordem:
1. `supabase/001_schema_compras.sql` - Schema principal
2. `supabase/002_seed_usuarios.sql` - Usuarios iniciais
3. `supabase/003_rpc_dashboard.sql` - RPCs do dashboard

### 1.3 Verificar
- Tabelas criadas: obras, usuarios, alcadas, requisicoes, requisicao_itens, aprovacoes, atividades_log, configuracoes
- Views criadas: vw_dashboard_requisicoes, vw_requisicoes_completas, vw_kpis_compras, vw_requisicoes_por_obra
- RPC: get_dashboard_compras()
- Realtime habilitado para: requisicoes, aprovacoes

## 2. n8n

### 2.1 Credenciais
1. Settings > Credentials > Add > Supabase
2. Host: sua-url.supabase.co
3. Service Role Key: (do Supabase)

### 2.2 Workflows
Ja criados automaticamente:
- TEG+ | Compras - Nova Requisicao (POST /compras/requisicao)
- TEG+ | Compras - Processar Aprovacao (POST /compras/aprovacao)
- TEG+ | Painel - API Dashboard Compras (GET /painel/compras)

### 2.3 Configurar nodes
Em cada workflow:
1. Clicar em cada node Supabase
2. Selecionar a credencial criada
3. Verificar se o nome da tabela esta correto
4. Salvar e ativar

## 3. Frontend React

### 3.1 Instalar
```bash
cd frontend
npm install
```

### 3.2 Configurar .env
```bash
cp .env.example .env
```
Preencher:
- VITE_SUPABASE_URL=https://xxx.supabase.co
- VITE_SUPABASE_ANON_KEY=eyJ...
- VITE_N8N_WEBHOOK_URL=https://seu-n8n.com/webhook

### 3.3 Executar
```bash
npm run dev
```
Acessar: http://localhost:5173

## 4. GitHub

### 4.1 Criar repositorio
```bash
cd teg-plus
git init
git add .
git commit -m "feat: setup inicial TEG+ Sistema de Compras"
git remote add origin https://github.com/seu-org/teg-plus.git
git push -u origin main
```

## 5. Fluxo de Compras

```
Solicitante cria RC (React App)
        |
        v
n8n valida e salva (Supabase)
        |
        v
Determina alcada por valor
        |
        v
Cria registro de aprovacao
        |
        v
[Futuro: Notifica aprovador via WhatsApp/Email]
        |
        v
Aprovador acessa link de aprovacao
        |
        v
n8n processa decisao
        |
   [Aprovada?]
   /         \
  Sim        Nao
  |           |
  v           v
Proximo    Requisicao
nivel?     Rejeitada
  |
 [Sim] -> Repete aprovacao
 [Nao] -> Requisicao Aprovada
            |
            v
      [Futuro: Criar OC no Omie]
```

## Proximos Passos (Roadmap)

### Mes 1 - Financeiro
- [ ] Integrar notificacoes WhatsApp (Evolution API)
- [ ] Integrar notificacoes Email (Microsoft 365)
- [ ] Workflow NF-e automatica -> Contas a Pagar
- [ ] Painel de vencimentos

### Mes 2 - AI TEG+
- [ ] AI Agent no WhatsApp para criar requisicoes
- [ ] Cadastro de fornecedores via chat
- [ ] Cotacao automatica

### Mes 3 - Patrimonio + RH
- [ ] Controle de patrimonio (R$ 22.5M)
- [ ] Folha internalizada com rateio por obra
- [ ] HHt integrado

### Mes 4 - Obras + PMO
- [ ] App HHt mobile
- [ ] Monday.com com 6 obras
- [ ] SPI/CPI automatico

### Mes 5 - Controladoria
- [ ] P&L por projeto
- [ ] Margem real mensal
- [ ] Painel de contratos

### Mes 6 - AI Completo
- [ ] AI TEG+ com todas as ferramentas
- [ ] Painel Lovable com chat
- [ ] Modulos "a definir" resolvidos

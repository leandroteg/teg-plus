# Setup Integração Omie

> Módulo: Financeiro | Status: Em desenvolvimento | Última atualização: 2026-03-03

---

## Pré-requisitos

Antes de começar, verifique que você tem acesso a:

- [ ] Conta ativa no Omie ERP com permissão de administrador
- [ ] Acesso ao [Portal do Desenvolvedor Omie](https://developer.omie.com.br)
- [ ] Acesso ao painel n8n do TEG+
- [ ] Acesso ao Supabase do TEG+ (Service Role Key)
- [ ] Acesso ao Frontend TEG+ com perfil `admin`

---

## Passo 1: Criar App no Portal Omie

1. Acesse [developer.omie.com.br](https://developer.omie.com.br)
2. Faça login com as credenciais da conta Omie da empresa
3. Clique em **"Novo App"** ou **"Criar Aplicativo"**
4. Preencha os dados do app:
   - **Nome:** `TEG+ Integração`
   - **Descrição:** `Integração TEG+ ERP com Omie via n8n`
   - **URL de Callback:** (deixar em branco por enquanto)
5. Confirme a criação
6. Na tela do app criado, você verá o **App Key** e **App Secret**

> **Importante:** O App Secret é exibido apenas uma vez. Anote-o imediatamente ou copie para um gerenciador de senhas.

---

## Passo 2: Obter app_key e app_secret

Após criar o app, copie as duas credenciais:

```
App Key:    1234567890123              ← identificador público
App Secret: abcdef1234567890abcdef     ← senha privada (nunca compartilhar)
```

Guarde esses valores. Eles serão inseridos no TEG+ no próximo passo.

---

## Passo 3: Configurar Credenciais no TEG+

1. Acesse o **TEG+ Frontend**
2. No menu lateral, vá em **Financeiro → Configurações**
3. Na seção **"Integração Omie"**, clique em **"Configurar"**
4. Preencha os campos:
   - **App Key Omie:** cole o valor do App Key
   - **App Secret Omie:** cole o valor do App Secret
5. Clique em **"Salvar Credenciais"**

O sistema irá salvar essas credenciais na tabela `sys_config` do Supabase:

```sql
-- O que o frontend faz internamente:
INSERT INTO sys_config (chave, valor) VALUES
  ('omie_app_key', 'seu-app-key'),
  ('omie_app_secret', 'seu-app-secret')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;
```

6. Ative o toggle **"Integração Omie Habilitada"**

---

## Passo 4: Configurar URL do n8n

Ainda na tela **Financeiro → Configurações**:

1. Na seção **"Configurações n8n"**, preencha a URL base do n8n:
   - **URL n8n:** `https://seu-n8n.dominio.com.br`
2. Clique em **"Salvar"**

Isso é usado pelo Frontend para saber para onde enviar os webhooks.

---

## Passo 5: Importar Workflows n8n

1. Acesse o painel do **n8n** (`https://seu-n8n.dominio.com.br`)
2. Faça login como administrador
3. No menu, clique em **"Workflows"** → **"Import from File"**
4. Importe os seguintes arquivos da pasta `n8n-docs/`:

| Arquivo | Workflow |
|---------|----------|
| `workflow-omie-sync-fornecedores.json` | TEG+ \| Omie - Sync Fornecedores |
| _(em breve)_ `workflow-omie-sync-contas-pagar.json` | TEG+ \| Omie - Sync Contas a Pagar |
| _(em breve)_ `workflow-omie-sync-contas-receber.json` | TEG+ \| Omie - Sync Contas a Receber |
| _(em breve)_ `workflow-omie-aprovar-pagamento.json` | TEG+ \| Omie - Aprovar Pagamento |

Para cada arquivo:
1. Clique em **"Import from File"**
2. Selecione o arquivo `.json`
3. Confirme a importação
4. **Não ative ainda** — primeiro configure as credenciais (próximo passo)

---

## Passo 6: Configurar Credencial Supabase no n8n

Os workflows precisam de acesso ao Supabase. Configure uma credencial do tipo Supabase no n8n:

1. No n8n, vá em **Settings → Credentials → Add Credential**
2. Busque por **"Supabase"**
3. Preencha:
   - **Host:** `https://seu-projeto.supabase.co`
   - **Service Role Key:** (copiar do Supabase Dashboard → Settings → API → `service_role`)
4. Clique em **"Save"**
5. Nomeie a credencial como `TEG+ Supabase`

> **Atenção:** Use a **Service Role Key** (não a anon key). A Service Role Key ignora as políticas RLS e é necessária para que o n8n possa fazer upserts nas tabelas.

### Vincular Credencial aos Workflows

Para cada workflow importado:
1. Abra o workflow
2. Clique no node **"Get Omie Credentials"** (ou qualquer node que faz requisição ao Supabase)
3. Na seção de credenciais, selecione **"TEG+ Supabase"**
4. Repita para todos os nodes que requerem autenticação Supabase
5. Salve o workflow

---

## Passo 7: Configurar Variáveis de Ambiente no n8n

Os workflows utilizam variáveis globais (`$vars`) para URLs e chaves. Configure no n8n:

1. Vá em **Settings → Variables**
2. Adicione as seguintes variáveis:

| Variável | Valor | Descrição |
|----------|-------|-----------|
| `supabase_url` | `https://seu-projeto.supabase.co` | URL base do Supabase |
| `supabase_service_role_key` | `eyJ...` | Service Role Key do Supabase |

> **Nota:** As variáveis `$vars` são diferentes das credenciais. Elas ficam disponíveis em expressões dentro dos nodes como `{{ $vars.supabase_url }}`.

---

## Passo 8: Ativar os Workflows

Com as credenciais configuradas e vinculadas:

1. Abra o workflow **TEG+ | Omie - Sync Fornecedores**
2. Clique no toggle **"Active"** (canto superior direito)
3. Confirme a ativação
4. Repita para os demais workflows Omie

Após ativar, o n8n exibirá as URLs dos webhooks:
- **Produção:** `https://seu-n8n.dominio.com.br/webhook/omie/sync/fornecedores`
- **Teste:** `https://seu-n8n.dominio.com.br/webhook-test/omie/sync/fornecedores`

---

## Passo 9: Testar a Integração

### Teste 1: Sync de Fornecedores

1. No TEG+ Frontend, acesse **Financeiro → Fornecedores**
2. Clique no botão **"Sincronizar com Omie"**
3. Aguarde a resposta (pode levar 10-30 segundos dependendo do volume)
4. Verifique a mensagem de sucesso com o número de registros sincronizados

**Ou via curl:**
```bash
curl -X POST https://seu-n8n.dominio.com.br/webhook/omie/sync/fornecedores \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Resposta esperada:**
```json
{
  "success": true,
  "message": "Sync de fornecedores concluido",
  "registros": 42
}
```

### Teste 2: Verificar Dados no Supabase

Acesse o Supabase Studio e execute:

```sql
-- Verificar fornecedores sincronizados
SELECT omie_id, razao_social, cnpj, email
FROM cmp_fornecedores
ORDER BY razao_social
LIMIT 10;

-- Verificar log de sync
SELECT dominio, status, registros, executado_em
FROM fin_sync_log
ORDER BY executado_em DESC
LIMIT 5;
```

---

## Passo 10: Verificar Dados nas Tabelas

Após o sync bem-sucedido, verifique os dados:

### Fornecedores
```sql
SELECT
  COUNT(*) as total,
  COUNT(omie_id) as com_omie_id,
  COUNT(cnpj) as com_cnpj,
  MAX(updated_at) as ultima_atualizacao
FROM cmp_fornecedores;
```

### Contas a Pagar (após sync do Squad 2)
```sql
SELECT
  status,
  COUNT(*) as quantidade,
  SUM(valor_original) as valor_total
FROM fin_contas_pagar
GROUP BY status
ORDER BY valor_total DESC;
```

### Contas a Receber (após sync do Squad 3)
```sql
SELECT
  status,
  COUNT(*) as quantidade,
  SUM(valor_original) as valor_total
FROM fin_contas_receber
GROUP BY status
ORDER BY valor_total DESC;
```

---

## Configurar Agendamento Automático (Opcional)

Para sync automático, configure um Cron Trigger em cada workflow:

1. Abra o workflow no n8n
2. Adicione um node **"Schedule Trigger"** antes do webhook trigger
3. Configure o horário:
   - **Fornecedores:** `0 2 * * *` (todo dia às 02:00)
   - **Contas a Pagar:** `0 */4 * * *` (a cada 4 horas)
   - **Contas a Receber:** `0 6 * * *` (todo dia às 06:00)
4. Conecte ao próximo node normalmente
5. Salve e mantenha o workflow ativo

---

## Checklist Final

- [ ] App criado no developer.omie.com.br
- [ ] app_key e app_secret configurados no TEG+ (sys_config)
- [ ] Integração habilitada no Frontend
- [ ] URL do n8n configurada no Frontend
- [ ] Workflows importados no n8n
- [ ] Credencial Supabase configurada no n8n
- [ ] Variáveis de ambiente configuradas no n8n
- [ ] Credenciais vinculadas aos nodes dos workflows
- [ ] Workflows ativados
- [ ] Teste de sync realizado com sucesso
- [ ] Dados verificados no Supabase
- [ ] Agendamento configurado (se desejado)

---

## Troubleshooting

Consulte a seção de troubleshooting em [[TEG+ Integração Omie]] para soluções dos erros mais comuns.

---

## Páginas Relacionadas

- [[TEG+ Integração Omie]] - Documentação técnica completa
- [[Arquitetura Agent Squads]] - Como os agentes funcionam
- [[Índice Financeiro]] - Índice do módulo financeiro

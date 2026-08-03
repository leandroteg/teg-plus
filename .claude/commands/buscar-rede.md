---
description: Busca arquivos por nome no servidor Z:\ (RH, SegTrab, Meio Ambiente por padrão)
argument-hint: <padrão> [pasta1 pasta2 ...]
---

Buscar arquivos no servidor de arquivos `Z:\` (\\wfs\TEGUNIAO).

## Argumentos

`$ARGUMENTS` contém:
- **1º token** = padrão de nome do arquivo (wildcards do PowerShell: `*`, `?`). Exemplo: `*contrato*.pdf`, `EPI*.xlsx`.
- **Tokens seguintes (opcional)** = nomes de pastas em `Z:\` para sobrescrever o escopo padrão. Exemplo: `Compras Financeiro`.

Se o usuário não informar pastas extras, usar o **escopo padrão**:
- `Z:\RH`
- `Z:\Segurança do Trabalho`
- `Z:\Meio Ambiente`

## Execução

1. Validar que `$ARGUMENTS` não está vazio — se estiver, peça o padrão de busca ao usuário e pare.
2. Separe o padrão (primeiro token) das pastas (resto). Se vier só o padrão, use o escopo padrão acima.
3. Para cada pasta no escopo, confirme que existe (`Test-Path`). Avise quais não existem mas siga com as que existem.
4. Rode UM comando PowerShell que faz a busca recursiva em todas as pastas válidas de uma vez:

```powershell
$pattern = '<PADRÃO>'
$roots = @('Z:\RH','Z:\Segurança do Trabalho','Z:\Meio Ambiente') | Where-Object { Test-Path $_ }
Get-ChildItem -Path $roots -Recurse -File -Filter $pattern -ErrorAction SilentlyContinue |
    Select-Object @{n='Pasta';e={$_.DirectoryName}}, Name, @{n='Tamanho';e={'{0:N0} KB' -f ($_.Length/1KB)}}, LastWriteTime |
    Sort-Object LastWriteTime -Descending |
    Format-Table -AutoSize
```

5. Apresente o resultado ao usuário como tabela. Se a lista for grande (>50 itens), mostre os 50 mais recentes e diga o total encontrado.
6. Se nada for encontrado, diga isso explicitamente — não invente arquivos.

## Notas

- Use `-Filter` em vez de `-Include` (muito mais rápido em pastas grandes na rede).
- `-ErrorAction SilentlyContinue` para ignorar pastas sem permissão.
- O drive Z:\ é uma rede (`\\wfs\TEGUNIAO`) — buscas podem demorar alguns segundos.
- NÃO abra arquivos encontrados sem o usuário pedir. Só liste.

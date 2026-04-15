# teg-playground (repositório irmão)

Existe um repositório git **local e independente** em `/home/user/teg-playground`
(irmão deste repo no filesystem) destinado a experimentos, POCs e protótipos
que **não** fazem parte do TEG+.

- **Localização:** `/home/user/teg-playground`
- **Natureza:** repo git local, sem remote, desacoplado deste projeto
- **Escopo:** playground — código daqui não é consumido pelo TEG+

## Por que existe

Separar exploração (bibliotecas novas, ideias de feature, reprodução de bugs
em ambiente limpo) do código de produção, evitando poluir histórico e
dependências do TEG+.

## Como se relaciona com o TEG+

- Não é submódulo
- Não é dependência
- Não é importado em nenhum build
- Pode, quando útil, consumir a API HTTP do TEG+ como qualquer cliente externo

Quando um experimento amadurece, ele vira PR próprio no teg-plus — sem trazer
o histórico do playground junto.

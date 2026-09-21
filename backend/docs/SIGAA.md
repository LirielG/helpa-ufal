# Integração com o SIGAA

O feed do Helpa tem duas abas: as ações criadas na plataforma e as atividades de extensão
publicadas no SIGAA da UFAL. A segunda vem de **raspagem de HTML**, guardada num cache
local e servida por rotas próprias.

Isto é raspagem de um sistema de terceiros que ninguém neste projeto controla. A página
pode mudar sem aviso, e quando mudar o sintoma vai ser um feed vazio, não um erro. Esta
página existe para encurtar esse diagnóstico.

Uma `SigaaActivity` **não é uma ação do Helpa**: não tem vagas, status, carga horária nem
inscrição, e nada nela vira hora complementar. Ver
[`../../docs/GLOSSARY.md`](../../docs/GLOSSARY.md).

## As peças

| Arquivo | Papel |
| --- | --- |
| `src/services/sigaa/SigaaScraperService.ts` | Fala com o SIGAA e converte o HTML em objetos. |
| `src/services/sigaa/SigaaSyncService.ts` | Decide *quando* raspar e grava o resultado no cache. |
| `src/services/sigaa/SigaaActivityService.ts` | Valida filtros, dispara a sincronização e serve a listagem. |
| `src/repositories/sigaa/SigaaActivityRepository.ts` | Lê e escreve a tabela `sigaa_activities`. |
| `src/config/certs/sigaa-ca-bundle.pem` | O certificado intermediário que o SIGAA não envia. |

Do lado do frontend: `src/features/sigaa/`, com `SigaaFeed`, `SigaaFilterBar` e
`SigaaFeedFallback`.

## Quando a raspagem acontece

Não há job agendado, nem cron, nem processo em segundo plano. A sincronização é **inline,
disparada pela própria requisição de listagem**:

```
GET /sigaa-activities
  → SigaaActivityService.list()
    → SigaaSyncService.syncIfNeeded()   ← pode raspar o SIGAA aqui
    → repositório lê o cache e responde
```

`syncIfNeeded()` compara o `lastSeenAt` mais recente do cache com
`SIGAA_CACHE_TTL_HOURS` (padrão 12). Dentro do prazo, retorna na hora. Fora do prazo,
chama `forceSync()`.

Três consequências que valem saber:

- **A primeira requisição depois do TTL expirar paga o custo da raspagem** — um GET e um
  POST no SIGAA, com timeout de 30 s.
- **Requisições simultâneas não raspam duas vezes.** `forceSync()` guarda a promessa em
  voo (`_inFlightSync`) e as chamadas concorrentes aguardam a mesma. Essa proteção é por
  processo: duas instâncias da API rasparia cada uma a sua.
- **Falha na sincronização não quebra a resposta.** O erro é logado e o cache existente é
  servido mesmo assim. É degradação deliberada: um SIGAA fora do ar deixa o feed
  desatualizado, não derrubado.

`SIGAA_SYNC_ENABLED=false` desliga só a sincronização implícita — `forceSync()` continua
forçando, se alguém o chamar. A flag está desligada no `.env.test` porque, com ela ligada,
a suíte de integração rasparia o site real da UFAL.

## Como o cache é atualizado

`forceSync()` marca o instante, raspa, e então:

1. `upsertMany(scraped, syncTimestamp)` — grava tudo por `sigaaId`, em lotes de 50 dentro
   de transações, com `isActive: true` e `lastSeenAt: syncTimestamp`.
2. `markInactiveBefore(syncTimestamp)` — tudo que **não** apareceu nesta coleta fica com
   `lastSeenAt` antigo e é marcado `isActive: false`.

Nada é apagado: uma atividade que sumiu do SIGAA continua na tabela, invisível. A listagem
e as rotas de filtro só consideram `isActive: true`.

O lote de 50 existe porque um `$transaction` com um array de centenas de upserts estoura o
limite de parâmetros do driver.

Se a raspagem devolver **zero** itens, nada é gravado e nada é desativado. É a salvaguarda
contra o caso em que o HTML mudou e o parser passou a não achar nada: sem ela, uma coleta
vazia apagaria o feed inteiro do usuário.

## Como a raspagem funciona

O SIGAA é uma aplicação JSF, e é isso que dita a forma da raspagem:

1. **GET** na `SIGAA_BASE_URL` para pegar os cookies de sessão e o token
   `javax.faces.ViewState` do formulário. Sem o ViewState, o POST é rejeitado — é o
   antiforgery do JSF.
2. **POST** no mesmo endereço, com os cookies, o `Referer` e o formulário preenchido: busca
   por ano, com o **ano corrente**, tipo e unidade em `0` (todos).
3. **Parse** da tabela de resultados.

Há um `User-Agent` de navegador fixado no código. A requisição sem ele é rejeitada.

Só o ano corrente é buscado. Não há paginação: o SIGAA devolve o resultado inteiro numa
página.

### O parser

Os seletores refletem o HTML do SIGAA. Se a página mudar, é aqui que quebra:

| O quê | Seletor / padrão |
| --- | --- |
| Linhas da tabela | `tr.linhaPar, tr.linhaImpar` |
| Título | texto do `<a>` da 1ª célula (com fallback para o texto da célula) |
| Id | `'idAtividadeExtensaoSelecionada' : '<digitos>'` dentro do `onclick` do `<a>` |
| Tipo | texto da 2ª célula |
| Departamento | texto da 3ª célula |

Linha com menos de três células é ignorada, e título vazio também.

**Quando o id não é encontrado**, o scraper gera um a partir do hash SHA-256 de
`título-tipo-departamento`. Isso mantém o upsert estável entre coletas, mas é um id
derivado do conteúdo: mudou o título no SIGAA, vira outra linha no cache, e a antiga fica
`isActive: false`. Vale saber antes de investigar uma "duplicata".

### `normalizedType`

O SIGAA escreve o tipo em texto livre. `normalizeActivityType` mapeia para o
`ActivityType` do Helpa, para que o filtro do feed funcione igual nas duas abas:

| Contém (maiúsculas) | Vira |
| --- | --- |
| `CURSO` | `COURSE` |
| `EVENTO` | `EVENT` |
| `PROJETO`, `PROGRAMA`, `PRODUTO`, `PRESTAÇÃO DE SERVIÇO`, `EXTENSÃO` | `EXTENSION` |
| qualquer outra coisa | `OTHER` |

O texto original é preservado em `type`, e é ele que aparece em
`GET /sigaa-activities/filters`. Ou seja: o filtro de tipo dessa aba usa o texto do SIGAA,
não o enum do Helpa.

## Por que existe um CA bundle no repositório

O SIGAA serve uma cadeia TLS quebrada. O certificado do servidor (`*.sig.ufal.br`) é
emitido pela intermediária **RNP ICPEdu GR46 OV TLS CA 2025**, mas essa intermediária nunca
é enviada — no lugar dela vem uma cadeia `*.ufal.br` sem relação, e já expirada. O
resultado é `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.

`src/config/certs/sigaa-ca-bundle.pem` fornece a intermediária que falta, junto com a raiz
GlobalSign R46, e o scraper usa um `Agent` do undici com esse CA **e
`rejectUnauthorized: true`**.

Isso é importante: a alternativa preguiçosa seria desligar a verificação
(`rejectUnauthorized: false`), que aceitaria qualquer certificado, de qualquer um. O bundle
existe justamente para não fazer isso.

O certificado intermediário expira em **19/11/2030**. Quando a UFAL corrigir a cadeia que
serve, o `Agent` inteiro pode ser removido em favor do `fetch` padrão.

## Rotas

| Rota | Resposta |
| --- | --- |
| `GET /sigaa-activities` | `{ items, total, page, limit }` |
| `GET /sigaa-activities/filters` | `{ types, departments }` |

Ambas são públicas — não exigem sessão.

Filtros aceitos: `search` (no título, sem diferenciar maiúsculas), `type`, `department`,
`page`, `limit`, `orderBy` (`title` ou `lastSeenAt`) e `order`.

Diferente de `GET /activities`, aqui `page` e `limit` fora da faixa são **clampados em
silêncio** (limite máximo 100), não rejeitados com 400. Só `orderBy` e `order` inválidos
produzem 400. Ver [`API.md`](API.md).

## Diagnóstico

O feed do SIGAA vazio ou parado quase sempre é um destes casos:

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| Feed vazio, log sem erro | O parser não achou nenhuma linha: o HTML do SIGAA mudou. | Conferir os seletores contra a página real. A salvaguarda de "zero itens" preservou o cache. |
| `Unable to extract javax.faces.ViewState` | O formulário mudou de forma, ou a página respondeu outra coisa (manutenção, redirecionamento). | Abrir a `SIGAA_BASE_URL` no navegador e ver o que ela devolve. |
| `UNABLE_TO_VERIFY_LEAF_SIGNATURE` | A intermediária do bundle expirou, ou a UFAL trocou de emissor. | Conferir a cadeia com `openssl s_client -showcerts` e atualizar o `.pem`. |
| `SIGAA GET/POST request failed with status: 5xx` | SIGAA fora do ar. | Nada a fazer no código. O cache continua servindo. |
| Timeout aos 30 s | SIGAA lento. | Idem. |
| Feed desatualizado, sem erro nenhum | `SIGAA_SYNC_ENABLED=false`, ou o TTL ainda não venceu. | Conferir o `.env`. |
| Nada sincroniza nos testes de integração | Esperado: o `.env.test` desliga a flag de propósito. | — |

Os erros da sincronização são logados com o prefixo `[SigaaSyncService]` e **não** sobem
para a resposta HTTP. Feed desatualizado sem erro visível na tela é o comportamento
projetado; o log é onde a falha aparece.

## Testar sem bater no SIGAA

`SigaaScraperService.parseActivitiesHtml(html)` é público e puro: recebe HTML e devolve os
objetos, sem rede. É assim que `SigaaScraperService.test.ts` cobre o parser — salvando uma
amostra do HTML e testando contra ela.

Quando o SIGAA mudar o HTML, o caminho é atualizar a amostra junto com os seletores. Um
teste que passa contra uma amostra de dois anos atrás não diz nada sobre a página de hoje.

`SigaaSyncService` recebe scraper, repositório, TTL e a flag pelo construtor, então o
teste da política de cache roda sem rede e sem banco.

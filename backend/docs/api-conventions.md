# Convenções da API

Regras que todo contrato da API segue. A coleção Bruno (`bruno/`) descreve cada rota e linka este
documento; ela não repete o que está aqui.

**Princípio:** cada regra é a melhor para quem consome a API, mesmo que rotas atuais divirjam
dela. Não existe exceção aceita: toda divergência vira issue. O fato de a maioria das rotas já
fazer de certo jeito só desempata duas opções de mesmo valor para o consumidor.

## 1. Recursos e caminhos

| Regra | Exemplo |
|---|---|
| O path só tem substantivos. Coleções vão no plural. | `/activities`, `/reports` |
| Segmentos com mais de uma palavra usam kebab-case. | `/sigaa-activities`, `/certificate-validations` |
| Parâmetros de path se chamam `:<recurso>Id`, nunca `:id`. | `/activities/:activityId` |
| Algo do próprio usuário se acessa por `me` no path. Quem age vem sempre do token, nunca de params, query ou corpo. | `/users/me`, `/activities/:activityId/enrollments/me` |
| `POST` em coleção fica reservado para quando o cliente escolhe o que criar. | `POST /activities` |
| Uma operação de estado é um sub-recurso no singular. | `/activities/:activityId/status`, `/reports/:reportId/resolution` |
| Uma representação diferente do mesmo dado ganha coleção própria. | `/certificate-validations/:validationCode` (DTO público mínimo) |
| Arquivos são um sub-recurso `file`. | `/certificates/:certificateId/file` |
| Aninhamento tem no máximo um id ancestral, usado só para escopar uma coleção (listar ou criar dentro do pai) ou para `me`. Um item com id próprio tem uma única URL canônica, no primeiro nível. | `GET /activities/:activityId/enrollments`, mas `PUT /enrollments/:enrollmentId/attendance` |

**Inscrição do próprio usuário:**

| Rota | Efeito | Status |
|---|---|---|
| `PUT /activities/:activityId/enrollments/me` | cria a minha inscrição | `201` na primeira vez; `200` com a inscrição existente se eu já estiver inscrito |
| `DELETE /activities/:activityId/enrollments/me` | cancela a minha inscrição | `204` |

Como o `PUT` é idempotente, não existe 409 "already enrolled". Os 409 de regra de negócio
continuam (ação fechada, sem vagas). Se um gestor precisar inscrever outra pessoa, a rota será
`POST /activities/:activityId/enrollments` com `userId` no corpo, sem conflito com a de cima.

## 2. Métodos e status

- **`PATCH`**: atualização parcial de um recurso com vários campos editáveis de forma
  independente. Campo ausente fica como está.
- **`PUT`**: o cliente manda o estado inteiro do recurso, e repetir a requisição dá o mesmo
  resultado. É o método dos sub-recursos de estado (`/status`, `/attendance`, `/resolution`) e
  do `me`.
- **Status:** `201` quando a requisição criou o item, `200` quando alterou ou leu, `204` quando
  não há corpo.

**Corpo das escritas:**

- `POST`, `PUT` e `PATCH` devolvem a **representação canônica do item afetado**, idêntica ao
  `GET` desse item. O item é o recurso com id mais próximo. Quando não existe `GET` do item,
  vale o formato dele na listagem.
- Num sub-recurso de estado, o item afetado é o **pai**:
  - `PUT /activities/:activityId/status` devolve a atividade, como `GET /activities/:activityId`.
  - `PUT /enrollments/:enrollmentId/attendance` devolve a inscrição.
  - `PUT /reports/:reportId/resolution` devolve a denúncia, no formato de item de `GET /reports`.
- `DELETE` devolve `204` sem corpo.

## 3. Paginação

| Ponto | Regra |
|---|---|
| Nomes | `page` (começa em 1) e `limit` |
| Teto de `limit` | **100**, numa constante única |
| Padrão de `limit` | **20** em toda rota paginada |
| Fora da faixa ou não inteiro | **400**, com um item `{ field, code, message }` por parâmetro. Nunca *clamp* silencioso |
| `page` além da última | **200** com `items: []`, e `total`/`totalPages` corretos |
| Onde é validado | um schema Zod compartilhado, aplicado pelo `validateQuery` |

**Envelope:**

```json
{
  "items": [],
  "total": 137,
  "page": 2,
  "limit": 20,
  "totalPages": 7
}
```

- A chave é sempre `items`, nunca o nome do recurso.
- `page` e `limit` ecoam os valores efetivos.
- `totalPages = max(1, ceil(total / limit))`.
- Agregados próprios de uma rota (ex.: `totalPresent`) ficam no nível de cima, ao lado de
  `total`, e são documentados na rota. Não há sub-objeto `meta`.

## 4. Erros

**Corpo:**

```json
{
  "status": 422,
  "code": "SLOTS_BELOW_APPROVED_ENROLLMENTS",
  "message": "slots cannot be reduced below the current number of approved enrollments (12).",
  "errors": [{ "field": "slots", "code": "BELOW_APPROVED_ENROLLMENTS", "message": "..." }],
  "details": { "approvedEnrollments": 12 }
}
```

| Campo | Regra |
|---|---|
| `status` | obrigatório, igual ao status HTTP |
| `code` | **obrigatório**. Identificador estável em `SCREAMING_SNAKE_CASE` e parte do contrato: mudá-lo é quebra de contrato. É o que o frontend usa para escolher o texto |
| `message` | obrigatório. Texto em **inglês** para quem depura: uma frase, com ponto final, citando campos pelo nome da API. O cliente nunca faz parse dela, e mudar a redação não quebra contrato |
| `errors[]` | em 400 e 422, um item `{ field, code, message }` por problema. `field` usa notação de ponto (`address.zipCode`) ou o nome do parâmetro de path/query |
| `details` | opcional. Dados que o cliente precisaria extrair do texto |
| `stack` | só com `NODE_ENV=development` |

Nenhuma `message` do backend é exibida diretamente ao usuário. O frontend traduz para pt-BR a
partir de `code` e `field` e, quando não há tradução, cai num texto genérico.

**`code`s genéricos**, usados quando não há um específico:

| Status | `code` |
|---|---|
| 400 | `VALIDATION_ERROR` |
| 401 | `UNAUTHENTICATED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` |
| 422 | `UNPROCESSABLE` |
| 500 | `INTERNAL_ERROR` |

`code`s de item de `errors[]` já definidos: `INVALID_UUID`, `UNKNOWN_PARAMETER`,
`INVALID_DATETIME`. `SESSION_INVALID` é o 401 de sessão inválida (seção 5). Os `code`s
específicos de cada rota ficam documentados no Bruno, no exemplo do erro.

**Ordem de validação:**

```
401 autenticação
 → 403 papel (userTypes / manager, declarado no router)
 → 400 formato (path, query e corpo, num só errors[])
 → 404 existência
 → 403 posse (autor, titular, gestor da ação)
 → 409 / 422 regras de negócio
```

O 401 vem antes do 400 porque o frontend trata 401 globalmente, mandando para o login. Uma
sessão expirada nunca deve aparecer como erro de formulário.

**Id malformado no path:** responde **400** no passo de formato, no mesmo `errors[]` que query e
corpo, com `field` igual ao nome do parâmetro e `code: "INVALID_UUID"`. A validação mora num só
lugar: o middleware `validateParams`, irmão do `validateQuery`.

**Rotas cuja existência do recurso é sensível:** recurso inexistente, id malformado e falha de
posse respondem o **mesmo 404**, com o mesmo `code`. A rota declara isso no Bruno. Hoje vale para
a validação pública e o download de certificado.

**Fronteira entre 400, 409 e 422:**

| Status | Quando | Corpo |
|---|---|---|
| **400** | Dá para decidir olhando só a requisição: tipo, formato e regras entre campos do mesmo corpo. | sempre com `errors[]` |
| **422** | A requisição é bem formada, mas um valor viola uma regra que depende de dados guardados (teto de horas da ação, vagas abaixo das inscrições aprovadas, senha nova igual à atual). | `errors[]` com `field` quando há um campo culpado |
| **409** | O estado atual do recurso impede a operação, seja qual for o valor enviado (ação fechada, sem vagas, duplicidade). | sem `errors[]`; dados para o cliente vão em `details` |

## 5. Autenticação

- **O único mecanismo é o cookie httpOnly `token`.** O login devolve só `{ user }`; o token nunca
  aparece no corpo, e o `AuthMiddleware` não lê `Authorization: Bearer`.
- **Toda rota declara a autenticação no router, de forma explícita:**
  - `requireAuth()`
  - `requireAuth({ manager: true })` ou `requireAuth({ userTypes: [...] })`
  - `optionalAuth()`, para rota pública que muda de comportamento com usuário logado
  - nenhuma das três: rota pública
- Controllers não checam `req.user` para responder 401.
- Token presente mas inválido ou expirado responde **401 também em `optionalAuth()`**.
- **O middleware carrega o usuário do banco** a cada requisição autenticada e preenche
  `req.user` com os dados atuais (`userType`, `isManager`). As claims do token só identificam o
  usuário; nunca autorizam nada.
- Usuário removido ou token revogado respondem **401 `SESSION_INVALID`** em toda rota, inclusive
  `/users/me`. Services não repetem essa checagem.

## 6. Datas, enums, nomes e nulos

**Datas:** todo instante trafega, na entrada e na saída, como ISO 8601 em UTC com `Z`
(`2026-01-01T13:00:00.000Z`). Na entrada, qualquer outra forma (sem fuso, com `-03:00`, só data,
número) responde 400 `INVALID_DATETIME`, via `z.iso.datetime()`. Converter para o horário local
é responsabilidade do frontend. Os campos se chamam `<algo>At` ou `<algo>Date`.

**Enums e valores fechados:**

- **Enum de domínio** (valor que o banco guarda) usa `SCREAMING_SNAKE_CASE` idêntico ao Prisma,
  em corpo, resposta e query.
- `orderBy` recebe o nome do campo da resposta, em camelCase (`createdAt`, `startDate`).
- Vocabulário que não é de domínio usa camelCase: `order=asc|desc`, seletores como
  `filter=enrolled`.
- Booleano na query aceita só `true` e `false`, em minúsculas. Qualquer outro valor responde 400.

**Nomes:** chaves JSON e parâmetros de query em camelCase; segmentos de path em kebab-case.

**Ausente × `null`:**

| Contexto | Regra |
|---|---|
| Resposta | todo campo do tipo sempre presente; sem valor = `null`; lista vazia = `[]`, nunca `null` |
| `POST` e `PUT` | campo opcional pode vir ausente ou `null`, com o mesmo significado: sem valor |
| `PATCH` | ausente = mantém; `null` = limpa, só em campo anulável. Em campo obrigatório, `null` dá 400 |
| String vazia | nunca significa "sem valor": `""` (depois do `trim`) num campo anulável dá 400 |

## 7. Filtros e busca

| Ponto | Regra |
|---|---|
| Combinação | todos os filtros, inclusive `search`, se combinam com `AND`. Não existe precedência |
| `search` | parcial, sem diferenciar maiúsculas, sobre os campos que a rota declara no Bruno |
| Valor vazio (`?type=`) | **400**. Ausente = sem filtro; presente = precisa ser válido |
| Enum inválido | **400** |
| Parâmetro desconhecido | **400** `UNKNOWN_PARAMETER`. A query é um `z.strictObject` |
| Onde valida | schema Zod da rota, aplicado pelo `validateQuery` (o mesmo da paginação) |
| Opções de filtro dinâmicas | rota irmã `GET /<coleção>/filters` |

## 8. Tipos no frontend

- **Tipos de fio** (o formato exato do JSON) moram num só lugar:
  `frontend/src/services/contracts/`, um arquivo por recurso da API (`activity.ts`,
  `enrollment.ts`, `report.ts`, `user.ts`, `sigaa.ts`, `common.ts`).
  - São escritos a partir do Bruno, não do código do backend.
  - Usam os nomes da API (`Activity`, `ActivityStatus`).
  - Seguem as regras acima: `T | null` e nunca `?`; datas como `string`; enums como unions dos
    valores do Prisma.
- `common.ts` traz `Paginated<T>`, `ApiErrorBody` e a union dos `code`s de erro.
- **Features não redeclaram formato de fio.** Uma feature que precisa de outro formato (rótulos
  pt-BR, `Date`, nome "Action") declara um **modelo de tela** próprio e converte no próprio
  `services.ts`.
- Mapas de mensagens pt-BR são indexados por `code`, nunca por trecho de `message`.
- Respostas não são validadas com Zod em tempo de execução. É uma evolução possível se o desvio
  de contrato continuar aparecendo.
- Não há pacote de tipos compartilhado com o backend: um lado não espelha a estrutura do outro.

## 9. Documentação no Bruno

- As regras gerais (teto, envelope, formato de erro) moram só neste documento. Cada arquivo do
  Bruno linka para cá e descreve só o que é próprio da rota.
- **Autenticação:** a coleção não declara auth. A request `Auth/Login` grava o cookie, e o
  cookie jar do Bruno o reaproveita nas demais. Nenhuma request tem header de auth próprio.
- **Toda request documenta:**
  - um exemplo de sucesso com corpo completo, idêntico ao que a rota devolve (corpo vazio só em
    `204`);
  - um exemplo por status de erro possível, com `code`;
  - a tabela de parâmetros de query;
  - a autenticação: pública, `requireAuth`, `optionalAuth` ou papel.
- Rotas planejadas ficam com `(coming soon)` no nome do arquivo e também seguem estas
  convenções.

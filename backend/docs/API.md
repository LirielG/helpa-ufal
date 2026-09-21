# Contrato da API

A documentação **rota a rota** é a coleção do Bruno em [`bruno/`](./bruno) — ver
[`README.md`](./README.md) para abrir. Esta página cobre o que vale para *todas* as rotas:
autenticação, autorização, formato de resposta, paginação e CORS.

O vocabulário do domínio está em [`../../docs/GLOSSARY.md`](../../docs/GLOSSARY.md).

## Montagem das rotas

`src/routers/index.ts` monta cinco routers, e só um tem prefixo:

| Router | Prefixo | Caminhos |
| --- | --- | --- |
| `AuthRouter` | `/auth` | `/auth/login`, `/auth/register`, `/auth/logout` |
| `ActivityRouter` | `/` | `/activities...` |
| `EnrollmentRouter` | `/` | `/activities/:activityId/enrollments...` |
| `SigaaActivityRouter` | `/` | `/sigaa-activities...` |
| `UserRouter` | `/` | `/users/me` |

Procurar por um prefixo `/activities` no index não acha nada: o caminho completo está
declarado dentro de cada router. Não há prefixo de versão (`/api`, `/v1`).

Rotas de inscrição estão repartidas entre dois routers: `POST`/`DELETE /activities/:id/enroll`
ficam no `ActivityRouter`, enquanto a listagem de inscritos e a homologação ficam no
`EnrollmentRouter`.

## Autenticação

O token é um JWT assinado com `JWT_SECRET` e carrega exatamente três campos:

```json
{ "id": "...", "userType": "STUDENT" | "TEACHER", "isManager": false }
```

Ele viaja **em um cookie**, não em um header:

- `POST /auth/login` grava o cookie `token` com `httpOnly`, `sameSite` de `COOKIE_SAME_SITE`
  e `secure` apenas em `NODE_ENV=production`. O `maxAge` é derivado de `JWT_EXPIRES_IN` com
  o mesmo parser (`ms`) que o `jsonwebtoken` usa.
- `POST /auth/logout` limpa o cookie e responde 204. Não invalida o token do lado do
  servidor — não há lista de revogação. Um token copiado antes do logout continua válido
  até expirar.

O `AuthMiddleware` aceita **as duas formas**, nesta ordem de precedência:

1. Cookie `token`.
2. Header `Authorization: Bearer <token>`.

O cookie é o que o frontend usa; o Bearer existe para a coleção do Bruno e para os testes
de integração.

Como não há refresh token, a expiração da sessão é simplesmente um 401 na próxima
requisição. O frontend reage a ele limpando a sessão local e indo para o login.

### O login responde o token no corpo também

`POST /auth/login` devolve `{ token, user }` **e** grava o cookie. O token no corpo é o que
permite ao Bruno guardá-lo numa variável de ambiente. O frontend ignora esse campo: ele
depende do cookie, que o JavaScript não consegue ler.

### Cadastro não autentica

`POST /auth/register` responde 201 com o usuário e **não** grava cookie. A pessoa é mandada
para a tela de login em seguida.

## Autorização

Duas dimensões independentes, ambas em `auth(options)`:

```ts
auth()                        // opcional — decodifica se houver token, não exige nenhum
auth({ userTypes: "all" })    // exige credencial válida, de qualquer tipo
auth({ userTypes: ["TEACHER"] })  // exige credencial de docente
auth({ manager: true })       // exige credencial de gestor
```

**`auth()` sem opções não protege a rota.** Ele preenche `req.user` se houver token e segue
adiante se não houver. É a forma certa para rota pública que muda de comportamento quando
há sessão — e a forma errada se a intenção era exigir credencial.

As rotas de escrita de ação usam `auth()` e delegam a decisão ao serviço, que devolve 401
quando `req.user` está ausente.

### A regra de negócio: autor ou gestor

Quem pode agir sobre uma ação que não criou:

| Operação | Quem pode |
| --- | --- |
| Criar ação | Qualquer usuário autenticado |
| Editar, transicionar status, excluir | Autor da ação **ou** gestor |
| Listar inscritos | Autor da ação **ou** gestor |
| Homologar presença | Autor da ação **ou** gestor |
| Inscrever-se, cancelar inscrição | O próprio usuário, sobre a própria inscrição |

**Quem age vem sempre do token.** Nenhuma rota aceita, em parâmetro, query ou corpo, "em
nome de quem" a operação acontece.

Um token válido de um usuário que não existe mais no banco não autoriza nada: os serviços
recarregam o usuário antes de decidir.

## Ordem das verificações

Esta ordem é contrato, e a coleção do Bruno e os testes de integração dependem dela:

```
400 formato de query → 401 credencial → 404 existência → 403 autorização → 409/422 regra
```

Verificar autorização antes de existência contaria ao cliente que um recurso existe antes
de saber se ele pode vê-lo. Já o 400 de formato vem antes de tudo porque não carrega
informação de negócio — só o campo ofendido.

É por isso que, em `EnrollmentRouter`, `validateQuery` está registrado **antes** de `auth`.
Mexer nessa ordem muda o comportamento público da rota.

### Id malformado responde 404

Nas rotas que buscam um recurso, um UUID inválido é tratado como busca que não encontra
nada, e não como entrada inválida. Responder 400 ali distinguiria "não existe" de "id
torto", o que já é informação.

A mesma lógica vale para escopo: uma inscrição que existe mas pertence a outra ação
responde 404, não 403.

## Formato das respostas

### Sucesso

| Situação | Status |
| --- | --- |
| Leitura | 200 |
| Criação (ação, inscrição, denúncia, cadastro) | 201 |
| Correção de estado (homologar presença, atualizar ação) | 200 |
| Operação sem corpo de resposta (cancelar inscrição, excluir ação, logout) | 204 |

Lista vazia é **200 com lista vazia**, nunca 404.

Nenhum objeto do Prisma sai direto na resposta: os serviços montam o retorno campo a campo.
Um `include` de usuário carrega `passwordHash` junto, e um spread o publicaria.

### Erro

Todo erro sai por `src/controllers/error/ErrorHandler.ts` e tem uma destas duas formas.

**Com detalhamento por campo** (400, de validação):

```json
{
  "status": 400,
  "message": "Validation error.",
  "errors": [
    { "field": "slots", "message": "slots cannot exceed 10000." }
  ]
}
```

O `message` é configurável: a validação de query usa o seu próprio (por exemplo
`"Invalid query parameters."`, fixado em `INVALID_QUERY_MESSAGE`).

**Sem detalhamento** (todo o resto):

```json
{ "status": 404, "message": "Activity not found." }
```

Em `NODE_ENV=development`, e só nele, o 500 acrescenta um campo `stack`.

### Os status em uso

| Status | Quando | Exemplo |
| --- | --- | --- |
| 400 | Formato inválido | Corpo que não passa no schema Zod |
| 401 | Sem credencial, credencial inválida, ou usuário do token não existe mais | `"Invalid credentials."` |
| 403 | Autenticado, mas sem permissão | `"Only the activity creator or a manager can confirm attendance."` |
| 404 | Não existe, foi soft-deleted, ou está fora do escopo | `"Activity not found."` |
| 409 | Estado incompatível com a operação | `"Activity is not open for enrollment."` |
| 422 | Corpo bem formado, combinação de valores inválida | `"workloadHours is required when attended is true."` |
| 500 | Erro não previsto | `"Internal server error."` |

A diferença entre 400 e 422: **400 é formato** (campo ausente, tipo errado, valor fora do
enum); **422 é combinação** (o corpo é válido isoladamente, mas `attended: false` com
`workloadHours` preenchido não faz sentido).

### 409 de unicidade

Violação de restrição única do Prisma (P2002) vira 409 automaticamente, no
`prismaErrorHandler` — nenhum repositório precisa de `try/catch` para isso.

A mensagem sai de uma **whitelist fechada**:

| Campo | Mensagem |
| --- | --- |
| `email` | `"Email already in use."` |
| `registrationCode` | `"Registration code already in use."` |
| `cndb` | `"CNDB already in use."` |
| qualquer outro | `"This value is already in use."` |

A lista é fechada de propósito: sem ela, o nome de uma coluna interna apareceria na
resposta. Campo novo com restrição única precisa ser adicionado ali para ganhar mensagem
específica — caso contrário cai na genérica, o que é o comportamento seguro.

### As mensagens de erro são em inglês

Elas não são texto de interface. O frontend traduz para pt-BR nas fatias
(`features/action-detail/errors.ts`, `features/action-edit/handleApiErrors.ts`), muitas
vezes **casando trechos da mensagem** — `"already enrolled"`, `"No available slots"`.

Isso torna as mensagens parte do contrato na prática: mudar o texto de uma delas quebra a
tradução da tela, e nenhum teste do backend acusa.

## Paginação

Não é uniforme, e é bom saber disso antes de escrever cliente.

| Rota | Parâmetros | Limite máximo | Resposta |
| --- | --- | --- | --- |
| `GET /activities` | `page`, `limit` (padrão 1 e 20) | 100 | `{ activities, total }` |
| `GET /activities/:id/enrollments` | `page`, `limit` (padrão 1 e 10) | 50 | `{ items, total, page, limit, totalPresent }` |
| `GET /sigaa-activities` | `page`, `limit` (padrão 1 e 10) | 100 | `{ items, total, page, limit }` |

Três diferenças que pegam:

- `GET /activities` chama a lista de **`activities`**; as outras chamam de **`items`**.
- `GET /activities` **não ecoa** `page` e `limit` na resposta. O frontend calcula a
  contagem de páginas a partir do `limit` que ele mesmo enviou.
- O `limit` fora da faixa se comporta diferente: em `/activities` e nos inscritos, é erro
  400; em `/sigaa-activities`, é silenciosamente clampado.

`total` é sempre a contagem global, nunca a da página. Na listagem de inscritos,
`totalPresent` também: é a contagem de presenças homologadas em toda a ação.

## Filtros e ordenação

`GET /activities` aceita `type`, `format`, `status`, `campus`, `area`, `search`, `orderBy`
(`start_date` ou `created_at`) e `order` (`asc`/`desc`, padrão `desc`).

`GET /sigaa-activities` aceita `search`, `type`, `department`, `orderBy` (`title` ou
`lastSeenAt`) e `order`.

Os dois têm uma rota irmã que devolve os valores aceitos, apurados do que existe no banco:

- `GET /activities/filters` → `{ areas }`
- `GET /sigaa-activities/filters` → `{ types, departments }`

Repare que os campos de ordenação usam convenções diferentes: `snake_case` nas ações,
`camelCase` no SIGAA. É inconsistência real do contrato, não erro de digitação desta
página.

## CORS e cookies

```ts
cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
})
```

`CORS_ORIGIN` aceita **uma** origem, não uma lista. O valor é validado como URL http(s) e
normalizado para `scheme://host[:port]` — path e barra final são descartados, porque o
header `Origin` nunca os envia.

Como a sessão é cookie e `credentials: true` está ligado, três coisas precisam bater:

- A origem do frontend tem que ser exatamente `CORS_ORIGIN`.
- `COOKIE_SAME_SITE=none` exige `secure: true`, ou seja, `NODE_ENV=production`. Em
  desenvolvimento, `none` produz um cookie que o navegador recusa.
- O cliente precisa mandar `credentials: "include"` — o `api.ts` do frontend já faz.

Sintoma clássico de configuração errada: o login responde 200 e todas as rotas seguintes
respondem 401. Ver [`../../docs/CONFIGURATION.md`](../../docs/CONFIGURATION.md).

## Limites de requisição

O corpo passa por `express.json()` com o padrão de 100 kb. Não há rate limit, limite de
upload (não há upload) nem timeout configurado.

Os limites que existem são de domínio, aplicados no `ActivityService`:

| Limite | Valor |
| --- | --- |
| Duração da ação | 365 dias |
| Início no futuro | no máximo 365 dias à frente |
| Vagas | 10.000 |
| Carga horária | 8.760 h, e nunca maior que a duração da ação em horas |
| Descrição de denúncia | 500 caracteres |

## Rotas documentadas que ainda não existem

A coleção do Bruno inclui contratos acordados e não implementados — a pasta `User/` quase
inteira, além de `Confirm Attendance` e `List Activity Enrollments` em versões anteriores.
Disparar esses requests devolve 404. [`README.md`](./README.md) mantém a lista atualizada.

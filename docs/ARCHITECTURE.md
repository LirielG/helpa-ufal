# Arquitetura

O repositório tem dois pacotes com arquiteturas diferentes, e é assim de propósito. O
backend é organizado em **camadas**; o frontend, em **feature slices**. Nenhum dos dois
espelha o outro: uma fatia do frontend não corresponde a um recurso da API, e uma camada
do backend não tem contraparte na interface. Tentar alinhar as duas estruturas só
adicionaria pastas vazias dos dois lados.

Esta página percorre uma funcionalidade inteira em cada um.

- [Backend](#backend)
- [Frontend](#frontend)

---

# Backend

```
Router → Middleware → Controller → Service → Repository → Prisma → PostgreSQL
```

```
backend/src/
  routers/       caminho, middlewares e delegação. Sem lógica.
  middlewares/   autenticação e validação de query
  controllers/   validação do corpo, chamada de um serviço, resposta
  services/      regras de negócio, permissões, fronteira de transação
  repositories/  única camada que fala com o Prisma
  schemas/       schemas Zod — o contrato de entrada
  models/        classes de erro
  types/         tipos de resposta e de domínio
  config/        ambiente, cookie de sessão, certificados
  database/      instância do Prisma Client
  utils/         funções puras (jwt, senha, uuid)
```

## As camadas

### Router

Declara o caminho, encaixa os middlewares e delega ao controller. Nada mais.

Duas coisas que passam despercebidas:

**A ordem dos middlewares é o contrato.** Em `EnrollmentRouter`, `validateQuery` vem
**antes** de `auth()` porque o contrato da rota manda responder 400 de formato antes de 401
de credencial. A resposta de formato não carrega informação de negócio — só o campo
ofendido — então revelá-la antes de autenticar não vaza nada.

**`auth()` sem opções não exige credencial.** Ele só decodifica o token se houver um. O que
efetivamente torna a rota protegida é `auth({ userTypes: "all" })`, ou uma restrição mais
específica:

```ts
authMiddleware.auth()                      // opcional: preenche req.user se houver token
authMiddleware.auth({ userTypes: "all" })  // exige credencial válida
authMiddleware.auth({ manager: true })     // exige credencial de gestor
```

A montagem final está em `src/routers/index.ts`. Só `auth` tem prefixo (`/auth`); todos os
outros routers são montados em `/` e declaram o caminho completo dentro deles. Procurar por
um prefixo `/activities` no index não acha nada — ele está dentro do `ActivityRouter`.

### Controller

Valida o corpo com um schema de `src/schemas/`, chama **um** serviço e responde. Sem regra
de negócio e sem query.

```ts
const body = ConfirmAttendanceBodySchema.parse(req.body);
const attendance = await this._enrollmentService.confirmAttendance(
  user.id, activityId, enrollmentId, body,
);
res.status(200).json(attendance);
```

Depois do `parse`, ninguém volta a `req.body`: o tipo inferido pelo Zod é o que o serviço
aceita.

Query validada chega por `res.locals.validatedQuery`, e não por `req.query` — o Express
tipa `req.query` como `qs.ParsedQs`, enquanto a saída do Zod já vem com números e defaults
aplicados.

**Quem age vem sempre do token**, nunca de parâmetro, query ou corpo. Nenhuma rota aceita
"em nome de quem" a operação acontece.

### Service

Onde estão as regras, as permissões e a fronteira da transação. É a camada mais densa do
backend, e a única que decide.

A ordem das verificações é contrato, não estilo:

```
existência (404) → autorização (403) → regra de negócio (409/422)
```

Verificar autorização antes de existência contaria ao cliente que um recurso existe antes
de saber se ele pode vê-lo. `EnrollmentService.confirmAttendance` é o exemplo completo:
ação existe, inscrição existe e pertence à ação, quem pede é autor ou gestor, ação está
`COMPLETED`, inscrição está `APPROVED`, corpo é coerente.

Duas convenções que se repetem:

- **Id malformado é 404**, não 400, nas rotas que buscam um recurso. Um UUID torto é uma
  busca que não acha nada; responder 400 distinguiria "não existe" de "id inválido".
- **Nada de objeto do Prisma na resposta.** Os métodos `toXResponse` montam o retorno campo
  a campo. Um `include` de usuário traz `passwordHash` junto, e um spread o publicaria.

### Repository

Única camada que fala com o Prisma. O serviço pode abrir a transação e passar o `tx`
adiante, mas não monta query.

Duas técnicas usadas aqui merecem atenção:

**`select` em vez de `include`** quando a query encosta em `User`. O tipo
`EnrollmentWithParticipant` carrega só `id`, `fullName`, `email` e a matrícula do aluno —
`passwordHash` não chega nem a entrar na memória do processo, e o tipo sequer consegue
expressá-lo.

**Lock explícito** onde há concorrência. `src/repositories/enrollment/locks.ts` guarda a
regra: em qualquer transação que também toque `Enrollment`, a linha de `Activity` é
**sempre** a primeira travada. Uma transação nova que inverta essa ordem cria deadlock com
as que já existem. Ver [`../backend/docs/DATABASE.md`](../backend/docs/DATABASE.md).

## Interfaces e injeção por construtor

Cada camada tem uma interface `IThing.ts` ao lado do `Thing.ts`, e as dependências chegam
por um objeto opcional no construtor, com fallback para a implementação real:

```ts
type Props = { enrollmentRepository?: IEnrollmentRepository };

constructor(props?: Props) {
  this._enrollmentRepository = props?.enrollmentRepository ?? new EnrollmentRepository();
}
```

Em produção ninguém passa nada e a cadeia real se monta sozinha. No teste, o repositório
entra falso e o serviço roda sem banco. É essa costura — e só ela — que faz a suíte
unitária não precisar de PostgreSQL.

Camada nova sem esse padrão obriga o teste da camada de cima a subir um banco. Mantenha.

## Erros

Três classes e uma cadeia de handlers.

`CustomError(status, message)` é o erro de negócio. `ValidationError(items, message?)`
estende `CustomError` com status 400 e uma lista de `{ field, message }`.

Nenhum controller monta corpo de erro na mão: joga o erro e a cadeia em
`src/controllers/error/ErrorHandler.ts`, registrada no fim do `app.ts`, decide a resposta.
Quatro handlers, nesta ordem:

| Handler | Trata | Responde |
| --- | --- | --- |
| `zodErrorHandler` | `ZodError` | 400 com `errors[]` montado a partir dos issues |
| `validationErrorHandler` | `ValidationError` | 400 com os `errors` da instância |
| `prismaErrorHandler` | `P2002` (violação de unicidade) | 409 |
| `defaultHandler` | `CustomError` e o resto | o status do erro, ou 500 |

Duas decisões dentro do handler do Prisma que valem saber antes de mexer nele:

- A mensagem vem de uma **whitelist fechada** (`email`, `registrationCode`, `cndb`).
  Qualquer outro campo cai numa mensagem genérica, para nunca ecoar nome de coluna interna
  na resposta.
- Ele lê o nome do campo em **duas formas** de `meta`, porque o formato do P2002 mudou
  entre o motor Rust e os driver adapters. O projeto usa `@prisma/adapter-pg`, mas as duas
  leituras continuam ali para o dia em que isso mudar de novo.

O `defaultHandler` só devolve `stack` quando `NODE_ENV=development`.

## Como adicionar uma funcionalidade

Tomando uma rota nova de `Activity` como exemplo, na ordem em que compensa escrever:

1. **Schema** em `src/schemas/activity/` — o contrato de entrada.
2. **Tipo de resposta** em `src/types/activity.ts` — campo a campo, sem reaproveitar tipo
   do Prisma.
3. **Repositório**: método na interface `IActivityRepository` e implementação em
   `ActivityRepository`.
4. **Serviço**: método na interface, implementação com as verificações na ordem
   404 → 403 → 409/422, e o `toXResponse` para montar a saída.
5. **Controller**: valida, chama o serviço, responde.
6. **Router**: caminho e middlewares na ordem do contrato.
7. **Testes**: unitário do serviço em `src/services/activity/__tests__/` com repositório
   falso; integração em `tests/integration/activity/` contra o banco de verdade.
8. **Bruno**: o request correspondente em `backend/docs/bruno/`, que é a documentação da
   rota.

Lembre da extensão `.js` em todo import, inclusive nos `@/`.

---

# Frontend

```
frontend/src/
  components/   componentes compartilhados por mais de uma feature
  features/     uma pasta por fatia de funcionalidade
  pages/        uma página por rota, montando as features
  routes/       tabela de rotas e guardas de acesso
  stores/       estado global (Zustand)
  services/     cliente HTTP e serviços fora de qualquer feature
  hooks/        hooks compartilhados
  validators/   validação de formulário reutilizável
  types/        tipos compartilhados
  utils/        funções puras
  config/       leitura das variáveis de ambiente
  test/         infraestrutura de teste
```

## Feature slices

Uma fatia guarda tudo que só interessa a ela:

```
features/action-detail/
  components/      componentes só desta tela
  __tests__/
  services.ts      as chamadas de API desta fatia
  errors.ts        tradução dos erros da API para pt-BR
  types.ts
```

As fatias de hoje: `auth`, `dashboard`, `action-detail`, `action-edit`, `profile`,
`report`, `sigaa`.

A regra de promoção é simples: um componente nasce dentro da fatia e só sobe para
`src/components/` quando **uma segunda fatia** passa a usá-lo. Subir antes disso cria um
componente compartilhado com um usuário só, que acaba ganhando props para atender casos que
ninguém pediu.

`pages/` monta as fatias numa tela e cuida do que é da rota — parâmetros de URL,
redirecionamento, estado de carregamento da página. Regra de apresentação fica na fatia.

## O cliente HTTP

`src/services/api.ts` embrulha o `fetch` e é por onde toda requisição passa. O que ele
resolve de uma vez por todas:

- **`credentials: "include"` em tudo.** A sessão está num cookie `httpOnly`; o JavaScript
  não tem acesso ao token e não há header `Authorization` para montar.
- **Erro vira `ApiError`**, com `status`, `message` e a lista `errors` do backend. Falha de
  rede também: recebe `status: 0` (`NETWORK_ERROR_STATUS`), porque uma requisição que nunca
  chegou não tem status HTTP.
- **Resposta 5xx nunca mostra a mensagem do servidor** — vira um texto genérico.
- **Query string monta com `params`**, e valor vazio é descartado em vez de virar
  `?search=`.
- **401 expira a sessão**, avisando `notifySessionExpired()`. As rotas de autenticação
  optam por não entrar nesse fluxo (`handleUnauthorized: false`), porque ali um 401
  significa "credencial errada" e não "sua sessão acabou".

### Por que a expiração de sessão passa por um registro

`services/session.ts` guarda um handler que alguém de dentro da árvore React registra.
O cliente HTTP é um módulo puro, sem acesso ao router nem ao estado; importar o store de
autenticação ali fecharia o ciclo `authStore → services → api → authStore`.

Quem fecha a volta é `useSessionExpiry`, montado uma vez em `AppRoutes`: ele limpa o
usuário e navega para o login. Como está na raiz, cobre até as rotas públicas, que não têm
guarda para perceber que a sessão sumiu.

## Sessão

O token vive num cookie `httpOnly`. O que o frontend guarda em `localStorage` é apenas o
objeto `user`, persistido pelo `authStore` (Zustand + middleware `persist`, chave
`helpa-auth`), para saber quem está logado sem uma ida ao servidor a cada carregamento.

Isso é conveniência de interface, **não autorização**. Quem decide é sempre o backend: um
`user` forjado no `localStorage` muda o que a tela desenha e não muda nada do que a API
responde.

O logout falha aberto: se a chamada der erro, a sessão local é limpa do mesmo jeito. A
pessoa pediu para sair, e pintar um erro na tela de login não lhe daria nada para fazer.

## Guardas de rota

| Guarda | Comportamento |
| --- | --- |
| `ProtectedRoute` | Exige sessão. Sem ela, vai para `/login` guardando a origem em `state.from`. |
| `GuestRoute` | Só para deslogado. Com sessão, volta para `state.from` ou `/dashboard`. |
| `PublicRoute` | Aberta a todos. Existe para marcar a intenção na tabela de rotas. |

`PublicRoute` não faz nada em tempo de execução, e é intencional: sem ele, a rota pública
seria a única sem marcação e ninguém saberia se é pública de propósito ou se esqueceram o
guarda.

## Erros na interface

A API responde em inglês; a interface fala pt-BR. A tradução mora na fatia, não no cliente
HTTP, porque a mesma resposta significa coisas diferentes em telas diferentes.

Dois padrões em uso:

- `features/action-detail/errors.ts` — mapeia status e trecho da mensagem para um texto de
  usuário, e devolve `null` no 401, porque ali o redirecionamento já vai acontecer e um
  erro pintado no modal não teria para quem falar.
- `features/action-edit/handleApiErrors.ts` — distribui os `errors[]` do backend pelos
  campos do React Hook Form, com uma mensagem em pt-BR por campo.

Ambos dependem de casar trechos da mensagem em inglês do backend (`"already enrolled"`,
`"No available slots"`). É frágil por natureza: mudar o texto de uma mensagem de erro do
backend quebra a tradução da tela, sem quebrar nenhum teste do backend.

## Formulários

React Hook Form com Zod via `@hookform/resolvers`. A validação de formato fica no schema
da fatia; a de negócio continua no backend, e o resultado dela volta pela distribuição de
erros descrita acima.

## Como adicionar uma feature slice

1. `src/features/<slice>/` com `types.ts` e `services.ts`.
2. Componentes em `components/` dentro da fatia.
3. Erros da API traduzidos em `errors.ts` ou equivalente, se a fatia chamar a API.
4. A página em `src/pages/`, e a rota em `routes/AppRoutes.tsx` com o guarda adequado.
5. Testes em `__tests__/` ao lado, usando `renderWithProviders` e os handlers MSW de
   `src/test/http.ts` — se a fatia chamar um endpoint novo, o handler dele precisa entrar
   lá, ou o teste falha por requisição não tratada.
6. Um componente só sobe para `src/components/` quando a segunda fatia precisar dele.

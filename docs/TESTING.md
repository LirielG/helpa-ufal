# Testes

Três suítes, com custos bem diferentes:

| Suíte | Onde | Comando | Precisa de |
| --- | --- | --- | --- |
| Unitária do backend | `backend/src/**/__tests__/` | `npm test` | Nada |
| Integração do backend | `backend/tests/integration/` | `npm run test:integration` | Container `postgres-test` |
| Frontend | `frontend/src/**/__tests__/` | `npm test` | Nada |

Todas usam Vitest. **Não há CI**: rodá-las localmente antes de pedir revisão é a única
verificação que existe.

Nomes de teste em inglês, como o resto do código. Texto de interface continua em pt-BR, e
é por ele que os testes do frontend procuram na tela.

## Suíte unitária do backend

```bash
cd backend && npm test          # uma vez
cd backend && npm run test:watch
```

Cobre serviços, middlewares e configuração. Não abre conexão com banco nenhum: as
dependências entram falsas pelo construtor.

```ts
const repository = { findById: vi.fn() } as unknown as IActivityRepository;
const service = new ActivityService({ activityRepository: repository });
```

É essa costura — a injeção por construtor descrita em
[`ARCHITECTURE.md`](ARCHITECTURE.md) — que torna a suíte instantânea. Uma camada nova sem
ela obriga o teste da camada de cima a subir PostgreSQL.

### Por que existem variáveis falsas no `vitest.config.ts`

Mesmo sem tocar no banco, importar qualquer serviço alcança `src/config/env.ts`, que valida
o ambiente na importação e derruba o processo se faltar algo. Por isso o
`vitest.config.ts` injeta `DATABASE_URL` e `JWT_SECRET` falsos no projeto `unit`. A URL é
deliberadamente impossível de conectar (`unit-tests-never-connect`): se um teste unitário
um dia tentar abrir conexão, ele falha de imediato em vez de encostar num banco real.

### Helpers

`src/utils/tests.ts` tem os asserts de erro, que substituem `try/catch` no teste:

| Helper | Verifica |
| --- | --- |
| `expectCustomError(promise, status, message?)` | Um `CustomError` com aquele status, e **não** um `ValidationError`. |
| `expectValidationError(promise, errors)` | Um `ValidationError` 400 com exatamente aqueles itens, na ordem. |
| `expectHttpError(promise, status, message?)` | Qualquer `CustomError` com aquele status. |

`expectCustomError` excluir `ValidationError` não é detalhe: é o que impede um teste de 400
passar quando o código lança o erro errado.

## Suíte de integração do backend

Sobe a aplicação de verdade contra um PostgreSQL de verdade, e dispara requisições com
Supertest.

```bash
cd backend
npm run test:db:up          # sobe o postgres-test na porta 5433
npm run test:integration
npm run test:db:down        # quando terminar
```

**Ela apaga os dados do banco de teste.** Antes de cada teste — não de cada arquivo —
`resetDatabase()` faz `TRUNCATE ... RESTART IDENTITY CASCADE` em todas as tabelas de
`public`, menos `_prisma_migrations`. Assim nenhum teste depende do que outro deixou.

Há uma trava explícita: se o nome do banco na `DATABASE_URL` não terminar em `_test`, o
`globalSetup` recusa a rodar. É o que separa "rodei os testes" de "apaguei o banco de
desenvolvimento".

O ambiente vem do `.env.test`, commitado de propósito: ele só contém as credenciais do
container descartável. Duas escolhas dele valem saber:

- `DATABASE_URL` aponta para a **porta 5433**, a do `postgres-test`, e não para a 5432.
- `SIGAA_SYNC_ENABLED=false`, porque a rota de listagem sincroniza de forma inline — com a
  flag ligada, a suíte de integração raspa o site real do SIGAA.

O `globalSetup` roda `prisma migrate deploy` sozinho, então não é preciso preparar o banco
à mão depois de puxar migrations novas.

### `fileParallelism: false`

Todos os arquivos compartilham o mesmo `helpa_test`. Rodar em paralelo faria um arquivo
truncar as tabelas no meio do teste de outro. Por isso a suíte é serial, e por isso ela é
mais lenta — os timeouts estão em 30 s.

Consequência para quem escreve teste: a suíte de integração **não exercita concorrência**.
Um bug de ordem de lock (ver [`../backend/docs/DATABASE.md`](../backend/docs/DATABASE.md))
não vai aparecer aqui.

### Organização

Um arquivo por rota, nomeado pelo método e caminho: `post-enroll.test.ts`,
`patch-attendance.test.ts`, `get-me.test.ts`, agrupados por recurso em
`tests/integration/<recurso>/`.

### Helpers

`tests/helpers/factories.ts` cria os dados no banco e devolve o que o teste precisa:

| Factory | Devolve |
| --- | --- |
| `createStudent`, `createTeacher`, `createManager` | `{ user, token }` — usuário criado e token já assinado para ele |
| `createActivity` | A ação, com `details` e endereço |
| `createEnrollment` | A inscrição |
| `createSigaaActivity` | Uma linha do cache do SIGAA |
| `anAddress()` | Um endereço válido, sem tocar no banco |

Prefira as factories a assinar token na mão: elas devolvem o par `{ user, token }` já
casado, e várias rotas buscam o usuário do token no banco — um token de um `id` que não
existe responde 401, mesmo com assinatura válida.

`tests/helpers/auth.ts` monta os cabeçalhos:

```ts
await request(app).get("/users/me").set(...authCookie(token));   // cookie de sessão
await request(app).get("/users/me").set(...authHeader(token));   // Bearer
```

As duas formas funcionam, porque o `AuthMiddleware` aceita cookie e header. `invalidToken()`
cobre o caminho do 401.

`tests/helpers/dates.ts` tem `daysFromNow(n)`, que aceita negativo para datas no passado —
útil porque a criação de ação exige data de início futura.

## Suíte do frontend

```bash
cd frontend && npm test
```

Vitest com `jsdom`, Testing Library e MSW. Testes em `__tests__/` ao lado do código.

`src/test/` é a infraestrutura:

| Arquivo | O que oferece |
| --- | --- |
| `render.tsx` | `renderWithProviders`, que embrulha num `MemoryRouter` e devolve um `userEvent` pronto. Reexporta o `@testing-library/react`, então basta um import. |
| `http.ts` | Servidor MSW com handler de caminho feliz para todos os endpoints que o app chama. |
| `factories.ts` | `makeUser`, `makeAction`, `makeActionDetail`, `makeSigaaActivity`… |
| `auth.ts` | `signIn()` e `signOut()` para pôr ou tirar sessão do store. |
| `setup.ts` | Liga tudo ao ciclo do Vitest. |

```ts
const { user } = render(<ActionCard action={makeAction()} />, { route: "/dashboard" });
```

`renderWithProviders` aceita `route` e `path` para quando o componente lê parâmetro de URL:

```ts
render(<ActionDetail />, { route: "/activity/abc", path: "/activity/:id" });
```

### Quatro comportamentos do setup que costumam surpreender

- **Requisição sem handler falha o teste** (`onUnhandledRequest: "error"`). Um teste novo
  que chama endpoint novo precisa do handler em `src/test/http.ts`, ou de um
  `server.use(...)` local. Sem isso ele falha na hora, em vez de travar até o timeout
  tentando alcançar um host real.
- **`globals: false`**: `describe`, `it` e `expect` são importados de `vitest` em cada
  arquivo.
- **`cleanup()` é explícito** no `afterEach`, justamente porque não há `afterEach` global
  para a Testing Library se pendurar. Sem ele, cada teste renderiza em cima do DOM do
  anterior.
- **O store de autenticação é resetado a cada teste**, incluindo a cópia no `localStorage`.
  Ele é um singleton de módulo persistido, então as duas metades precisam ser limpas ou o
  estado vaza para o teste seguinte.

O fuso está fixo em `America/Maceio` (`vite.config.ts`), para que teste de formatação de
data não dependa da máquina.

### Sobrescrever uma resposta

```ts
server.use(
  http.get(`${API}/activities`, () => HttpResponse.json({ activities: [], total: 0 })),
);
```

`setup.ts` chama `server.resetHandlers()` depois de cada teste, então a sobrescrita não
vaza.

## Quando algo dá errado

| Sintoma | Causa provável |
| --- | --- |
| `DATABASE_URL is not set. Was .env.test loaded?` | Rodou a suíte de integração fora do `backend/`, ou o `.env.test` sumiu. |
| `Refusing to run the tests against database "..."` | A `DATABASE_URL` não termina em `_test`. A trava funcionou — não a contorne. |
| `ECONNREFUSED ... 5433` | O `postgres-test` não está no ar. `npm run test:db:up`. |
| Erro de coluna inexistente na integração | Migration nova sem `prisma migrate deploy`. O `globalSetup` faz isso; se falhou, rode à mão. |
| Teste do frontend falha com erro de requisição não tratada | Falta handler MSW para o endpoint novo. |
| Teste do frontend enxerga estado do teste anterior | Algo guardou estado fora do store — `localStorage` direto, ou um módulo com variável de topo. |
| Integração passa sozinha e falha junto | Teste dependendo de dado deixado por outro. O reset é por teste; o dado precisa ser criado no próprio. |

Ambiente sandboxado: o socket do Docker e a porta 5433 podem estar bloqueados. `test:db:up`
e `test:integration` precisam rodar fora do sandbox.

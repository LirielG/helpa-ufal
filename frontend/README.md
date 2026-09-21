# Helpa — Frontend

Interface web do Helpa, a plataforma de gestão de atividades de extensão e voluntariado
da UFAL — Campus Arapiraca. Consome a API do `backend/` deste mesmo repositório.

React 19 com Vite e TypeScript, Tailwind CSS v4 para estilo, React Router para navegação,
Zustand para o estado de sessão e React Hook Form + Zod nos formulários.

A visão geral do produto, os pré-requisitos e o fluxo de contribuição estão no
[README da raiz](../README.md).

## Como executar

```bash
npm install
cp .env.example .env.local   # opcional em desenvolvimento
npm run dev
```

A interface sobe em `http://localhost:5173`.

Sem `VITE_API_URL`, o `src/config/index.ts` cai no padrão `http://localhost:3333` em modo
de desenvolvimento, que é onde o backend sobe. Só é preciso preencher a variável para
apontar para outra API.

O backend precisa estar no ar para qualquer tela que carregue dados, e ele só aceita
requisição com credencial vinda da origem configurada no `CORS_ORIGIN` dele — que já vem
apontada para `http://localhost:5173`. Trocar a porta do Vite exige trocar essa variável
no `.env` do backend.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento com HMR. |
| `npm run build` | `tsc -b` e depois o build do Vite, em `dist/`. |
| `npm run preview` | Serve o `dist/` já construído. |
| `npm run lint` | ESLint em todo o pacote. |
| `npm test` | Suíte de testes (Vitest + Testing Library + MSW). |
| `npm run test:watch` | Suíte em modo watch. |
| `npm run test:coverage` | Cobertura em `coverage/`. |
| `npm run format` / `format:check` | Prettier. |

Não há CI no repositório: rode `npm test && npm run lint` antes de pedir revisão.

## Estrutura

```
src/
  components/   componentes compartilhados por mais de uma feature
  features/     uma pasta por fatia de funcionalidade
  pages/        uma página por rota, montando as features
  routes/       tabela de rotas e os guardas de acesso
  stores/       estado global (Zustand)
  services/     cliente HTTP e serviços que não pertencem a uma feature só
  hooks/        hooks compartilhados
  validators/   validação de formulário reutilizável
  types/        tipos compartilhados
  utils/        funções puras
  config/       leitura das variáveis de ambiente
  test/         infraestrutura de teste (render, MSW, factories)
```

Cada `src/features/<slice>/` guarda o que só interessa àquela fatia: `components/`,
`services.ts`, `types.ts`, `constants/`, `validators.ts` e os próprios `__tests__/`.
Um componente só sobe para `src/components/` quando uma segunda feature passa a usá-lo.

As fatias de hoje são `auth`, `dashboard`, `action-detail`, `action-edit`, `profile`,
`report` e `sigaa`.

Há um alias `@` para `src/` configurado no `vite.config.ts`, mas a maior parte do código
usa caminhos relativos. Siga o que o arquivo vizinho já faz.

[`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) detalha as camadas e como criar uma
feature slice nova.

## Sessão e acesso às rotas

A sessão vive num cookie `httpOnly` emitido pelo backend, então o JavaScript **não tem
acesso ao token**. Todas as requisições saem com `credentials: "include"`
(`src/services/api.ts`).

O que o frontend guarda em `localStorage` é apenas o objeto `user`, para saber quem está
logado sem precisar de uma ida ao servidor a cada carregamento (`src/stores/authStore.ts`,
chave `helpa-auth`). Isso é conveniência de interface, não autorização: quem decide é
sempre o backend.

Quando a API responde 401, o cliente HTTP avisa `notifySessionExpired()`; o hook
`useSessionExpiry`, montado uma vez em `AppRoutes`, limpa o usuário e leva para o login.
As rotas de autenticação optam por não entrar nesse fluxo, porque ali um 401 significa
"credencial errada", não "sua sessão acabou".

Três guardas de rota:

| Guarda | Comportamento |
| --- | --- |
| `ProtectedRoute` | Exige sessão. Sem ela, redireciona para `/login` guardando a origem em `state.from`. |
| `GuestRoute` | Só para visitante deslogado. Com sessão, volta para a origem ou para `/dashboard`. |
| `PublicRoute` | Aberta a todos. Existe para marcar a intenção na tabela de rotas. |

Rotas atuais: `/login` e `/register` (guest), `/dashboard` e `/activity/:id` (públicas),
`/activity/:id/edit` e `/profile` (protegidas), `/` redireciona para `/dashboard` e
qualquer outra cai em `NotFound`.

## Testes

Vitest com `jsdom`, Testing Library e MSW. Os testes ficam em `__tests__/` ao lado do
código que cobrem.

O que `src/test/` oferece:

- `render.tsx` — `renderWithProviders`, que embrulha o componente num `MemoryRouter` e já
  devolve um `userEvent` pronto. Reexporta o `@testing-library/react` inteiro, então um
  teste precisa de um import só.
- `http.ts` — servidor MSW com handler de caminho feliz para todos os endpoints que o app
  chama. Um teste que só renderiza um formulário não precisa saber o que é MSW; quem
  precisa de outra resposta sobrescreve com `server.use(...)`.
- `factories.ts` — construtores de dados de teste.
- `auth.ts` — `resetAuthStore`, para limpar a sessão entre testes.
- `setup.ts` — liga tudo isso ao ciclo do Vitest.

Duas escolhas do setup que costumam surpreender:

- Requisição sem handler **falha o teste** (`onUnhandledRequest: "error"`), em vez de
  travar até o timeout tentando alcançar um host real.
- `globals: false`, então `describe`, `it` e `expect` são importados explicitamente de
  `vitest` em cada arquivo.

O `.env.test` é commitado de propósito: o Vitest roda em modo `test` e o Vite carrega o
arquivo sozinho, fixando a `VITE_API_URL` que os handlers do MSW esperam.

Nomes de teste em inglês; texto de interface em pt-BR.

[`../docs/TESTING.md`](../docs/TESTING.md) cobre as convenções das duas pontas.

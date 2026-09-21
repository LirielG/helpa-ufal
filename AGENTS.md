# AGENTS.md

Helpa — plataforma de gestão de atividades de extensão e voluntariado da UFAL Arapiraca.
Monorepo com dois pacotes independentes: `backend/` (API REST em Express e Prisma) e
`frontend/` (React com Vite).

Este arquivo é escrito para quem está começando a programar no projeto — pessoa ou agente
de código. Ele reúne as convenções e o motivo de cada uma; o passo a passo de instalação
está no [README.md](README.md) e não se repete aqui.

Se um termo do domínio não estiver claro, [docs/GLOSSARY.md](docs/GLOSSARY.md) resolve
antes de qualquer leitura de código.

## Comandos

Cada pacote tem o seu `package.json`. Rode de dentro dele.

| Comando | Onde | O que faz |
| --- | --- | --- |
| `npm run dev` | ambos | Backend com `tsx watch`; frontend com o Vite. |
| `npm test` | ambos | Suíte unitária. No backend, não precisa de banco. |
| `npm run test:integration` | backend | Precisa do `postgres-test` no ar e **apaga os dados do banco de teste**. |
| `npm run test:db:up` / `down` | backend | Sobe e para o container de teste (porta 5433). |
| `npm run lint` | frontend | ESLint. **O backend não tem ESLint configurado.** |
| `npm run format` / `format:check` | ambos | Prettier. |
| `npx prisma migrate dev` | backend | Aplica migrations e regenera o client. |

**Não há CI.** Nada roda sozinho no push ou no PR. A verificação antes de pedir revisão é
local, e é a única que existe:

```bash
cd backend  && npm test && npm run format:check
cd frontend && npm test && npm run lint && npm run format:check
```

A versão do Node está em `.nvmrc` (`nvm use` na raiz). O gerenciador é o **npm**, com
`package-lock.json` — instalar com yarn ou pnpm reescreve o lockfile.

## O caminho de uma requisição (backend)

```
Router → Middleware → Controller → Service → Repository → Prisma → PostgreSQL
```

- **Router** (`src/routers/`) declara o caminho, encaixa os middlewares e delega. Sem
  lógica. A ordem dos middlewares **é parte do contrato**: veja `EnrollmentRouter`, onde
  formato de query (400) vem antes de autenticação (401), que vem antes de existência
  (404) e de autorização (403).
- **Controller** (`src/controllers/<feature>/`) valida com um schema Zod, chama **um**
  serviço e responde. Sem regra de negócio, sem query.
- **Service** (`src/services/<feature>/`) é onde moram as regras, as permissões e a
  fronteira da transação.
- **Repository** (`src/repositories/<feature>/`) é a única camada que fala com o Prisma.

Cada camada tem uma interface `IThing.ts` ao lado do `Thing.ts`, e as dependências chegam
por um objeto opcional no construtor, com fallback para a implementação real:

```ts
constructor(props?: Props) {
  this._activityRepository = props?.activityRepository ?? new ActivityRepository();
}
```

É essa costura que permite a suíte unitária rodar sem banco nenhum. Ao criar uma camada
nova, mantenha o padrão — sem ele, o teste da camada de cima precisa de PostgreSQL.

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) percorre uma fatia inteira, do router ao
repositório, e faz o mesmo para o frontend.

## Regras fáceis de errar

- **Os imports mantêm a extensão `.js`**, inclusive os que usam `@/`:
  `import { env } from "@/config/env.js"`. O pacote é ESM nativo (`"type": "module"`,
  `module: NodeNext`); um import sem extensão passa no type-check e quebra em tempo de
  execução.
- **`@/` é `backend/src/`.** Use sempre que o alvo estiver fora da pasta atual. No
  frontend existe um alias `@` equivalente no `vite.config.ts`, mas quase todo o código usa
  caminho relativo — siga o arquivo vizinho.
- **Valide no controller**, com um schema de `src/schemas/`, e deixe o tipo inferido ser o
  que o serviço aceita. Depois disso, ninguém mais toca em `req.body`.
- **Query validada vai para `res.locals.validatedQuery`**, não de volta para `req.query`.
  O Express tipa `req.query` como `qs.ParsedQs`; a saída do Zod é a fonte de verdade dali
  em diante, já com números e defaults aplicados.
- **Só repositório escreve query.** O serviço pode abrir a transação e passar o `tx`
  adiante, mas não monta SQL nem chama o Prisma direto.
- **Erro se lança, não se responde**: `throw new CustomError(status, message)` ou
  `throw new ValidationError(items, message)`. A cadeia em `src/controllers/error/`
  transforma isso — junto com erros do Zod e do Prisma — na resposta. Nenhum controller
  monta um corpo de erro na mão.
- **A ordem das verificações é contrato**, não estilo: existência (404) antes de
  autorização (403) antes de regra de negócio (409/422). O inverso conta ao cliente que um
  recurso existe antes de saber se ele pode vê-lo.
- **Id malformado é 404, não 400**, nas rotas que buscam um recurso. Um UUID inválido é
  uma busca que não acha nada, e responder 400 ali diferencia "não existe" de "id torto" —
  informação que o cliente não precisa ter.
- **`deletedAt` existe.** Ação excluída é soft delete; toda consulta de `Activity` filtra
  `deletedAt: null`.
- **Ordem de lock**: em qualquer transação que toque `Enrollment`, a `Activity` é
  **sempre** a primeira linha travada (`src/repositories/enrollment/locks.ts`). Inverter a
  ordem em uma transação nova cria deadlock com as que já existem.
- **Nunca devolva um objeto do Prisma direto na resposta.** Monte o objeto campo a campo,
  como fazem os `toXResponse` dos serviços: um `include` de usuário carrega
  `passwordHash` junto.
- **PR aponta para `development`**, não para `main`.

## Idioma

- **Código, identificadores, comentários e nomes de teste: inglês.**
- **Texto que o usuário lê: pt-BR.** Mensagens de interface, rótulos, textos de erro na
  tela.
- **Documentação em `docs/` e nos READMEs: pt-BR**, que é a língua da equipe.

As mensagens de erro da API estão em inglês hoje (`"Activity not found."`). Elas não são
texto de interface: o frontend decide o que mostrar.

## Comentários

A regra vale para código novo e para o que for tocado:

> O código diz *como*; o comentário diz *por quê*.

Antes de escrever um comentário, pergunte se ele diz algo que o código não consegue dizer
sozinho. Se não disser, renomeie, reestruture — ou não escreva nada.

Merecem comentário: regra de negócio que não se deduz do código, decisão de projeto e o
que foi descartado, contorno de bug (com a issue), constante mágica (com a fonte), código
que parece errado mas é deliberado, e lacuna conhecida marcada como `TODO(#issue)` dizendo
o que falta.

Não merecem: repetir a linha de baixo, explicar o que um nome ruim deveria explicar, e
código comentado — o Git já lembra dele.

`src/repositories/enrollment/locks.ts`, `src/config/auth-cookie.ts` e
`src/controllers/error/ErrorHandler.ts` são os exemplos do padrão que o projeto quer.

Se um comentário estiver difícil de escrever, o problema costuma ser a função, não a
frase: vale abrir uma issue de refatoração em vez de cobrir com prosa.

## Testes

Três suítes, com custos bem diferentes:

| Suíte | Comando | Precisa de |
| --- | --- | --- |
| Unitária do backend | `npm test` | Nada. As dependências entram falsas pelo construtor. |
| Integração do backend | `npm run test:integration` | Container `postgres-test` no ar. Apaga os dados entre testes. |
| Frontend | `npm test` | Nada. MSW intercepta o HTTP. |

Convenções: unitários em `__tests__/` ao lado do código; integração em
`backend/tests/integration/`, um arquivo por rota, nomeado pelo método e caminho
(`post-enroll.test.ts`). Nomes de teste em inglês.

No frontend, requisição sem handler MSW **falha o teste** em vez de travar até o timeout —
se um teste novo quebrar assim, falta declarar o handler.

[docs/TESTING.md](docs/TESTING.md) tem o resto, incluindo o que fazer quando a integração
começa a falhar sozinha.

## Onde ler mais

| Página | Leia quando |
| --- | --- |
| [README.md](README.md) | Montar o projeto do zero. |
| [docs/GLOSSARY.md](docs/GLOSSARY.md) | Um termo do domínio for desconhecido. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Adicionar ou reorganizar uma funcionalidade. |
| [docs/TESTING.md](docs/TESTING.md) | Escrever teste ou destravar uma suíte. |
| [docs/CONFIGURATION.md](docs/CONFIGURATION.md) | Mexer em variável de ambiente. |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Build de produção, deploy, backup. |
| [backend/docs/API.md](backend/docs/API.md) | Mexer em rota, autenticação, permissão ou formato de resposta. |
| [backend/docs/DATABASE.md](backend/docs/DATABASE.md) | Escrever migration, seed ou query não trivial. |
| [backend/docs/SIGAA.md](backend/docs/SIGAA.md) | Trabalhar na integração com o SIGAA. |
| [backend/docs/README.md](backend/docs/README.md) | Disparar requisições contra a API pela coleção do Bruno. |
| [frontend/README.md](frontend/README.md) | Trabalhar na interface. |

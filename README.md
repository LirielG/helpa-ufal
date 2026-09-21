# Helpa — Hub Estudantil de Laços, Participação e Ação

Plataforma de gestão de atividades de extensão e voluntariado da comunidade acadêmica da
UFAL — Campus Arapiraca. O Helpa centraliza a oferta de vagas em ações de extensão,
cursos, eventos e palestras, conduz a inscrição do estudante, registra a presença
homologada pelo gestor da ação e apura as horas complementares que viram certificado.

Além das ações criadas dentro da plataforma, o sistema também exibe as ações de extensão
publicadas no SIGAA da UFAL, coletadas por raspagem e mantidas em cache local —
veja [`backend/docs/SIGAA.md`](backend/docs/SIGAA.md).

O vocabulário do domínio (ação, inscrição, homologação, denúncia) está em
[`docs/GLOSSARY.md`](docs/GLOSSARY.md).

## Stack

| Camada | Tecnologias |
| --- | --- |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS v4, React Router, Zustand, React Hook Form + Zod |
| Backend | Node.js, Express 5, TypeScript em ESM nativo, Prisma 7, Zod |
| Banco | PostgreSQL 16 |
| Testes | Vitest nos dois lados; Testing Library + MSW no frontend, Supertest no backend |

## Pré-requisitos

- **Node.js** na versão do [`.nvmrc`](.nvmrc). Com o nvm: `nvm use`.
- **npm** (o repositório usa `package-lock.json`; não misture com yarn ou pnpm).
- **Docker** com Compose, para subir o PostgreSQL de desenvolvimento e o de teste.
  Um PostgreSQL 16 instalado na máquina também serve, desde que o `DATABASE_URL` aponte para ele.

## Como executar o projeto

O backend e o frontend são pacotes independentes, cada um com o seu `package.json`.
Rode os comandos abaixo dentro da pasta de cada um.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env          # preencha os valores; veja os comentários do arquivo
docker compose up -d postgres # PostgreSQL de desenvolvimento na porta 5432
npx prisma migrate dev        # cria o schema e gera o Prisma Client
npx prisma db seed            # cria o admin e algumas ações de exemplo
npm run dev
```

A API sobe em `http://localhost:3333` (ou na porta de `PORT`).

Duas coisas valem saber antes do primeiro `npm run dev`:

- `src/config/env.ts` valida todo o ambiente com Zod **no momento da importação**. Um
  `.env` incompleto derruba a subida com a lista do que falta, em vez de falhar na
  primeira requisição que precisava do valor.
- O seed só roda com `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `ADMIN_FULL_NAME` preenchidos, e
  a senha precisa passar na mesma política das senhas de usuário: no mínimo 8 caracteres
  ASCII imprimíveis, com maiúscula, minúscula, dígito e símbolo.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local    # opcional em desenvolvimento
npm run dev
```

A interface sobe em `http://localhost:5173`. Sem `VITE_API_URL`, o frontend cai no
padrão `http://localhost:3333` em modo de desenvolvimento
(`frontend/src/config/index.ts`).

O backend só aceita requisições com credencial vinda da origem configurada em
`CORS_ORIGIN`, que já vem apontada para `http://localhost:5173`. Trocar a porta do Vite
exige trocar essa variável também.

## Comandos

### `backend/`

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe a API com `tsx watch`. |
| `npm test` | Suíte unitária (`src/**/__tests__/`). Não precisa de banco. |
| `npm run test:watch` | Suíte unitária em modo watch. |
| `npm run test:integration` | Suíte de integração. Precisa do `postgres-test` no ar e **apaga os dados do banco de teste**. |
| `npm run test:all` | As duas suítes. |
| `npm run test:coverage` | Cobertura em `coverage/`. |
| `npm run test:db:up` | Sobe o container `postgres-test` (porta 5433). |
| `npm run test:db:down` | Para o container `postgres-test`. |
| `npm run format` / `format:check` | Prettier. |
| `npx prisma migrate dev` | Aplica as migrations pendentes e regenera o client. |
| `npx prisma db seed` | Roda `prisma/seed.ts`. |
| `npx prisma studio` | Abre o navegador de dados do Prisma. |

### `frontend/`

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento do Vite. |
| `npm run build` | `tsc -b` seguido do build do Vite, em `dist/`. |
| `npm run preview` | Serve o `dist/` já construído. |
| `npm run lint` | ESLint em todo o pacote. |
| `npm test` | Suíte de componentes e serviços (Vitest + Testing Library). |
| `npm run test:watch` | Suíte em modo watch. |
| `npm run test:coverage` | Cobertura em `coverage/`. |
| `npm run format` / `format:check` | Prettier. |

**Não há integração contínua neste repositório.** Nada roda sozinho no push ou no pull
request, então a verificação antes de pedir revisão é local:

```bash
cd backend  && npm test && npm run format:check
cd frontend && npm test && npm run lint && npm run format:check
```

## Estrutura do repositório

```
helpa-ufal/
├── backend/
│   ├── docs/            documentação da API (coleção Bruno, contrato, banco, SIGAA)
│   ├── prisma/          schema, migrations e seed
│   ├── src/             código da API, em camadas
│   └── tests/           suíte de integração e seus helpers
├── frontend/
│   ├── public/
│   └── src/             código da interface, em feature slices
├── docs/                documentação que vale para o projeto inteiro
└── README.md
```

O detalhamento de cada pasta está em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Modelo de dados

O schema completo é [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma), e
[`backend/docs/DATABASE.md`](backend/docs/DATABASE.md) explica as convenções. As entidades:

| Entidade | Papel |
| --- | --- |
| `User` | Conta de acesso. `userType` é `STUDENT` ou `TEACHER`; `isManager` habilita criar e gerir ações. |
| `Student` / `Teacher` | Dados específicos do perfil, um por usuário. |
| `Activity` | A ação em si: título, tipo, campus, período, vagas, status. |
| `ActivityDetails` | Descrição, área, formato, carga horária e endereço da ação. |
| `Address` | Endereço, referenciado por ações presenciais e híbridas. |
| `Enrollment` | Inscrição de um usuário em uma ação, com status, presença e horas homologadas. |
| `Certificate` | Certificado emitido a partir de uma inscrição concluída. |
| `ActivityReport` | Denúncia de uma ação, com motivo e resolução. |
| `SigaaActivity` | Cache das ações raspadas do SIGAA. Não é uma ação do Helpa. |

## Documentação

| Página | Leia quando |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | Começar a programar no projeto: convenções, camadas e as regras fáceis de errar. |
| [`docs/GLOSSARY.md`](docs/GLOSSARY.md) | Um termo do domínio for desconhecido ou dois parecerem a mesma coisa. |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Adicionar ou reorganizar uma funcionalidade, nos dois lados. |
| [`docs/TESTING.md`](docs/TESTING.md) | Escrever testes ou destravar uma suíte que está falhando. |
| [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md) | Preencher um `.env` ou entender o que cada variável controla. |
| [`docs/OPERATIONS.md`](docs/OPERATIONS.md) | Tratar de build de produção, deploy ou backup. |
| [`backend/docs/README.md`](backend/docs/README.md) | Abrir a coleção do Bruno e disparar requisições contra a API. |
| [`backend/docs/API.md`](backend/docs/API.md) | Mexer em rotas, autenticação, permissões ou formato de resposta. |
| [`backend/docs/DATABASE.md`](backend/docs/DATABASE.md) | Escrever uma migration, um seed ou uma query não trivial. |
| [`backend/docs/SIGAA.md`](backend/docs/SIGAA.md) | Trabalhar na integração com o SIGAA ou ela parar de funcionar. |
| [`frontend/README.md`](frontend/README.md) | Trabalhar na interface. |
| [`CHANGELOG.md`](CHANGELOG.md) | Saber o que mudou desde a sprint passada. |

Nem toda rota da coleção do Bruno já existe no backend — `backend/docs/README.md` diz
quais são contratos acordados e ainda não implementados.

## Guia de contribuição

### Branches principais

- **`main`** — produção. Só recebe código estável, revisado e aprovado, e só a partir da
  `development`, por pull request no fim da sprint.
- **`development`** — linha de integração. Toda tarefa nasce daqui e volta para cá.

### Fluxo de trabalho

Toda tarefa começa pela issue, para que o código fique ligado ao board:

1. Abra a issue atribuída a você no board (Backlog Helpa).
2. Na seção **Development**, na lateral direita da issue, clique em **Create a branch**.
3. Em **Change branch source**, troque para **`development`**. O padrão sugerido pelo
   GitHub pode não ser essa branch, e uma branch nascida de `main` gera conflito no PR.
4. Traga a branch para a sua máquina:

   ```bash
   git fetch origin
   git checkout nome-da-nova-branch
   ```

5. Faça commits em *Conventional Commits* (`feat:`, `fix:`, `docs:`, `test:`, `chore:`):

   ```bash
   git commit -m "feat: valida email no cadastro"
   ```

6. `git push origin sua-branch` e abra o pull request **apontando para `development`**.

### Regras

- Nenhum PR entra sem revisão de pelo menos uma outra pessoa do time.
- Conflito é resolvido por quem abriu o PR, na própria branch, antes da revisão final.
- Rode os testes e o formatador localmente antes de pedir revisão — não há CI para pegar
  o que passar.
- Comentários de código e nomes de teste em inglês; texto de interface em pt-BR.
  O porquê está em [`AGENTS.md`](AGENTS.md).

## Gestão ágil

O desenvolvimento é conduzido em Scrum, com sprints e issues no GitHub Projects:
https://github.com/users/LirielG/projects/3

## Equipe — UFAL Arapiraca

- Liriel Gomes — Product Owner e Lead Developer
- Anny Karoliny Germano Filgueiras
- Arthur Vinicius de Albuquerque Oliveira
- Carlos Eduardo Rocha Nunes
- Eric Soares dos Santos
- Gabryel Adriano Borges de Souza
- Jessica Pereira da Silva
- Joao Victor Rodrigues Alves
- Karol Cirilo Santana
- Lucas Ramos de Oliveira
- Maiky Araujo Brito

## Licença

MIT — veja [`LICENSE`](LICENSE).

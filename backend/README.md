# Helpa — Backend

API REST do **Helpa** construída com Node.js, Express, TypeScript e Prisma (PostgreSQL).

## Pré-requisitos

- **Node.js** 22+
- **PostgreSQL** 15+

---

## Executando em Produção

Em um servidor com Node.js, PostgreSQL e um arquivo `.env` (ou variáveis de ambiente do host) configurado:

```bash
# 1. Instala as dependências de forma reprodutível (e roda `prisma generate` via postinstall)
npm ci

# 2. Compila o TypeScript para `dist/` (excluindo testes) e resolve os aliases `@/`
npm run build

# 3. Aplica todas as migrations pendentes no banco de dados
npm run db:migrate

# 4. Cria (ou atualiza) apenas o usuário gestor inicial a partir de ADMIN_*
npx prisma db seed

# 5. Inicia o servidor HTTP compilado (`node dist/server.js`)
npm run start
```

> **Nota sobre o seed:** `npx prisma db seed` cria exclusivamente a conta do gestor (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FULL_NAME`). As atividades fictícias de demonstração ficam no script `npm run db:seed:demo`, que se recusa a rodar quando `NODE_ENV=production`.

---

## Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Aplicar migrations em desenvolvimento
npx prisma migrate dev

# Criar gestor + 5 atividades futuras de demonstração (apenas fora de produção)
npm run db:seed:demo

# Iniciar servidor em modo watch
npm run dev
```

### Testes

```bash
# Testes unitários
npm test

# Subir banco de testes de integração (Docker) e rodar testes de integração
npm run test:db:up
npm run test:integration
```

---

## Variáveis de Ambiente

Todas as variáveis são validadas na inicialização em [`src/config/env.ts`](src/config/env.ts). Se alguma variável obrigatória estiver ausente ou inválida, o servidor falha imediatamente no boot.

| Variável                | Obrigatória?                      | Default                                                                   | O que muda em produção / Observações                                                                                                                                                                                                                                 |
| :---------------------- | :-------------------------------- | :------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`              | Não                               | `"development"`                                                           | Definir como **`production`**. Ativa `secure: true` no cookie de sessão (exigindo HTTPS). Aceita `development`, `test` ou `production`.                                                                                                                              |
| `PORT`                  | Não                               | `3333`                                                                    | Porta HTTP na qual a API escuta (ou a porta injetada pelo provedor de hospedagem).                                                                                                                                                                                   |
| `DATABASE_URL`          | **Sim**                           | —                                                                         | URL de conexão com o banco PostgreSQL de produção (`postgresql://USER:PASSWORD@HOST:5432/DB?schema=public`).                                                                                                                                                         |
| `JWT_SECRET`            | **Sim**                           | —                                                                         | Segredo para assinar tokens JWT (mínimo de **32 caracteres**). Em produção, deve ser um valor aleatório forte e exclusivo.                                                                                                                                           |
| `JWT_EXPIRES_IN`        | Não                               | `"1d"`                                                                    | Tempo de validade do JWT e `maxAge` do cookie de sessão (formato `ms`, ex.: `"1d"`, `"12h"`).                                                                                                                                                                        |
| `CORS_ORIGIN`           | Não                               | `"http://localhost:5173"`                                                 | Em produção, definir com a origem pública do frontend (`https://seu-frontend.dominio.br`). Validada como URL `http(s)` e normalizada para `scheme://host[:port]`.                                                                                                    |
| `APP_PUBLIC_URL`        | Não                               | `"http://localhost:5173"`                                                 | Em produção, definir com a URL pública do frontend (`https://seu-frontend.dominio.br`), usada para montar o link de validação impresso no QR Code dos certificados em PDF. Mantém subpath se houver, remove barra final e recusa query string ou fragmento (`#`).    |
| `COOKIE_SAME_SITE`      | Não                               | `"strict"`                                                                | Política `SameSite` do cookie de sessão (`strict`, `lax` ou `none`). Em produção, se o frontend e a API estiverem em **sites/domínios diferentes**, deve ser **`none`**, que só funciona sobre **HTTPS** (`NODE_ENV=production` liga o atributo `secure` do cookie). |
| `SIGAA_SYNC_ENABLED`    | Não                               | `true`                                                                    | Habilita (`true`) ou desabilita (`false`) a sincronização de ações de extensão públicas do SIGAA.                                                                                                                                                                    |
| `SIGAA_BASE_URL`        | Não                               | `"https://sigaa.sig.ufal.br/sigaa/public/extensao/consulta_extensao.jsf"` | URL da página pública de consulta de ações de extensão do SIGAA.                                                                                                                                                                                                     |
| `SIGAA_CACHE_TTL_HOURS` | Não                               | `12`                                                                      | Tempo de vida (em horas, inteiro positivo) do cache das atividades sincronizadas do SIGAA.                                                                                                                                                                           |
| `ADMIN_EMAIL`           | **Sim no seed** (opcional na API) | —                                                                         | E-mail válido do gestor inicial criado por `npx prisma db seed`. Se faltar no momento do seed, o script falha com erro claro.                                                                                                                                        |
| `ADMIN_PASSWORD`        | **Sim no seed** (opcional na API) | —                                                                         | Senha do gestor inicial (mínimo de **8 caracteres**) usada por `npx prisma db seed`.                                                                                                                                                                                 |
| `ADMIN_FULL_NAME`       | **Sim no seed** (opcional na API) | —                                                                         | Nome completo do gestor inicial (1 a 160 caracteres) usado por `npx prisma db seed`.                                                                                                                                                                                 |

### Regra do Cookie de Sessão (`COOKIE_SAME_SITE` e HTTPS)

A autenticação utiliza um cookie `httpOnly` configurado em [`src/config/auth-cookie.ts`](src/config/auth-cookie.ts):

- **Mesmo site (same-site):** Quando o frontend e a API compartilham o mesmo domínio registrável (ex.: `helpa.ufal.br` e `api.helpa.ufal.br`), `COOKIE_SAME_SITE=strict` (default) ou `lax` funciona normalmente.
- **Sites diferentes (cross-site):** Quando o frontend e a API estão hospedados em domínios distintos (ex.: frontend em `helpa.vercel.app` e API em `helpa-api.onrender.com`), o navegador bloqueia o envio do cookie em requisições `fetch`/`XHR` com `credentials: "include"` a menos que `COOKIE_SAME_SITE=none` seja configurado.
- **Exigência de HTTPS:** Os navegadores rejeitam cookies com `SameSite=None` se não tiverem o atributo `Secure`. A API ativa `secure: true` automaticamente quando `NODE_ENV=production`; portanto, `COOKIE_SAME_SITE=none` exige `NODE_ENV=production` e tráfego via **HTTPS**.

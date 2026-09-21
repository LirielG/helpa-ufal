# Configuração e variáveis de ambiente

Cada pacote tem o seu próprio ambiente e o seu próprio `.env.example`. Esta página
explica o que cada variável controla e o que acontece quando ela está errada.

Os arquivos:

| Arquivo | Pacote | Commitado? | Para quê |
| --- | --- | --- | --- |
| `backend/.env` | backend | Não | Desenvolvimento local. |
| `backend/.env.example` | backend | Sim | Modelo comentado do `.env`. |
| `backend/.env.test` | backend | **Sim** | Suíte de integração. Não guarda segredo real. |
| `frontend/.env.local` | frontend | Não | Sobrescreve a URL da API, se necessário. |
| `frontend/.env.example` | frontend | Sim | Modelo do `.env.local`. |
| `frontend/.env.test` | frontend | **Sim** | Fixa a `VITE_API_URL` que os handlers do MSW esperam. |
| `.nvmrc` | raiz | Sim | Versão do Node usada pelo projeto. `nvm use` na raiz. |

Os dois `.env.test` são commitados de propósito: eles não contêm segredo, apenas as
credenciais do container descartável de teste e uma URL de API falsa. Commitá-los é o que
faz a suíte rodar igual na máquina de todo mundo.

## Como o backend lê o ambiente

`src/config/env.ts` faz três coisas, nesta ordem:

1. Se `NODE_ENV` estiver setado, carrega `.env.${NODE_ENV}` — é assim que a suíte de
   integração pega o `.env.test`.
2. Carrega o `.env`.
3. Valida tudo com Zod e exporta o objeto `env` já tipado e com os padrões aplicados.

A validação roda **na importação do módulo**, não na primeira requisição. Qualquer import
que alcance `env.ts` — o que inclui praticamente todo serviço — derruba o processo com a
lista do que está faltando. É deliberado: é melhor não subir do que subir pela metade e
falhar horas depois, na rota que precisava do valor.

Consequência prática nos testes: até a suíte unitária, que nunca abre conexão, precisa de
`DATABASE_URL` e `JWT_SECRET`. O `vitest.config.ts` injeta valores falsos justamente para
isso.

`prisma.config.ts` repete a mesma leitura de `.env`, porque a CLI do Prisma roda fora do
processo da aplicação.

## Variáveis do backend

### Obrigatórias

| Variável | Formato | O que acontece se estiver errada |
| --- | --- | --- |
| `DATABASE_URL` | String de conexão do PostgreSQL | O servidor não sobe. Com URL válida mas banco fora do ar, a falha aparece na primeira query. |
| `JWT_SECRET` | No mínimo 32 caracteres | O servidor não sobe. Trocar o valor invalida todas as sessões ativas. |

Gere o segredo com `openssl rand -hex 32`.

### Com valor padrão

| Variável | Padrão | O que controla |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test` ou `production`. Ver abaixo. |
| `PORT` | `3333` | Porta da API. |
| `JWT_EXPIRES_IN` | `1d` | Validade do token, no formato do pacote `ms`. |
| `COOKIE_SAME_SITE` | `strict` | Política SameSite do cookie de sessão. |
| `CORS_ORIGIN` | `http://localhost:5173` | Única origem autorizada a enviar credencial. |
| `SIGAA_SYNC_ENABLED` | `true` | Liga a sincronização com o SIGAA. |
| `SIGAA_BASE_URL` | consulta pública de extensão da UFAL | Página raspada. |
| `SIGAA_CACHE_TTL_HOURS` | `12` | Por quanto tempo o cache do SIGAA é considerado fresco. |

### Só para o seed

`ADMIN_EMAIL`, `ADMIN_PASSWORD` e `ADMIN_FULL_NAME` são lidas apenas por
`prisma/seed.ts`, que cria a primeira conta de gestor. São opcionais no schema, mas o
seed falha sem as três. A senha obedece à mesma política das senhas de usuário: no mínimo
8 caracteres ASCII imprimíveis, com maiúscula, minúscula, dígito e símbolo.

## O que `NODE_ENV` muda de verdade

Não é só um rótulo. Três comportamentos dependem dele:

- **`secure` do cookie de sessão** — só vira `true` em `production`. Ou seja, fora de
  produção o cookie trafega sem HTTPS, que é o que permite desenvolver em `http://localhost`.
- **Stack trace no erro 500** — só aparece no corpo da resposta em `development`.
- **Arquivo de ambiente carregado** — `NODE_ENV=test` faz o `env.ts` carregar o `.env.test`
  antes do `.env`.

## Cookie de sessão e CORS andam juntos

O token de sessão vai num cookie `httpOnly`, e não num header. Isso amarra três variáveis:

- `CORS_ORIGIN` precisa ser exatamente a origem do frontend. O valor é validado como URL
  http(s) e normalizado para `scheme://host[:port]` — path e barra final são descartados,
  porque o header `Origin` nunca os envia. É **uma** origem, não uma lista.
- `COOKIE_SAME_SITE=none` só funciona junto com `secure=true`, ou seja, com
  `NODE_ENV=production`. Em desenvolvimento, `none` produz um cookie que o navegador
  recusa, e o sintoma é um login que "funciona" mas deixa todas as rotas seguintes em 401.
- `strict` serve quando frontend e API estão na mesma origem; `none` é o que permite
  domínios diferentes, e aí não há como fugir do HTTPS.

Sintoma clássico: o login responde 200 mas nenhuma rota autenticada funciona. Quase sempre
é `CORS_ORIGIN` apontando para outra porta, ou um `SameSite` incompatível com o ambiente.

## Variáveis do frontend

Só existe uma:

| Variável | Padrão | O que controla |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:3333` em dev | URL base da API, sem barra no final. |

O padrão vem de `src/config/index.ts`, que decide pelo `import.meta.env.MODE`: em
desenvolvimento cai em `http://localhost:3333`; fora dele, em
`https://api.helpa.com/api` — um endereço que ainda não existe e que precisa ser revisto
quando houver ambiente de produção de verdade (ver [`OPERATIONS.md`](OPERATIONS.md)).

Duas regras do Vite que valem lembrar:

- Só variável com prefixo `VITE_` chega ao navegador.
- O valor é **embutido no bundle durante o build**, não lido em tempo de execução. Trocar
  a URL da API exige rebuild, e nada que seja segredo pode entrar aqui.

## Versão do Node

`.nvmrc` na raiz fixa a versão. Com o nvm:

```bash
nvm use
```

O repositório usa **npm** e `package-lock.json`. Instalar com yarn ou pnpm reescreve o
lockfile e tira o time da mesma árvore de dependências.

# Documentação da API

O contrato das rotas da API vive em [`bruno/`](./bruno), como uma coleção do
[Bruno](https://www.usebruno.com/) no formato `opencollection: 1.0.0`.

## Como abrir a coleção

1. Instale o Bruno.
2. **Open Collection** e selecione a pasta `backend/docs/bruno` deste repositório.
3. No seletor de environment (canto superior direito), escolha **local**.

O environment `local` aponta `baseUrl` para `http://localhost:3333`, que é onde o
`npm run dev` do `backend/` sobe o servidor.

## Autenticação

Não é preciso colar token na mão. A coleção usa `auth: bearer` com o token
`{{apiKey}}`, herdado por todos os requests, e o request
`Auth/Login with email and password` tem um script `after-response` que grava o
token da resposta na variável `apiKey` do environment.

Ou seja: rode o login uma vez e os requests autenticados seguintes já saem
assinados. Se começarem a voltar 401, é só rodar o login de novo — o token
expirou.

O `apiKey` é declarado como `secret` e nasce vazio no `environments/local.yml`.
Ele é preenchido apenas no seu Bruno local; nunca comite um valor nele.

## Organização

| Pasta | Conteúdo |
|---|---|
| `Activities/` | CRUD de ações, transição de status e denúncias |
| `Auth/` | Login e cadastro |
| `Enrollments/` | Inscrição e cancelamento em uma ação, mais os contratos de listagem e confirmação de presença |
| `User/` | Rotas de perfil do usuário |

Nem toda rota documentada aqui já existe no backend: `User/` inteira, mais
`Confirm Attendance` e `List Activity Enrollments`, são contratos acordados que
servem de referência para quem for implementá-los. Disparar esses requests
devolve 404.

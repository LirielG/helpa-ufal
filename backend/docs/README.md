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

Não é preciso copiar ou colar tokens manualmente. A API utiliza autenticação baseada em cookies HTTP. ao executar a requisição `Auth/Login with email and password`, o servidor retorna um cookie de sessão (`token`) que o *cookie jar* do Bruno armazena e reutiliza automaticamente nas requisições subsequentes.

Caso receba respostas com status `401 Unauthenticated`, basta executar a requisição de Login novamente para renovar a sessão.

O `apiKey` é declarado como `secret` e nasce vazio no `environments/local.yml`.
Ele é preenchido apenas no seu Bruno local; nunca comite um valor nele.

## Organização

| Pasta          | Conteúdo                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------- |
| `Activities/`  | CRUD de ações, transição de status e denúncias                                                |
| `Auth/`        | Login, cadastro e logout                                                                      |
| `Enrollments/` | Inscrição e cancelamento em uma ação, mais os contratos de listagem e confirmação de presença |
| `SIGAA/`       | Listagem das ações raspadas do SIGAA e os valores aceitos pelos filtros                       |
| `User/`        | Rotas de perfil do usuário                                                                    |

Nem toda rota documentada aqui já existe no backend: `User/` inteira, mais
`Confirm Attendance` e `List Activity Enrollments`, são contratos acordados que
servem de referência para quem for implementá-los. Disparar esses requests
devolve 404.

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

Não é preciso copiar nem colar token. A API autentica pelo cookie httpOnly
`token`, e a coleção não declara auth nem header de autenticação: rode
`Auth/Login with email and password` uma vez e o _cookie jar_ do Bruno guarda o
cookie e o envia nos requests seguintes.

Se os requests autenticados começarem a voltar 401, a sessão expirou: rode o
login de novo.

## Organização

| Pasta          | Conteúdo                                                                              |
| -------------- | ------------------------------------------------------------------------------------- |
| `Activities/`  | CRUD de ações, transição de status e denúncias                                        |
| `Auth/`        | Login, cadastro e logout                                                              |
| `Enrollments/` | Inscrição e cancelamento em uma ação, listagem de inscritos e confirmação de presença |
| `Reports/`     | Moderação de denúncias por gestores                                                   |
| `SIGAA/`       | Listagem das ações raspadas do SIGAA e os valores aceitos pelos filtros               |
| `User/`        | Rotas de perfil do usuário                                                            |

As regras gerais (paginação, envelope e formato de erro) ficam em
[`api-conventions.md`](./api-conventions.md); cada request documenta só o que é
próprio da rota.

Nem toda rota documentada aqui já existe no backend: em `User/`, só
`Get user's profile` está implementada. As demais são contratos acordados que
servem de referência para quem for implementá-los, e disparar esses requests
devolve 404.

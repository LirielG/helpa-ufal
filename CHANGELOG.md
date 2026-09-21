# Changelog

Mudanças relevantes do Helpa. O formato segue
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## Como manter

- Escreva a entrada **no próprio pull request**, junto com a mudança. Fazer isso depois, a
  partir do log do Git, custa muito mais e sempre perde alguma coisa.
- A entrada é para quem vai usar ou operar o sistema, não para quem escreveu o código.
  "Inscrição cancelada agora libera a vaga na hora" diz mais do que "refatora
  EnrollmentRepository".
- Uma linha por mudança, sob a seção certa: **Added** (funcionalidade nova),
  **Changed** (comportamento existente mudou), **Deprecated**, **Removed**,
  **Fixed** (correção de bug), **Security**.
- Refatoração que não muda nada para quem usa não entra. O Git já guarda isso.
- Mudança que quebra compatibilidade — formato de resposta, nome de campo, variável de
  ambiente nova obrigatória — entra sempre, e diz o que precisa ser feito.
- Ao fechar uma sprint, renomeie `[Unreleased]` para a versão e a data, e abra uma
  `[Unreleased]` vazia acima.

Não repita aqui o que já está no board: número de issue e nome de sprint pertencem ao
GitHub Projects.

## [Unreleased]

Ainda não houve release: a `main` não tem tag nem merge, e todo o trabalho até aqui vive na
`development`. As entradas abaixo resumem o que já está construído e servem de ponto de
partida — o histórico detalhado desse período está no log do Git.

### Added

- Cadastro e login de discente e docente, com sessão em cookie `httpOnly`.
- Criação, edição, listagem, detalhe e exclusão de ações, com busca, filtros por tipo,
  formato, status, campus e área, e paginação.
- Transição de status da ação: `OPEN` → `IN_PROGRESS` → `COMPLETED`, com cancelamento a
  partir dos dois primeiros.
- Inscrição e cancelamento de inscrição, com controle de vagas sob lock — duas inscrições
  simultâneas não estouram o limite.
- Listagem de inscritos para o autor da ação e para gestores, com total de presentes.
- Homologação de presença e horas, limitada à carga horária declarada pela ação.
- Denúncia de ação, com motivo e descrição opcional.
- Perfil do usuário (`GET /users/me`) e a tela de perfil no frontend.
- Feed das atividades de extensão do SIGAA, por raspagem com cache de 12 horas e filtros
  próprios.
- Coleção do Bruno em `backend/docs/bruno` como documentação das rotas.
- Documentação do projeto: `AGENTS.md`, `docs/` e as páginas em `backend/docs/`.

### Fixed

- Matrícula duplicada no cadastro respondia 500; agora responde 409 com mensagem própria.
- Cadastro não exigia mais estar autenticado, e passou a redirecionar para o login.
- Paginação do feed não saía da primeira página.

### Security

- Nenhuma resposta devolve objeto do Prisma direto, e a listagem de inscritos carrega
  apenas os campos necessários — `passwordHash` não sai do banco.
- Violação de restrição única responde 409 com mensagem de uma whitelist fechada, sem
  ecoar nome de coluna interna.
- A raspagem do SIGAA mantém a verificação TLS ligada, com o certificado intermediário que
  o servidor não envia empacotado no repositório.

[Unreleased]: https://github.com/LirielG/helpa-ufal/compare/main...development

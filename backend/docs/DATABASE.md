# Banco de dados

PostgreSQL 16 acessado pelo Prisma 7 com o adaptador `@prisma/adapter-pg`
(`src/database/prisma.ts`). O schema é [`../prisma/schema.prisma`](../prisma/schema.prisma).

O significado de cada entidade está em [`../../docs/GLOSSARY.md`](../../docs/GLOSSARY.md).
Esta página trata do banco: como subir, migrar, semear e as convenções que uma query nova
precisa respeitar.

## Subindo os bancos

O `docker-compose.yml` deste pacote descreve dois:

| Serviço | Porta | Banco | Volume |
| --- | --- | --- | --- |
| `postgres` | 5432 | `helpa` | `postgres_data`, persistente |
| `postgres-test` | 5433 | `helpa_test` | `tmpfs` — **some quando o container para** |

```bash
docker compose up -d postgres       # desenvolvimento
npm run test:db:up                  # teste (atalho para o postgres-test)
```

O banco de teste em `tmpfs` é de propósito: ele vive em memória, é rápido e não deixa
rastro. Também significa que não adianta inspecionar dados de um teste depois que o
container parou.

As credenciais do compose são `postgres:postgres`, o que combina com a `DATABASE_URL` do
`.env.test` commitado. Para o banco de desenvolvimento:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/helpa?schema=public"
```

Um PostgreSQL instalado na máquina serve igual, desde que a `DATABASE_URL` aponte para ele.

## Migrations

O Prisma lê a configuração de `prisma.config.ts`, que carrega o `.env` por conta própria —
a CLI roda fora do processo da aplicação e não passa pelo `src/config/env.ts`.

```bash
npx prisma migrate dev --name descreve_a_mudanca   # cria e aplica em desenvolvimento
npx prisma migrate deploy                          # aplica as pendentes, sem gerar nada
npx prisma migrate reset                           # apaga tudo, remigra e roda o seed
npx prisma generate                                # regenera o client sozinho
npx prisma studio                                  # navegador de dados
```

`migrate dev` já regenera o client. Depois de trocar de branch e puxar migrations novas, é
ele que você quer — `generate` sozinho atualiza os tipos mas deixa o banco para trás, e o
sintoma é um erro de coluna inexistente em tempo de execução, com o TypeScript feliz.

A suíte de integração roda `prisma migrate deploy` sozinha, no `globalSetup`. Não é preciso
preparar o banco de teste à mão.

### Escrevendo uma migration

- Uma migration por mudança, com nome que descreva a mudança. O histórico atual segue isso
  (`add_soft_delete_to_activity`, `add_confirmed_workload_hours_to_enrollment`).
- Migration aplicada **não se edita**. Corrija com uma nova.
- Coluna nova em tabela com dados precisa de valor padrão ou de ser opcional.
- `migrate reset` apaga os dados. Nunca aponte para um banco que não seja descartável.

## Seed

`prisma/seed.ts`, registrado em dois lugares — no campo `prisma.seed` do `package.json` e
em `prisma.config.ts`.

```bash
npx prisma db seed
```

O que ele cria:

- Uma conta de gestor a partir de `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `ADMIN_FULL_NAME` — um
  `TEACHER` com `isManager: true` e um registro `Teacher` associado. Sem as três variáveis,
  o seed falha com a lista do que falta.
- Dois endereços (campus Arapiraca e campus A. C. Simões).
- Cinco ações de exemplo, uma de cada tipo e formato, todas em `OPEN`.

Tudo por `upsert` com id fixo, então rodar o seed duas vezes não duplica nada. É por isso
que os ids do seed são UUIDs escritos à mão (`00000000-0000-4000-8000-000000000001`) em vez
de gerados: sem um id estável, não há como fazer upsert.

A senha do admin obedece à mesma política das senhas de usuário: no mínimo 8 caracteres
ASCII imprimíveis, com maiúscula, minúscula, dígito e símbolo.

## Convenções do schema

### Identificador público é UUID

Toda chave primária é `String @default(uuid())`. Não há id sequencial exposto — nenhuma URL
revela quantas ações existem, e adivinhar um id vizinho é inviável.

`src/utils/uuid.ts` valida o formato antes de qualquer consulta. A convenção do backend é
que **id malformado responde 404**, não 400: uma busca com id torto é uma busca que não acha
nada, e diferenciar os dois contaria ao cliente que o id existe em algum formato.

### `Activity` tem soft delete

Excluir uma ação preenche `deletedAt`. A linha continua no banco.

**Toda consulta de `Activity` precisa filtrar `deletedAt: null`.** Esquecer isso é o erro
mais fácil de cometer aqui — a ação volta a aparecer no feed depois de excluída, e nenhum
teste que só olha o caminho feliz pega.

Note que só `Activity` tem soft delete por coluna. A inscrição tem o equivalente pelo
status `CANCELLED`, que é o mesmo conceito com outro mecanismo.

### `ActivityDetails` é uma tabela à parte

A ação é partida em duas: `Activity` guarda o que a listagem precisa; `ActivityDetails`
(mapeada como `activity_details`), o que só a tela de detalhe precisa. A relação é
um-para-um e opcional no schema.

Na prática o código trata a ausência de `details` como "sem carga horária declarada" — um
teto de 0 horas na homologação, que rejeita qualquer valor.

### `availableSlots` não existe no banco

É calculado como `slots` menos as inscrições `APPROVED`, em toda consulta que devolve uma
ação, e clampado em 0 com `Math.max`. Não crie coluna para ele: um contador denormalizado
precisaria ser mantido em sincronia dentro de cada transação de inscrição e cancelamento.

### Duas tabelas com `@@map`

`ActivityDetails` → `activity_details` e `SigaaActivity` → `sigaa_activities`. Todo o resto
usa o nome do modelo. Isso importa em query raw, onde o nome da tabela vai literal.

### Unicidade

| Tabela | Restrição | Efeito |
| --- | --- | --- |
| `User` | `email` | Cadastro duplicado responde 409. |
| `Student` / `Teacher` | `registrationCode`, `cndb` | Matrícula e CNDB únicos. |
| `Enrollment` | `(userId, activityId)` | Uma inscrição por pessoa por ação. |
| `ActivityReport` | `(userId, activityId)` | Uma denúncia por pessoa por ação. |
| `Certificate` | `enrollmentId`, `validationCode` | Um certificado por inscrição. |

Violação de unicidade (P2002) **não precisa de try/catch no repositório**: o
`prismaErrorHandler` a converte em 409 centralmente, com uma whitelist fechada de campos
para a mensagem. Ver [`API.md`](API.md).

## Concorrência: a regra de ordem de lock

Esta é a convenção mais importante do backend e a mais fácil de quebrar sem perceber.

> **Em qualquer transação que também toque `Enrollment`, a linha de `Activity` é sempre a
> primeira travada.**

Ela está escrita em `src/repositories/enrollment/locks.ts`, que expõe as duas únicas
funções que abrem o lock:

| Função | Trava e lê | Usada por |
| --- | --- | --- |
| `lockActivityForCapacity` | `slots` e `status` da `Activity` | inscrição |
| `lockActivityForAttendance` | `status` e o `workloadHours` de `activity_details` | homologação de presença |

Ambas usam `SELECT ... FOR UPDATE`. `lockActivityForAttendance` trava com `FOR UPDATE OF a`
— só a linha de `Activity`; `activity_details` é lido, nunca travado — justamente para
manter a ordem.

### Por que isso existe

Sem o lock, duas inscrições simultâneas leem a mesma contagem de aprovados, ambas concluem
que há vaga e ambas gravam. A ação estoura o limite de vagas sem nenhum erro.

O padrão em todo repositório que abre transação é:

1. Travar a `Activity` **antes de qualquer leitura**.
2. Reler, sob o lock, os valores de que a decisão depende.
3. Decidir e gravar.

A verificação que já existe no serviço **não é redundante**: ela é o caminho rápido, que
falha sem abrir transação. A verificação sob o lock é a que vale, porque é a única que lê
um valor garantidamente atual.

### O que quebra se a ordem for invertida

Uma transação que trave `Enrollment` antes de `Activity` cria deadlock com todas as que já
existem. O PostgreSQL detecta e aborta uma das duas, então o sintoma é um erro intermitente
sob carga — o tipo de bug que não aparece em desenvolvimento e não é reproduzido por
nenhum teste de integração, que roda serial.

### Outras garantias de atomicidade

Nem todo caso precisa de lock explícito. Duas alternativas em uso:

- **Cancelamento** usa `updateMany` com o status no `where`. Dois cancelamentos simultâneos
  produzem um sucesso e um 404, sem janela de corrida, porque a transição
  `{APPROVED, PENDING} → CANCELLED` acontece numa única instrução.
- **Homologação** grava o par `(attendanceConfirmed, confirmedWorkloadHours)` numa única
  instrução, com as condições no `where`. Não existe caminho que escreva uma coluna sem a
  outra, e uma inscrição que deixou de ser `APPROVED` simplesmente não é escrita.

Quando der para colocar a guarda no `where` de um `updateMany`, prefira isso a ler,
decidir e escrever.

## Convenções de query

- **Só o repositório chama o Prisma.** O serviço pode abrir `$transaction` e passar o `tx`
  adiante, mas não monta query.
- **`select`, não `include`, quando a query encosta em `User`.** `include` traz
  `passwordHash` junto. O tipo `EnrollmentWithParticipant` é construído com `select` para
  que a senha não entre nem na memória do processo — o tipo sequer consegue expressá-la.
- **Busca com escopo, não busca por id.** `findByIdAndActivity` usa `findFirst` com
  `{ id, activityId }` em vez de `findUnique` por id: uma inscrição de outra ação precisa
  ser indistinguível de uma que não existe.
- **Paginação sempre com ordenação estável.** A listagem de inscritos ordena por
  `[enrolledAt asc, id asc]` — sem o desempate por id, duas linhas com o mesmo instante
  podem trocar de página entre requisições.
- **Totais vêm do banco, não da página.** `total` e `totalPresent` são contagens sobre toda
  a ação, calculadas na mesma `$transaction` da listagem, para que as três leituras vejam o
  mesmo estado.

## Datas

As colunas são `DateTime` e o Prisma trabalha com `Date` do JavaScript, em UTC. O que chega
por HTTP é convertido por `z.coerce.date()` no schema.

A formatação para o usuário é responsabilidade do frontend — a suíte de teste dele fixa
`TZ: "America/Maceio"` no `vite.config.ts` justamente para que isso seja testável.

## Reset do banco nos testes

`tests/setup/resetDatabase.ts` faz `TRUNCATE ... RESTART IDENTITY CASCADE` em todas as
tabelas de `public`, menos `_prisma_migrations`, **antes de cada teste** — não a cada
arquivo, para que nenhum teste dependa do que outro deixou.

Há uma trava explícita no `globalSetup`: se o nome do banco na `DATABASE_URL` não terminar
em `_test`, a suíte recusa a rodar. Vale a pena conhecê-la, porque é o que separa "rodei os
testes" de "apaguei o banco de desenvolvimento".

Ver [`../../docs/TESTING.md`](../../docs/TESTING.md).

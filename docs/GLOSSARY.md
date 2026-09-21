# Glossário do domínio

O Helpa é bilíngue por construção: o código, os identificadores e os nomes de teste são em
inglês; a interface e as conversas da equipe são em português. Esta página amarra os dois
lados, para que ninguém precise adivinhar se "ação" e `Activity` são a mesma coisa.

Cada termo traz o nome usado na interface, o nome no código e a regra que o define.
Quando a regra estiver implementada em algum lugar específico, o arquivo está citado.

## Pessoas

### Usuário — `User`

Conta de acesso. Todo usuário tem um `userType`, e a distinção é de vínculo, não de poder:

| Interface | `UserType` | Tabela de perfil |
| --- | --- | --- |
| Discente, aluno | `STUDENT` | `Student` — matrícula (`registrationCode`) e curso, ambos obrigatórios |
| Docente, professor | `TEACHER` | `Teacher` — matrícula, CNDB e curso **opcional** |

### Gestor — `isManager`

Um booleano em `User`, **não** um tipo de usuário. Gestor é quem pode agir sobre ações que
não criou: ver a lista de inscritos, homologar presença, editar, transicionar status e
excluir.

O par que aparece em quase toda regra de autorização do backend é "autor **ou** gestor":

```ts
if (activity.authorId !== userId && !user.isManager) { /* 403 */ }
```

O seed cria a primeira conta de gestor (um `TEACHER` com `isManager: true`) a partir de
`ADMIN_EMAIL`, `ADMIN_PASSWORD` e `ADMIN_FULL_NAME`.

### Autor — `authorId`

Quem criou a ação. Um campo em `Activity`, não um papel guardado em `User`: a mesma pessoa
é autora de uma ação e simples inscrita em outra.

## Ações

### Ação — `Activity` (+ `ActivityDetails`)

A unidade central do sistema: uma atividade que aceita inscrição e gera horas. "Ação",
"atividade" e "oportunidade" são a mesma coisa nas conversas do time — no código é sempre
`Activity`.

O registro é partido em duas tabelas, e a divisão importa na hora de escrever query:

| `Activity` | `ActivityDetails` |
| --- | --- |
| `title`, `type`, `campus`, `startDate`, `endDate`, `slots`, `status` | `description`, `area`, `format`, `url`, `workloadHours`, `addressId` |
| o que a listagem do feed precisa | o que só a tela de detalhe precisa |

A relação é um-para-um e `ActivityDetails` é opcional no schema. Na prática o código trata
a ausência como "ação sem carga horária declarada" — na homologação, um teto de 0 horas,
que rejeita qualquer valor.

### Tipo — `ActivityType`

`EXTENSION`, `COURSE`, `EVENT`, `LECTURE`, `OTHER`. Diz que espécie de atividade é:
extensão, curso, evento, palestra ou outra.

### Área — `area`

Texto livre em `ActivityDetails` ("Educação", "Meio Ambiente e Sustentabilidade"). Não é
enum: os valores oferecidos no filtro do feed são os que já existem no banco, apurados por
`GET /activities/filters`.

### Formato — `ActivityFormat`

`IN_PERSON`, `ONLINE` ou `HYBRID`, e é ele que decide o que mais a ação precisa ter:

| Formato | Endereço | URL |
| --- | --- | --- |
| `IN_PERSON` | obrigatório | opcional |
| `ONLINE` | ignorado — se a ação virar online, o endereço existente é apagado | obrigatória |
| `HYBRID` | obrigatório | obrigatória |

As regras estão em `CreateActivitySchema` (uma união discriminada por `format`) e em
`ActivityService.update`, que reavalia a combinação contra o **estado salvo**, e não só
contra o que veio no corpo da requisição.

### Campus — `CampusLocation`

Enum dos campi da UFAL: `MACEIO`, `ARAPIRACA`, `PALMEIRA`, `PENEDO`, `RIO_LARGO`,
`DELMIRO_GOUVEIA`, `SANTANA_IPANEMA`. É a lotação da ação, não o endereço dela — endereço é
`Address`, e ação online não tem nenhum dos dois obrigatoriamente.

### Status da ação — `ActivityStatus`

`OPEN`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`. O ciclo é de mão única:

```
OPEN ──> IN_PROGRESS ──> COMPLETED
  │            │
  └──────> CANCELLED <──┘
```

`COMPLETED` e `CANCELLED` são terminais: dali não se sai, e a ação também não pode mais ser
editada. As transições permitidas estão em `allowedTransitions`, em
`src/schemas/activity/ActivitySchemas.ts`.

O status é o que libera ou trava cada operação:

| Operação | Só quando a ação está |
| --- | --- |
| Inscrever-se, cancelar inscrição | `OPEN` |
| Editar | `OPEN` ou `IN_PROGRESS` |
| Homologar presença | `COMPLETED` |

### Vagas — `slots` e `availableSlots`

`slots` é o total declarado e fica no banco. `availableSlots` é **calculado**
(`slots` menos as inscrições `APPROVED`) e só existe na resposta da API — não há coluna
para ele.

Consequência na edição: `slots` não pode ser reduzido abaixo do número de inscrições já
aprovadas.

### Carga horária — `workloadHours`

Horas que a ação vale, declaradas em `ActivityDetails`. Serve de **teto** para a
homologação: ninguém recebe mais horas do que a ação oferece. Não pode passar da duração
total da ação em horas nem de 8.760 (as horas de um ano).

Não confundir com `confirmedWorkloadHours`, que é o que cada inscrito de fato recebeu.

### Exclusão de ação — soft delete

Excluir uma ação preenche `deletedAt`; a linha continua no banco. Toda consulta precisa
filtrar `deletedAt: null`, e uma ação excluída responde 404 como se nunca tivesse
existido. Ver [`../backend/docs/DATABASE.md`](../backend/docs/DATABASE.md).

## Inscrição

### Inscrição — `Enrollment`

Liga um usuário a uma ação. O par `(userId, activityId)` é único: a mesma pessoa tem no
máximo uma linha por ação, e reinscrever-se reaproveita a linha existente em vez de criar
outra.

### Status da inscrição — `EnrollmentStatus`

`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`.

**No MVP a inscrição já nasce `APPROVED`** — não existe fila de aprovação. Os quatro
valores estão no schema porque a aprovação pelo criador da ação é trabalho previsto;
quando ela chegar, muda-se `ENROLLMENT_INITIAL_STATUS` para `PENDING`
(`src/types/enrollment.ts`). O que não muda é a contagem de vagas: **só `APPROVED` ocupa
vaga**, hoje e depois.

`CANCELLED` é o soft delete da inscrição: cancelar transita `APPROVED` ou `PENDING` para
`CANCELLED` e devolve a vaga, preservando o histórico.

### Presença — `attendanceConfirmed`

Campo de **três estados**, e a diferença entre dois deles é a informação que importa:

| Valor | Significa |
| --- | --- |
| `null` | Ninguém se pronunciou ainda. |
| `true` | Presença homologada. |
| `false` | Falta registrada — alguém olhou e disse que a pessoa não foi. |

`null` e `false` não são a mesma coisa: um é silêncio, o outro é uma decisão.

### Homologação de presença — `confirmAttendance`

O ato do autor ou gestor de fechar a presença de um inscrito e dizer quantas horas ele
recebe. É a operação com mais pré-condições do sistema, e todas são verificadas nesta
ordem (`EnrollmentService.confirmAttendance`):

1. A ação existe (404).
2. A inscrição existe e pertence à ação (404).
3. Quem pede é o autor ou um gestor (403).
4. A ação está `COMPLETED` (409).
5. A inscrição está `APPROVED` (409).
6. O corpo é coerente (422).

O corpo carrega o resultado, nunca o alvo:

- `attended: false` → `workloadHours` **precisa ser omitido**, e o registro guarda 0 horas.
- `attended: true` → `workloadHours` é obrigatório, inteiro, de 1 até o `workloadHours` da
  ação.

O par gravado é sempre `(true, n ≥ 1)` ou `(false, 0)`. Nunca `(true, 0)`.

### Horas homologadas — `confirmedWorkloadHours`

As horas que aquele inscrito de fato recebeu. Só tem significado quando
`attendanceConfirmed` é `true`; nos outros casos é 0 por construção, não por acaso.

É daqui que saem as horas complementares do estudante.

### Total de presentes — `totalPresent`

Na listagem de inscritos, a contagem de `attendanceConfirmed = true` em **toda** a ação,
não só na página atual. Vem pronta do repositório; o serviço não a recalcula.

## Outros conceitos

### Denúncia — `ActivityReport`

Registro de que alguém reportou uma ação. `category` é um `ReportReason`: `SPAM`,
`INAPPROPRIATE_CONTENT`, `MISINFORMATION`, `DUPLICATE` ou `OTHER`, com `description`
opcional.

O par `(userId, activityId)` é único: uma denúncia por pessoa por ação.

Os campos de moderação (`resolvedAt`, `resolvedById`) existem no schema mas **ainda não são
usados** por nenhuma rota — não há tela nem endpoint de resolução de denúncia.

### Certificado — `Certificate`

Documento emitido a partir de uma inscrição concluída, com `validationCode` único para
conferência. **Modelado, ainda não emitido**: existe a tabela, não existe rota nem serviço
que crie um. A aba de certificados no perfil do frontend ainda não tem backend por trás.

### Horas complementares

O objetivo final do produto: as horas que o estudante acumula participando de ações e
apresenta ao seu curso. Não são uma entidade do banco — são a soma dos
`confirmedWorkloadHours` das inscrições da pessoa.

### Ação do SIGAA — `SigaaActivity`

**Não é uma ação do Helpa.** É uma linha de cache de uma atividade de extensão publicada
no SIGAA da UFAL, coletada por raspagem para aparecer no feed junto das ações nativas.

Ninguém se inscreve numa `SigaaActivity`, ela não tem vagas, status nem carga horária, e
nada nela vira hora complementar. Os campos próprios:

| Campo | Papel |
| --- | --- |
| `sigaaId` | Identificador no SIGAA. É por ele que o cache reconhece a mesma atividade. |
| `type` | O texto do tipo como o SIGAA escreve. |
| `normalizedType` | O `ActivityType` correspondente, para o filtro do feed funcionar igual dos dois lados. |
| `isActive` | Se a atividade ainda apareceu na última coleta. |
| `lastSeenAt` | Quando foi vista pela última vez. |

Ver [`../backend/docs/SIGAA.md`](../backend/docs/SIGAA.md).

### Feed

A listagem da tela inicial. Tem duas abas — as ações do Helpa e as do SIGAA — servidas por
rotas diferentes (`GET /activities` e `GET /sigaa-activities`) com filtros parecidos, mas
não iguais.

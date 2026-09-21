# Operação

**O Helpa ainda não tem ambiente de produção.** Não há servidor, domínio, pipeline de
deploy nem release: a `main` não tem tag nem merge, e todo o trabalho vive na
`development`.

Esta página tem duas metades. A primeira registra o que já está decidido e verificável no
repositório. A segunda lista, de forma explícita, o que **falta decidir** — porque uma
lacuna registrada é mais útil do que um silêncio que cada pessoa preenche de um jeito.

Enquanto o deploy não existir, esta página é uma lista de pendências. Ela deve ser
reescrita, e não apenas completada, quando houver ambiente de verdade.

## O que já está decidido

### Build do frontend

```bash
cd frontend
npm run build      # tsc -b && vite build, saída em dist/
npm run preview    # serve o dist/ localmente, para conferir antes de publicar
```

O `dist/` é ignorado pelo Git nos dois pacotes: o artefato é gerado, nunca commitado.

O resultado é estático — HTML, JS e CSS — e pode ser servido por qualquer servidor de
arquivos. Como o roteamento é client-side (React Router), o servidor precisa devolver o
`index.html` para qualquer caminho desconhecido; sem esse *fallback*, abrir
`/activity/<id>` direto na barra de endereço responde 404.

**A `VITE_API_URL` é embutida no bundle no momento do build**, não lida em tempo de
execução. Cada ambiente precisa do seu próprio build, e trocar a URL da API exige
reconstruir.

### Banco

Migrations em produção se aplicam com:

```bash
npx prisma migrate deploy
```

`migrate deploy` só aplica o que está pendente: não gera migration nova e não apaga nada.
É o comando certo para ambiente que não é o da pessoa desenvolvendo — `migrate dev` e
`migrate reset` nunca devem chegar perto de um banco com dados reais.

### Segredos

- `JWT_SECRET` — trocar invalida **todas as sessões ativas**, e todo mundo cai no login.
  Não há revogação seletiva nem refresh token.
- `ADMIN_PASSWORD` — só é lida pelo seed, no momento em que a conta de gestor é criada.
  Trocar a variável depois não muda a senha da conta; isso precisa ser feito pela
  aplicação.

Nenhum segredo entra no build do frontend: só variáveis `VITE_` chegam ao navegador, e
nenhuma delas é secreta hoje.

### Comportamento em `NODE_ENV=production`

- O cookie de sessão passa a exigir HTTPS (`secure: true`). Servir a API em HTTP puro em
  produção faz o navegador recusar o cookie, e o sintoma é login que responde 200 seguido
  de 401 em tudo.
- A resposta de erro 500 deixa de trazer o `stack`.

### Diagnóstico de subida

`src/config/env.ts` valida o ambiente na importação e derruba o processo listando o que
falta. Isso vale como verificação de configuração: se a API subiu, o ambiente está
completo. Ver [`CONFIGURATION.md`](CONFIGURATION.md).

## O que falta decidir

### 1. O backend não tem build nem start de produção

`backend/package.json` tem `dev`, testes e formatação. **Não tem `build` nem `start`.** Hoje
a única forma de executar o backend é `tsx watch`, que é ferramenta de desenvolvimento.

Não é só adicionar `tsc` ao `package.json`. O `tsconfig.json` declara o alias
`"@/*": ["./src/*"]`, e o `tsc` **não reescreve esse alias na saída**: o JavaScript
compilado sai com `import ... from "@/config/env.js"`, que o Node não resolve. Em
desenvolvimento isso funciona porque o `tsx` resolve os paths do tsconfig em tempo de
execução.

Os caminhos possíveis:

- Adicionar `tsc-alias` ao build (`tsc && tsc-alias`), que reescreve os aliases para
  caminhos relativos na saída.
- Usar um empacotador (tsup, esbuild) que resolva os aliases ao empacotar.
- Declarar `imports` (subpath imports) no `package.json`, que o Node resolve nativamente, e
  abandonar o alias do tsconfig.

Qualquer um resolve; nenhum foi escolhido. **Enquanto isso não for decidido, não há como
publicar o backend**, e o resto desta seção depende disso.

### 2. Onde roda

Não há decisão sobre servidor, contêiner ou serviço gerenciado. O `docker-compose.yml`
do backend descreve **apenas os bancos de desenvolvimento e de teste** — não é um compose
de produção, e o banco de teste usa `tmpfs`, ou seja, perde tudo ao parar.

Falta definir: onde a API roda, o que a mantém no ar (systemd, PM2, orquestrador), onde os
arquivos do frontend são servidos, e quem termina o TLS.

### 3. A URL de produção do frontend é um endereço inventado

`frontend/src/config/index.ts` cai em `https://api.helpa.com/api` fora do modo de
desenvolvimento. Esse domínio não existe e o sufixo `/api` não corresponde a nenhum prefixo
da API — as rotas são servidas na raiz. É um valor de rascunho que precisa ser trocado
quando houver endereço real.

### 4. Backup

Não há rotina de backup do PostgreSQL, nem definição de com que frequência, para onde, por
quanto tempo, e quem testa a restauração. Backup que nunca foi restaurado não é backup.

O mínimo para começar é um `pg_dump` periódico com destino fora da máquina do banco.

### 5. Migrations em ambiente compartilhado

Falta decidir quem aplica `migrate deploy` e quando: no deploy automático, num passo
manual, antes ou depois de subir a versão nova do código. Migration que remove ou renomeia
coluna precisa de janela ou de estratégia em duas etapas para não quebrar a versão ainda em
execução.

### 6. Monitoramento

Não há healthcheck (`/health` não existe), log estruturado — o backend usa `console.log` e
`console.error` — nem coleta de erro. Não há como saber que a API caiu sem alguém abrir o
site.

O primeiro passo barato é uma rota de liveness e outra que toque o banco.

### 7. Rollback

Sem versionamento de release, não há a que voltar. Um esquema de tags no Git é o
pré-requisito, e o [`../CHANGELOG.md`](../CHANGELOG.md) já está preparado para receber a
primeira versão quando ela existir.

## Ao preencher esta página

Quando cada decisão for tomada, mova o item da segunda metade para a primeira e escreva o
procedimento — o comando, não a intenção. E registre a mudança no
[`../CHANGELOG.md`](../CHANGELOG.md), porque variável nova obrigatória ou passo novo de
deploy afeta todo mundo que sobe o projeto.

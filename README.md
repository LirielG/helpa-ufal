
# Helpa - Hub de Extensão e Atividades Acadêmicas

O Helpa é uma plataforma de gestão de atividades de extensão e voluntariado desenvolvida para a comunidade acadêmica da UFAL - Campus Arapiraca. O sistema visa centralizar a oferta de vagas em projetos, facilitar a inscrição de estudantes e automatizar a contabilização de horas complementares.

## Tecnologias Utilizadas

O projeto utiliza uma arquitetura baseada em TypeScript para garantir segurança e escalabilidade.

### Frontend
- React + TypeScript: Interface reativa e tipagem estática.
- Vite: Ferramenta de build de alta performance.
- Tailwind CSS v4: Estilização via utilitários com plugin oficial para Vite.

### Backend
- Node.js + Express: Servidor para a API REST.
- TypeScript: Tipagem estática em todo o servidor.
- TSX: Executor de TypeScript para ambiente de desenvolvimento.

### Base de Dados
- PostgreSQL: Banco de dados relacional para integridade de dados e certificados.

## Estrutura do Repositório

O projeto utiliza um modelo de Monorepo para facilitar a gestão do código:

helpa-ufal/

├── frontend/     # Interface do usuário (React)

├── backend/      # API e lógica de negócio (Node.js)

└── README.md     # Documentação geral do projeto

## Como Executar o Projeto

### Pré-requisitos
- Node.js (v22.12.0 ou superior)
- npm ou yarn

### 1. Configuração do Frontend
Dentro da pasta frontend:
1. npm install
2. npm run dev
O frontend estará disponível em http://localhost:5173.

### 2. Configuração do Backend
Dentro da pasta backend:
1. npm install
2. npm run dev
O servidor iniciará em http://localhost:3333.

## Modelo de Dados (MVP)

A estrutura inicial da base de dados contempla as seguintes entidades:

- Usuario: Alunos (voluntários) e Gestores de projetos.
- Projeto: Entidades de extensão ou eventos.
- Oportunidade: Vagas específicas abertas pelos projetos.
- Inscricao: Registro de participação, gestão de voluntariado e certificados.

## Gestão Ágil

O desenvolvimento é gerido através de Metodologias Ágeis (Scrum), utilizando o GitHub Projects para o acompanhamento de Sprints e Issues.
https://github.com/users/LirielG/projects/3

## Equipe - UFAL Arapiraca

- Liriel Gomes : Product Owner e Lead Developer
- ANNY KAROLINY GERMANO FILGUEIRAS
- ARTHUR VINICIUS DE ALBUQUERQUE OLIVEIRA
- CARLOS EDUARDO ROCHA NUNES
- ERIC SOARES DOS SANTOS
- GABRYEL ADRIANO BORGES DE SOUZA
- JESSICA PEREIRA DA SILVA
- JOAO VICTOR RODRIGUES ALVES
- KAROL CIRILO SANTANA
- LUCAS RAMOS DE OLIVEIRA
- MAIKY ARAUJO BRITO

-----------------------------------
##Guia de Contribuição

### 🛠️ Fluxo de Versionamento Git - Projeto Helpa

Para garantir a integridade do código e facilitar a colaboração entre os times de Frontend e Backend, adotaremos o seguinte padrão de ramificação (*branching*):

#### 1. As Branches Principais
* **`main`**: É a nossa branch de produção. Ela contém apenas código estável, revisado e aprovado. Ninguém deve fazer *commit* direto nela. Ela só recebe atualizações vindas da `develop` através de Pull Requests oficiais no final de cada sprint.
* **`develop`**: É a nossa "linha de montagem". Todos os novos recursos e correções devem ser integrados aqui primeiro. É a branch padrão de onde as novas tarefas devem nascer.

#### 2. Fluxo de Trabalho (Criando a partir da Issue)
Para garantir que todo o código esteja rastreado e vinculado ao Kanban, cada desenvolvedor deve iniciar sua tarefa seguindo estes passos diretamente no GitHub:

1.  **Acessar a Tarefa:** Abra a Issue que foi atribuída a você no nosso *board* (Backlog Helpa).
2.  **Criar a Branch:** No menu lateral direito da Issue, vá até a seção **Development** e clique em **"Create a branch"**.
3.  **Configurar a Origem:** * O GitHub vai sugerir um nome automático (ex: `15-tela-login`). Pode mantê-lo.
    * **⚠️ Atenção:** Certifique-se de mudar a opção **"Change branch source"** para a branch `develop`. A branch nova *precisa* nascer da develop!
4.  **Sincronizar Localmente:** O GitHub mostrará dois comandos. Copie e cole no seu terminal para baixar a branch para a sua máquina:
    ```bash
    git fetch origin
    git checkout nome-da-nova-branch
    ```
5.  **Desenvolver e Comitar:** Faça seus commits com mensagens claras, utilizando o padrão *Conventional Commits* (ex: `feat:`, `fix:`, `docs:`):
    ```bash
    git commit -m "feat: implementa validação de email no cadastro"
    ```
6.  **Enviar e Abrir PR:** Envie suas alterações para o GitHub (`git push origin sua-branch`) e abra um **Pull Request (PR)** apontando de volta para a branch `develop`.

#### 3. Regras de Ouro
* **Revisão de Pares:** Nenhum PR deve ser aprovado sem que pelo menos um outro membro da equipe revise o código.
* **Conflitos:** Caso haja conflitos, o responsável pela tarefa deve resolvê-los na sua branch local antes de finalizar o PR.

#### 4. Responsabilidades (Sprint 2)
* **Liriel (Scrum Master):** Revisão final dos PRs e merge da `develop` para a `main` ao final da sprint.
* **Membros da Equipe:** Criar as branches usando o botão das Issues, garantindo que a origem seja a `develop`, e solicitar revisões.

***

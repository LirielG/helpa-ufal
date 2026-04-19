
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
# 🚀 Guia Rápido de Início

## 📍 Localização do Projeto
```
/mnt/storage/2-Education/University/6-8/ACE6/helpa-ufal/frontend
```

## 1️⃣ Pré-requisitos
- Node.js 18+
- npm 9+

## 2️⃣ Instalação

```bash
# Entrar no diretório
cd /mnt/storage/2-Education/University/6-8/ACE6/helpa-ufal/frontend

# Instalar dependências
npm install

# Criar arquivo .env.local (opcional)
echo "VITE_API_URL=http://localhost:3001/api" > .env.local
```

## 3️⃣ Desenvolvimento

### Iniciar servidor de desenvolvimento
```bash
npm run dev
```

Acesso: http://localhost:5173

### Build para produção
```bash
npm run build
```

### Verificar tipos TypeScript
```bash
npx tsc --noEmit
```

### Lint
```bash
npm run lint
```

## 🧪 Testando a Aplicação

### 1. Testar página de Login
- URL: `http://localhost:5173/login`
- Validações automáticas:
  - Email vazio → Erro
  - Email inválido → Erro
  - Senha vazia → Erro
  - Senha < 6 caracteres → Erro

### 2. Testar página de Registro
- URL: `http://localhost:5173/register`
- Etapa 1: Selecione tipo de usuário
- Etapa 2: Preencha formulário específico

#### Para Alunos:
```
Nome: João Silva
Email: joao@example.com
Instituição: UFAL
Curso: Enginearing de Software
Matrícula: 20201234567
Senha: senhaSegura123
```

#### Para Docentes:
```
Nome: Prof. Maria
Email: maria@example.com
Senha: senhaSegura123
```

#### Para Público Externo:
```
Nome: João Comunidade
Email: joao.comun@example.com
Senha: senhaSegura123
```

## 📡 Configuração do Backend

Seu backend precisa ter os seguintes endpoints:

### POST `/api/auth/login`
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

Response esperado:
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": "123",
    "email": "user@example.com",
    "name": "User Name",
    "type": "student",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### POST `/api/auth/register`
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New User",
    "email": "newuser@example.com",
    "password": "password123",
    "confirmPassword": "password123",
    "type": "student",
    "institution": "UFAL",
    "course": "Engenharia de Software",
    "enrollment": "20201234567"
  }'
```

## 🐛 Troubleshooting

### Problema: "Vite: command not found"
```bash
# Solução: Use npx
npx vite
```

### Problema: Erros de TypeScript
```bash
# Verificar todos os erros
npx tsc --noEmit

# Build com erro
npm run build
```

### Problema: Porta 5173 já em uso
```bash
# Usar porta diferente
npx vite --port 3000
```

### Problema: API não conecta
```bash
# Verificar .env.local
cat .env.local

# Deve conter VITE_API_URL
VITE_API_URL=http://localhost:3001/api
```

## 📁 Estrutura de Arquivos Importantes

```
src/
├── pages/
│   ├── Login.tsx      ← Componente de login
│   └── Register.tsx   ← Componente de registro
├── components/
│   ├── Input.tsx      ← Campo de entrada
│   ├── Button.tsx     ← Botão
│   ├── Select.tsx     ← Seletor
│   └── Alert.tsx      ← Alerta
├── hooks/
│   ├── useAuth.ts     ← Hook de autenticação
│   └── useFormErrors.ts← Hook de erros
├── services/
│   └── auth.ts        ← Integração com API
├── validators/
│   └── auth.ts        ← Validações
├── types/
│   └── auth.ts        ← Tipos TypeScript
├── config/
│   └── index.ts       ← Configurações
└── utils/
    └── helpers.ts     ← Funções auxiliares
```

## 🎯 Fluxo de Uso

### Como um usuário faria login:
1. Acessa `http://localhost:5173/login`
2. Preenche email e senha
3. Clica em "Entrar"
4. Sistema valida dados
5. Se válido, envia POST `/api/auth/login`
6. Recebe token e usuário
7. Armazena no localStorage
8. Redireciona para `/dashboard` (a ser criada)

### Como um novo usuário se registraria:
1. Acessa `http://localhost:5173/register`
2. Seleciona tipo de perfil
3. Pode voltar para mudar o tipo (botão voltar)
4. Preenche formulário específico
5. Clica em "Criar Conta"
6. Sistema valida dados
7. Se válido, envia POST `/api/auth/register`
8. Recebe token e usuário
9. Armazena no localStorage
10. Redireciona para `/dashboard` (a ser criada)

## 💡 Dicas de Desenvolvimento

### Adicionar nova página
1. Crie arquivo em `src/pages/`
2. Exporte em `src/pages/index.ts`
3. Adicione rota em `src/App.tsx`

### Adicionar novo componente
1. Crie arquivo em `src/components/`
2. Exporte em `src/components/index.ts`
3. Use em outros componentes

### Adicionar novo hook
1. Crie arquivo em `src/hooks/`
2. Exporte em `src/hooks/index.ts`
3. Use em componentes

### Adicionar novo validador
1. Crie função em `src/validators/auth.ts`
2. Exporte em `src/validators/index.ts`
3. Use em páginas

## 📚 Documentação Disponível

- [AUTHENTICATION_STRUCTURE.md](./AUTHENTICATION_STRUCTURE.md) - Documentação técnica detalhada
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Resumo da implementação
- [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) - Estrutura visual do projeto

## 🔗 URLs Úteis

- **Local Dev**: http://localhost:5173
- **Login**: http://localhost:5173/login
- **Register**: http://localhost:5173/register
- **Backend API**: http://localhost:3001/api (padrão)

## ✅ Checklist Final

- [ ] Dependências instaladas (`npm install`)
- [ ] `.env.local` configurado
- [ ] Servidor de dev rodando (`npm run dev`)
- [ ] Página de login acessível
- [ ] Página de registro acessível
- [ ] Validações funcionando
- [ ] Backend rodando em http://localhost:3001
- [ ] API endpoints implementados
- [ ] Teste de login funciona
- [ ] Teste de registro funciona

## 🆘 Precisa de Ajuda?

1. Verifique a documentação técnica
2. Verifique os tipos TypeScript em `src/types/`
3. Verifique as validações em `src/validators/`
4. Verifique os hooks em `src/hooks/`
5. Testẹ a API com curl ou Postman

## 🎉 Parabéns!

Você agora tem um sistema de autenticação completo, pronto para ser conectado ao seu backend!

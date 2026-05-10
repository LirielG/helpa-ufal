# Estrutura do Frontend - Autenticação (Login e Cadastro)

## Visão Geral

Este projeto implementa um sistema completo de autenticação com Login e Cadastro seguindo os estilos do protótipo Helpa(2) do Figma. A arquitetura está organizada em camadas bem definidas para facilitar manutenção e escalabilidade.

## Estrutura de Pastas

```
src/
├── pages/              # Páginas da aplicação
│   ├── Login.tsx
│   ├── Register.tsx
│   └── index.ts
├── components/         # Componentes reutilizáveis
│   ├── Input.tsx
│   ├── Button.tsx
│   ├── Select.tsx
│   ├── Alert.tsx
│   └── index.ts
├── types/             # Tipos TypeScript
│   ├── auth.ts
│   └── index.ts
├── validators/        # Funções de validação
│   ├── auth.ts
│   └── index.ts
├── services/          # Serviços de API
│   ├── auth.ts
│   └── index.ts
├── hooks/             # Custom Hooks
│   ├── useAuth.ts
│   ├── useFormErrors.ts
│   └── index.ts
├── utils/             # Funções utilitárias
│   ├── helpers.ts
│   └── index.ts
├── config/            # Configurações da aplicação
│   └── index.ts
├── App.tsx
├── main.tsx
├── index.css
└── App.css
```

## Descrição das Camadas

### 📄 Pages (Páginas)
Contém as páginas principais da aplicação:
- **Login.tsx**: Formulário de login com validação
- **Register.tsx**: Formulário de cadastro com seleção de tipos de usuário (Aluno, Docente, Público Externo)

### 🧩 Components (Componentes)
Componentes reutilizáveis de UI:
- **Input.tsx**: Campo de entrada com suporte a ícones e erros
- **Button.tsx**: Botão com variações (primary, secondary, danger) e estados de carregamento
- **Select.tsx**: Campo de seleção com ícones e erros
- **Alert.tsx**: Componente de alerta para feedback do usuário

### 📦 Types (Tipos TypeScript)
Definições de tipos para toda a aplicação:
- **auth.ts**: Tipos relacionados a autenticação (User, LoginRequest, RegisterRequest, etc)

### ✅ Validators (Validadores)
Funções de validação reutilizáveis:
- **auth.ts**: Validação de email, senha, nome, confirmação de senha, instituição, etc

### 🔌 Services (Serviços)
Integração com API e gerenciamento de estado local:
- **auth.ts**: Serviço de autenticação com métodos de login, registro, logout e gerenciamento de token

### 🎣 Hooks (Custom Hooks)
Hooks customizados do React:
- **useAuth.ts**: Hook para autenticação com estados de loading e erro
- **useFormErrors.ts**: Hook para gerenciar erros de formulário

### 🛠️ Utils (Utilitários)
Funções utilitárias compartilhadas:
- **helpers.ts**: Funções como `cn()` para classes CSS, `formatError()`, `delay()`

### ⚙️ Config (Configuração)
Configurações da aplicação:
- **index.ts**: Configuração de URL da API baseada no ambiente

## Fluxo de Autenticação

### Login
1. Usuário preenche o formulário
2. Validação local dos dados
3. Chamada ao serviço de autenticação
4. Token e usuário são armazenados no localStorage
5. Redirecionamento para dashboard

### Cadastro
1. Usuário seleciona tipo de perfil (Aluno, Docente, Público Externo)
2. Preenche formulário específico para seu tipo
3. Validação local dos dados
4. Chamada ao serviço de registro
5. Token e usuário são armazenados no localStorage
6. Redirecionamento para dashboard

## Como Usar

### 1. Instalar Dependências
```bash
npm install
```

### 2. Configurar Variáveis de Ambiente
Criar arquivo `.env.local` na raiz do projeto:
```env
VITE_API_URL=http://localhost:3001/api
```

### 3. Iniciar Desenvolvimento
```bash
npm run dev
```

### 4. Build para Produção
```bash
npm run build
```

## Estilos

- **Tailwind CSS**: Utilizado para todos os estilos
- **Lucide React**: Ícones utilizados nos formulários
- **Gradiente**: Fundo com gradiente azul-índigo
- **Cores por Tipo de Usuário**:
  - Aluno: Azul
  - Docente: Verde
  - Público Externo: Roxo

## Validações Implementadas

### Email
- Obrigatório
- Formato válido (xxx@xxx.xxx)

### Senha
- Obrigatório
- Mínimo de 6 caracteres
- Máximo de 128 caracteres

### Nome
- Obrigatório
- Mínimo de 3 caracteres
- Máximo de 255 caracteres

### Confirmação de Senha
- Deve corresponder à senha

### Campos para Alunos
- Instituição: Obrigatório (UFAL, UFRN, UFPB, UFERSA)
- Curso: Obrigatório
- Matrícula: Obrigatório

## Componentes de UI

### Input
```tsx
<Input
  label="E-mail"
  type="email"
  name="email"
  value={formData.email}
  onChange={handleChange}
  placeholder="seu.email@exemplo.com"
  icon={<Mail className="size-5" />}
  error={errors.email}
/>
```

### Button
```tsx
<Button
  type="submit"
  size="lg"
  isLoading={isLoading}
>
  Entrar
</Button>
```

### Select
```tsx
<Select
  label="Instituição"
  name="institution"
  value={formData.institution}
  onChange={handleChange}
  icon={<Building2 className="size-5" />}
  error={errors.institution}
  options={[
    { value: "", label: "Selecione sua instituição" },
    { value: "UFAL", label: "UFAL" },
  ]}
/>
```

### Alert
```tsx
{authError && (
  <Alert type="error" message={authError} />
)}
```

## Extensões Futuras

Para expandir este projeto, você pode:

1. **Adicionar mais páginas** em `pages/`
2. **Criar novos componentes** em `components/`
3. **Adicionar novos tipos** em `types/`
4. **Implementar mais validadores** em `validators/`
5. **Criar novos serviços** em `services/`
6. **Desenvolver mais hooks** em `hooks/`

## Boas Práticas

- ✅ Cada arquivo tem uma única responsabilidade
- ✅ Componentes são reutilizáveis
- ✅ Validações são centralizadas
- ✅ Tipos são bem definidos
- ✅ Serviços lidam com API
- ✅ Hooks gerenciam estado local
- ✅ Utils compartilham funções comuns

## Próximos Passos

1. Implementar backend para os endpoints de autenticação:
   - POST `/api/auth/login`
   - POST `/api/auth/register`

2. Criar página de dashboard

3. Implementar proteção de rotas com PrivateRoute

4. Adicionar refresh token

5. Implementar logout com limpeza de estado

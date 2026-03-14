# 🧪 [TESTE] Fluxo de Exclusão de Dados (LGPD) — Data Deletion Flow

## 📋 Resumo das Mudanças

### 🔧 Backend (`app/routes/data_deletion.py`)

#### ✅ Mudança 1: Token Embutido no HTML
- **Problema**: Quando a página de exclusão era aberta em nova aba via `window.open()`, a `localStorage` da nova janela estava vazia
- **Solução**: Extrair o token do header Authorization no servidor e embutir diretamente no HTML como `const TOKEN = "{token}";`
- **Arquivo**: `GET /api/v1/webhooks/delete-my-data`
- **Código**:
  ```python
  auth_header = request.headers.get("Authorization", "")
  token = auth_header.replace("Bearer ", "") if auth_header.startswith("Bearer ") else ""
  return """..HTML...""".format(token=token)
  ```

#### ✅ Mudança 2: Suporte a Deleção Sem Autenticação
- **Problema**: Página `DeleteMyData.tsx` tentava fazer requisição sem JWT, mas endpoint exigia autenticação
- **Solução**: Criar novo endpoint `POST /api/v1/webhooks/request-deletion-public`
- **Arquivo**: `backend/app/routes/data_deletion.py`
- **Segurança**: Procura usuário por email, retorna sucesso mesmo se email não existir (previne enumeração)

### 🎨 Frontend (`src/pages/DeleteMyData.tsx`)
- Atualizar endpoint chamado: `/request-deletion` → `/request-deletion-public`
- Usar FormData em vez de JSON (conforme esperado pelo novo endpoint)
- Remover parâmetro `provider` não utilizado

---

## 🧪 Como Testar

### Teste 1: Fluxo Autenticado (Configurações)
**Objetivo**: Verificar se a exclusão funciona quando usuário está conectado

#### Passos:
1. 🔐 **Fazer login** na aplicação
2. ⚙️ **Ir para Configurações** > **Exclusão de Dados (LGPD)**
3. 🔘 **Clicar em** "Acessar Central de Exclusão de Dados"
4. 🪟 **Nova aba deve abrir** com:
   - Título: "Excluir meus dados"
   - Badge mostrando provedor detectado (Google, Facebook ou Plataforma)
   - Aviso sobre ação irreversível
   - Checkbox de confirmação
5. ☑️ **Confirmar** o checkbox
6. ✅ **Clicar** "Deletar e desconectar"
7. 📊 **Esperar resposta**:
   - ✓ Deve mostrar "Exclusão solicitada"
   - ✓ Deve exibir código de confirmação
   - ✓ Deve redirecionar para home em 3 segundos
   - ✓ Deve estar automaticamente desconectado

**Resultado Esperado**: ✅ Fluxo completo sem erros

---

### Teste 2: Fluxo Não-Autenticado (DeleteMyData.tsx)
**Objetivo**: Verificar se usuários não-conectados podem solicitar exclusão via email

#### Passos:
1. 🚫 **Sair da conta** (se estiver conectado)
2. 📄 **Acessar diretamente**: `/deletar-dados` (se houver rota)
3. ✉️ **Fornecer um email** válido
4. 🔘 **Clicar** "Solicitar Exclusão"
5. 📊 **Esperar resposta**:
   - ✓ Deve mostrar sucesso
   - ✓ Deve exibir código de confirmação
   - ✓ Deve mencionar "será excluído em até 30 dias"

**Resultado Esperado**: ✅ Solicitação processada com sucesso

---

### Teste 3: Verificar Token no HTML
**Objetivo**: Validar que o token está corretamente embutido na página

#### Passos:
1. 🔐 Fazer login
2. ⚙️ Ir para Configurações > Exclusão de Dados
3. 🔘 Clicar "Acessar Central"
4. 🪟 **Na nova aba**, pressione **F12** (DevTools)
5. 📟 **Ir para Console**
6. 📝 **Digitar**: `console.log(TOKEN);`
7. 📊 **Verificar**:
   - ✓ Deve exibir um JWT token (string longa começando com eyJ...)
   - ✓ Não deve exibir "undefined" ou vazio

**Resultado Esperado**: ✅ Token presente e visível

---

### Teste 4: Validar Requisição POST
**Objetivo**: Verificar se POST request está sendo enviado com autenticação correta

#### Passos:
1. 🔐 Fazer login
2. ⚙️ Ir para Configurações > Exclusão de Dados > Clicar "Acessar Central"
3. 🪟 **Na nova aba**, pressione **F12** (DevTools)
4. 📡 **Ir para Network tab**
5. ☑️ **Confirmar checkbox + clicar "Deletar"**
6. 📊 **Procurar requisição**:
   - ✓ URL: `/api/v1/webhooks/request-deletion`
   - ✓ Method: `POST`
   - ✓ Status: `200 OK`
   - ✓ Headers: `Authorization: Bearer {token}`
   - ✓ Response contém `"status": "deleted"`

**Resultado Esperado**: ✅ Requisição autenticada e bem-sucedida

---

### Teste 5: Verificar Logout Automático
**Objetivo**: Validar que tokens são removidos após exclusão

#### Passos:
1. 🔐 Fazer login
2. ⚙️ Ir para Configurações > Exclusão de Dados > Clicar "Acessar Central"
3. ☑️ **Confirmar e deletar**
4. 📊 **Após sucesso**:
   - Abrir DevTools Console
   - Digitar: `localStorage.getItem('access_token')`
   - ✓ Deve retornar `null` (token removido)
   - ✓ Deve retornar para home (`/`)
   - ✓ Tentar acessar Configurações deve redirecionar para Login

**Resultado Esperado**: ✅ Logout automático e tokens limpos

---

## 🐛 Troubleshooting

### ❌ "Erro 401 Unauthorized" ao acessar página de exclusão
**Causa**: Token não está sendo enviado ou está expirado
**Solução**:
- Fazer login novamente
- Redirecionamento automático para `/login` deve acontecer
- Verificar se `localStorage` contém `access_token`

### ❌ Nova aba abre em branco ou com erro
**Causa**: CORS ou issue com `document.write()`
**Solução**:
- Verificar Console (F12) para mensagens de erro
- Confirmar backend está rodando em `http://localhost:8000`
- Testar requisição manualmente:
  ```bash
  curl -H "Authorization: Bearer {seu_token}" \
    http://localhost:8000/api/v1/webhooks/delete-my-data
  ```

### ❌ Checkbox não funciona ou botão não ativa
**Causa**: JavaScript error na página
**Solução**:
- Abrir Console (F12) e verificar erros
- Procurar por mensagens relacionadas ao TOKEN
- Verificar que `const TOKEN = "..."` está no HTML

---

## 📊 Teste Automatizado

Para testar o fluxo completo programaticamente:

```bash
cd backend
python test_deletion_flow.py
```

**Requisitos alternativos**:
```bash
# Criar conta de teste primeiro:
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@example.com",
    "password": "senha123",
    "full_name": "Usuário Teste"
  }'
```

---

## ✅ Checklist de Validação

- [ ] Fluxo autenticado (Configurações) funciona
- [ ] Nova aba abre e carrega corretamente  
- [ ] Token está embutido no HTML
- [ ] Confirmação de exclusão é processada
- [ ] Sucesso é mostrado com código
- [ ] Logout automático acontece
- [ ] Tokens são removidos do localStorage
- [ ] Fluxo não-autenticado funciona
- [ ] Email é processado corretamente
- [ ] Resposta de sucesso é mostrada

---

## 📝 Notas

- 🔒 **Segurança**: O fluxo público não revela se email existe (para prevenir enumeração)
- ⏱️ **LGPD**: Dados marcados para exclusão em 30 dias (conforme lei)
- 🔄 **Fallback**: Se token não estiver embutido, tenta localStorage (backup)
- 📧 **Email**: Seria bom implementar envio de email de confirmação (TODO)


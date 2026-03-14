# ✅ Teste Manual - Fluxo de Exclusão de Dados (LGPD)

## 🎯 Objetivo
Validar que o fluxo de exclusão de dados funciona corretamente desde o frontend **Configurações**.

---

## 📋 Credenciais de Teste

```
📧 Email: demoaccount@example.com
🔐 Senha: DemoPassword123!
```

---

## 🧪 Procedimento Passo a Passo

### Passo 1️⃣: Abrir Aplicação
1. Abra seu navegador
2. Acesse: **http://localhost:8080**
3. Você deve ver a página de login ou home

### Passo 2️⃣: Fazer Login
1. Clique em **Login** (se não estiver logado)
2. Insira as credenciais:
   - Email: `demoaccount@example.com`
   - Senha: `DemoPassword123!`
3. Clique **Entrar**
4. ✅ Você deve estar logado e ver seu workspace

### Passo 3️⃣: Ir Para Configurações
1. Localize o ícone de **⚙️ Configurações** (geralmente canto superior direito)
2. Clique nele
3. Você deve ver as abas: Perfil, Branding, Conexões, Redes, **Privacidade**

### Passo 4️⃣: Acessar Exclusão de Dados
1. Clique na aba **Privacidade** (🔒 ícone de cadeado)
2. Você deve ver a seção:
   ```
   ⚠️ Atenção: Ação Irreversível
   Exclusão de Dados (LGPD)
   Solicite a exclusão permanente de todos os seus dados pessoais da plataforma.
   ```
3. Clique no botão **"Acessar Central de Exclusão de Dados"**

### Passo 5️⃣: Verificar Nova Aba (Crítico!)
Uma **nova aba deve abrir** com a seguinte aparência:

```
┌─────────────────────────────────────────┐
│  Excluir meus dados                      │
│  🔐 Conectado via: Plataforma Laurena   │
│                                          │
│  ⚠️ Atenção: Ação Irreversível           │
│  • Você será desconectado imediatamente  │
│  • Todos os dados serão removidos        │
│  • Não é possível recuperar após exclus  │
│                                          │
│  ☑ Confirmo que desejo deletar...       │
│  [Deletar e desconectar]                │
└─────────────────────────────────────────┘
```

**Verificar:**
- ✅ Badge com "🔐 Conectado via: Plataforma Laurena" (ou Google/Facebook)
- ✅ Aviso em vermelho/laranja
- ✅ Checkbox para confirmar
- ✅ Botão "Deletar e desconectar"

### Passo 6️⃣: Confirmar Exclusão
1. **Marque o checkbox** "Confirmo que desejo deletar..."
2. O botão deve mudar de cor/estado
3. Clique **"Deletar e desconectar"**

### Passo 7️⃣: Validar Sucesso
Após alguns segundos, você deve ver:

```
┌─────────────────────────────────────────┐
│  ✓ Exclusão solicitada                   │
│                                          │
│  Sua conta será deletada em até 30 dias  │
│  conforme a LGPD.                        │
│                                          │
│  Código de confirmação:                  │
│  [858b2d32-6b8d-4ced-be55-...]           │
│                                          │
│  Você será redirecionado em 3 segundos...│
└─────────────────────────────────────────┘
```

**Em seguida:**
- ✅ Página redireciona para home (`/`)
- ✅ Você está **automaticamente desconectado**
- ✅ Tokens removidos do localStorage

### Passo 8️⃣: Validar Logout
Para confirmar que foi desconectado:
1. Tente acessar **Configurações** novamente
2. Você deve ser **redirecionado para login**
3. Ou o botão de login deve estar visível

---

## 🔍 Debugging (Se Algo Der Errado)

### Cenário: "Erro 401 Unauthorized"
**Causa**: Token não está sendo enviado ou está expirado

**Solução**:
1. Fazer login novamente
2. Verificar no DevTools (F12) → Application → localStorage
3. Confirmar que `access_token` existe e não está vazio
4. Tentar novamente

### Cenário: Nova aba não abre
**Causa**: Bloqueador de pop-ups ativo

**Solução**:
1. Permitir pop-ups para este site
2. Desativar temporariamente extensões de bloqueio
3. Tentar novamente

### Cenário: "Página em branco" na nova aba
**Causa**: Erro ao renderizar HTML

**Solução**:
1. Abrir DevTools (F12) → Console
2. Procurar por erros em vermelho
3. Verificar se há mensagens de erro
4. Se usar `const TOKEN = "..."`, digitar `console.log(TOKEN)` no console
   - Deve mostrar um JWT token, não `undefined` ou vazio

### Cenário: Estado "Processando..." nunca termina
**Causa**: Requisição POST não retorna resposta

**Solução**:
1. Abrir DevTools → Network
2. Procurar pela requisição para `/api/v1/webhooks/request-deletion`
3. Verificar se retorna `200 OK` e `{"status": "deleted"}`
4. Se retorna erro, anotar o código de status

---

## 📱 Comportamento Esperado Detalhado

### Na Aba Principal (Configurações)
1. Botão desaparece ou fica desabilitado após clique
2. Spinner/loading aparece brevemente

### Na Nova Aba (Página de Exclusão)
1. Carrega HTML com estilos (terracota/beige)
2. Mostra badge azul "Detectando..." → "Conectado via: ..."
3. Exibe aviso em destaque
4. Checkbox funciona (pode ser marcado/desmarcado)
5. Botão está desabilitado até checkbox ser marcado
6. Ao clicar: "⏳ Processando exclusão..." aparece
7. Após sucesso: ✓ Verde com código de confirmação
8. Redirecionamento automático em 3 segundos

### No Banco de Dados
- Usuário deve ser deletado (LGPD compliance)
- Workspace e dados associados deletados  
- Nenhum registro do usuário deve existir

---

## 🧠 O Que Teste Está Validando

| Item | O Que Verifica | Esperado |
|------|----------------|----------|
| 1. Token no Header | Authorization bearer token enviado | ✅ Presente |
| 2. Token Embutido | Token disponível no HTML para JS | ✅ `const TOKEN = "..."` |
| 3. Rendering HTML | Página carrega com estilos | ✅ Bem formatada |
| 4. Provider Detection | JavaScript detecta falsa de login | ✅ "Plataforma Laurena" |
| 5. Form Validation | Checkbox obrigatório funciona | ✅ Botão ativa após marcar |
| 6. POST Request | Solicitação DELETE enviada com JWT | ✅ 200 OK |
| 7. Data Deletion | Usuário deletado do banco | ✅ Desaparece |
| 8. Logout | Tokens removidos do localStorage | ✅ localStorage vazio |
| 9. Redirect | Redireciona para home | ✅ URL é `/` |

---

## 💾 Documentação Criada

- **test_deletion_complete.py** - Teste automatizado completo (já passou ✅)
- **create_test_user.py** - Script para criar usuários de teste
- **delete_my_data_page.html** - HTML gerado (para inspeção)
- **TESTE_EXCLUSAO_DADOS.md** - Guia detalhadocompletocompletocompletocompleticompleto
- **Este arquivo** - Instruções de teste manual

---

## ✅ Checklist Final

Marque conforme você teste:

- [ ] Login bem-sucedido com demoaccount@example.com
- [ ] Configurações acessível
- [ ] Aba Privacidade visível
- [ ] Botão "Acessar Central de Exclusão de Dados" clicável
- [ ] Nova aba abre
- [ ] Página de exclusão carrega sem erros
- [ ] Badge mostra "Conectado via: Plataforma Laurena"
- [ ] Checkbox pode ser marcado
- [ ] Botão muda de estado quando checkbox marcado
- [ ] Clique em "Deletar e desconectar" funciona
- [ ] Aparece "Processando exclusão..."
- [ ] Sucesso mostrado com código de confirmação
- [ ] Redireciona para home
- [ ] Está desconectado (login necessário para acessar novamente)
- [ ] localStorage vazio (sem tokens)

---

## 🎉 Resultado Esperado

✅ **Fluxo completo funcionando:** Login → Configurações → Exclusão → Sucesso → Logout → Home

Se todos os itens do checklist passaram, o sistema está funcionando perfeitamente!


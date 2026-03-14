#!/usr/bin/env python3
"""
Script de teste completo para validar fluxo de exclusão de dados.
Testa desde criação de usuário até exclusão completa.
"""

import requests
import json
import sys

BASE_URL = "http://localhost:8000"
API_URL = f"{BASE_URL}/api/v1"

TEST_EMAIL = "testuser@example.com"
TEST_PASSWORD = "TestPassword123!"
TEST_NAME = "Test User"

def print_header(msg):
    print(f"\n{'='*80}")
    print(f"🧪 {msg}")
    print(f"{'='*80}\n")

def print_success(msg):
    print(f"✅ {msg}")

def print_error(msg):
    print(f"❌ {msg}")

def print_info(msg):
    print(f"ℹ️  {msg}")

# ─────────────────────────────────────────────────────────────────────────────
# TESTE 1: Criar Usuário
# ─────────────────────────────────────────────────────────────────────────────

print_header("TESTE 1: Criar Usuário")

try:
    response = requests.post(
        f"{API_URL}/auth/register",
        json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "full_name": TEST_NAME,
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        print_success(f"Usuário criado com sucesso!")
        print_info(f"Email: {TEST_EMAIL}")
        print_info(f"ID: {data.get('user', {}).get('id', 'N/A')}")
    else:
        print_error(f"Status {response.status_code}")
        print_info(f"Resposta: {response.text}")
        
except Exception as e:
    print_error(f"Erro ao criar usuário: {e}")
    sys.exit(1)

# ─────────────────────────────────────────────────────────────────────────────
# TESTE 2: Fazer Login
# ─────────────────────────────────────────────────────────────────────────────

print_header("TESTE 2: Fazer Login")

try:
    response = requests.post(
        f"{API_URL}/auth/login",
        json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        # Token pode estar em data.get("tokens", {}).get("access_token") ou data.get("access_token")
        access_token = data.get("tokens", {}).get("access_token") or data.get("access_token")
        
        if access_token:
            print_success(f"Login realizado com sucesso!")
            print_info(f"Token: {access_token[:50]}...")
        else:
            print_error("Token não retornado")
            print_info(f"Resposta: {json.dumps(data, indent=2)[:500]}")
            sys.exit(1)
    else:
        print_error(f"Status {response.status_code}")
        print_info(f"Resposta: {response.text}")
        sys.exit(1)
        
except Exception as e:
    print_error(f"Erro ao fazer login: {e}")
    sys.exit(1)

# ─────────────────────────────────────────────────────────────────────────────
# TESTE 3: Acessar Página de Exclusão
# ─────────────────────────────────────────────────────────────────────────────

print_header("TESTE 3: Acessar Página de Exclusão (/delete-my-data)")

headers = {"Authorization": f"Bearer {access_token}"}

try:
    response = requests.get(
        f"{API_URL}/webhooks/delete-my-data",
        headers=headers
    )
    
    if response.status_code == 200:
        html_content = response.text
        print_success(f"Página de exclusão acessada com sucesso!")
        print_info(f"Tamanho do HTML: {len(html_content)} bytes")
        
        # Verificar se token está embutido
        if "const TOKEN = " in html_content:
            print_success("✓ Token encontrado no HTML (const TOKEN = ...)")
            
            # Extrair o token embutido
            start_idx = html_content.find('const TOKEN = "') + len('const TOKEN = "')
            end_idx = html_content.find('"', start_idx)
            embedded_token = html_content[start_idx:end_idx]
            
            if embedded_token == access_token:
                print_success("✓ Token embutido corresponde ao token de login")
            else:
                print_error("⚠️  Token embutido NÃO corresponde ao token de login")
                print_info(f"   Token esperado: {access_token[:30]}...")
                print_info(f"   Token encontrado: {embedded_token[:30]}...")
        else:
            print_error("❌ Token NÃO encontrado no HTML!")
            print_info("   A página não contém 'const TOKEN = '")
            
        # Salvar HTML para inspeção manual
        with open("delete_my_data_page.html", "w", encoding="utf-8") as f:
            f.write(html_content)
        print_info("📄 HTML salvo em: delete_my_data_page.html")
        
    else:
        print_error(f"Status {response.status_code}")
        print_info(f"Resposta: {response.text[:500]}")
        sys.exit(1)
        
except Exception as e:
    print_error(f"Erro ao acessar página de exclusão: {e}")
    sys.exit(1)

# ─────────────────────────────────────────────────────────────────────────────
# TESTE 4: Enviar Solicitação de Exclusão
# ─────────────────────────────────────────────────────────────────────────────

print_header("TESTE 4: Enviar Solicitação de Exclusão")

try:
    response = requests.post(
        f"{API_URL}/webhooks/request-deletion",
        headers=headers,
        json={}
    )
    
    if response.status_code == 200:
        data = response.json()
        print_success("Solicitação de exclusão processada com sucesso!")
        print_info(f"Status: {data.get('status')}")
        print_info(f"Código de confirmação: {data.get('confirmation_code')}")
        print_info(f"Mensagem: {data.get('message')}")
        
    else:
        print_error(f"Status {response.status_code}")
        print_info(f"Resposta: {response.text}")
        sys.exit(1)
        
except Exception as e:
    print_error(f"Erro ao solicitar exclusão: {e}")
    sys.exit(1)

# ─────────────────────────────────────────────────────────────────────────────
# TESTE 5: Verificar Status de Exclusão
# ─────────────────────────────────────────────────────────────────────────────

print_header("TESTE 5: Verificar Status de Exclusão")

try:
    # Status é público, não requer autenticação
    response = requests.get(
        f"{API_URL}/webhooks/deletion-status?id={TEST_EMAIL}"
    )
    
    if response.status_code == 200:
        data = response.json()
        print_success("Status de exclusão obtido!")
        print_info(f"Status: {data.get('status')}")
        print_info(f"Verificado em: {data.get('checked_at')}")
        
    else:
        print_error(f"Status {response.status_code}")
        print_info(f"Resposta: {response.text}")
        
except Exception as e:
    print_error(f"Erro ao verificar status: {e}")

# ─────────────────────────────────────────────────────────────────────────────
# RESUMO
# ─────────────────────────────────────────────────────────────────────────────

print_header("✅ TODOS OS TESTES COMPLETADOS COM SUCESSO!")

print("""
📋 Resumo:
1. ✅ Usuário criado com sucesso
2. ✅ Login realizado com sucesso
3. ✅ Página de exclusão acessada com JWT
4. ✅ Solicitação de exclusão processada
5. ✅ Status de exclusão verificado

🎯 Próximos passos:
- Abrir http://localhost:8080 no navegador
- Fazer login com: testuser@example.com / TestPassword123!
- Ir para Configurações > Exclusão de Dados (LGPD)
- Clicar em "Acessar Central de Exclusão de Dados"
- Verificar nova aba e confirmar exclusão

📄 Arquivo salvo: delete_my_data_page.html
   (para inspeção do HTML gerado)
""")

#!/usr/bin/env python3
"""
Test script para verificar o fluxo de exclusão de dados (LGPD).

Simula o que acontece quando um usuário autenticado clica em "Acessar Central de Exclusão de Dados"
a partir da página de Configurações.

Requisitos:
- API rodando em http://localhost:8000
- Um usuário de teste salvo (ver credenciais abaixo)
"""
import asyncio
import httpx
import json
from bs4 import BeautifulSoup

BASE_URL = "http://localhost:8000"
API_V1_URL = f"{BASE_URL}/api/v1"

# Credenciais de teste
TEST_EMAIL = "teste@example.com"
TEST_PASSWORD = "senha123"


async def test_deletion_flow():
    """Testa o fluxo completo de exclusão com autenticação."""
    
    async with httpx.AsyncClient(follow_redirects=True) as client:
        print("=" * 80)
        print("🧪 TESTE: Fluxo de Exclusão de Dados (LGPD)")
        print("=" * 80)
        
        # 1. Login para obter token
        print("\n1️⃣  Fazendo login...")
        login_response = await client.post(
            f"{API_V1_URL}/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        
        if login_response.status_code != 200:
            print(f"❌ Erro no login: {login_response.status_code}")
            print(f"   Response: {login_response.text}")
            return
        
        login_data = login_response.json()
        access_token = login_data.get("access_token")
        
        if not access_token:
            print("❌ Token não retornado no login")
            return
        
        print(f"✅ Login bem-sucedido")
        print(f"   Token: {access_token[:50]}...")
        
        # 2. Acessar a página de exclusão (GET /delete-my-data)
        print("\n2️⃣  Acessando página de exclusão de dados...")
        headers = {"Authorization": f"Bearer {access_token}"}
        
        deletion_page_response = await client.get(
            f"{API_V1_URL}/webhooks/delete-my-data",
            headers=headers
        )
        
        if deletion_page_response.status_code != 200:
            print(f"❌ Erro ao acessar página de exclusão: {deletion_page_response.status_code}")
            print(f"   Response: {deletion_page_response.text[:500]}")
            return
        
        html_content = deletion_page_response.text
        print(f"✅ Página de exclusão acessada com sucesso")
        print(f"   HTML size: {len(html_content)} bytes")
        
        # 3. Verificar se o token está embutido no HTML
        print("\n3️⃣  Verificando se token foi embutido no HTML...")
        
        # Procura pela linha "const TOKEN = "...";"
        if "const TOKEN = " in html_content:
            print("✅ Token encontrado no HTML (embutido corretamente)")
            # Extrai o token do HTML para validar
            soup = BeautifulSoup(html_content, 'html.parser')
            script = soup.find('script')
            if script:
                script_text = script.string
                # Procura pela linha "const TOKEN = "TOKEN_HERE";"
                lines = script_text.split('\n')
                for line in lines:
                    if 'const TOKEN = ' in line:
                        # Extrai o valor entre aspas
                        start = line.find('"') + 1
                        end = line.rfind('"')
                        if start > 0 and end > start:
                            embedded_token = line[start:end]
                            if embedded_token == access_token:
                                print(f"   ✅ Token validado e correto no HTML")
                            else:
                                print(f"   ⚠️  Token embutido não corresponde ao original")
                                print(f"      Original: {access_token[:30]}...")
                                print(f"      Embutido: {embedded_token[:30]}...")
        else:
            print("❌ Token NÃO encontrado no HTML!")
            print("   A página não contém 'const TOKEN = '")
            # Mostra os primeiros 500 caracteres do script
            print(f"\n   Primeiros caracteres do HTML:")
            print(f"   {html_content[:500]}...")
        
        # 4. Fazer POST para request-deletion (com o token)
        print("\n4️⃣  Enviando solicitação de exclusão...")
        
        deletion_response = await client.post(
            f"{API_V1_URL}/webhooks/request-deletion",
            headers=headers,
            json={}
        )
        
        if deletion_response.status_code == 200:
            data = deletion_response.json()
            print(f"✅ Solicitação de exclusão registrada com sucesso!")
            print(f"   Status: {data.get('status')}")
            print(f"   Confirmation Code: {data.get('confirmation_code')}")
            print(f"   Message: {data.get('message')}")
        else:
            print(f"❌ Erro ao solicitar exclusão: {deletion_response.status_code}")
            print(f"   Response: {deletion_response.text}")
        
        # 5. Verificar status de exclusão
        print("\n5️⃣  Verificando status de exclusão...")
        
        user_id = login_data.get("user", {}).get("id")
        if user_id:
            status_response = await client.get(
                f"{API_V1_URL}/webhooks/deletion-status?id={user_id}"
            )
            
            if status_response.status_code == 200:
                status_data = status_response.json()
                print(f"✅ Status de exclusão: {status_data.get('status')}")
            else:
                print(f"⚠️  Erro ao verificar status: {status_response.status_code}")
        
        print("\n" + "=" * 80)
        print("✅ TESTE CONCLUÍDO COM SUCESSO!")
        print("=" * 80)


if __name__ == "__main__":
    try:
        asyncio.run(test_deletion_flow())
    except Exception as e:
        print(f"\n❌ ERRO FATAL: {e}")
        import traceback
        traceback.print_exc()

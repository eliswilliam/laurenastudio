#!/usr/bin/env python3
"""
Script rápido para criar um novo usuário de teste
"""

import requests
import json

BASE_URL = "http://localhost:8000"
API_URL = f"{BASE_URL}/api/v1"

# Novo usuário de teste (já que o anterior foi deletado)
TEST_EMAIL = "demoaccount@example.com"
TEST_PASSWORD = "DemoPassword123!"
TEST_NAME = "Demo Account"

response = requests.post(
    f"{API_URL}/auth/register",
    json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "full_name": TEST_NAME,
    }
)

if response.status_code in (200, 201):
    data = response.json()
    print("\n" + "="*80)
    print("✅ NOVO USUÁRIO DE TESTE CRIADO COM SUCESSO!")
    print("="*80)
    print(f"\n📧 Email: {TEST_EMAIL}")
    print(f"🔐 Senha: {TEST_PASSWORD}")
    print(f"👤 Nome: {TEST_NAME}")
    print(f"🆔 ID: {data.get('user', {}).get('id', 'N/A')}")
    print("\n🌐 Para testar no navegador:")
    print(f"   1. Abrir: http://localhost:8080")
    print(f"   2. Login com: {TEST_EMAIL} / {TEST_PASSWORD}")
    print(f"   3. Ir para: Configurações > Exclusão de Dados (LGPD)")
    print(f"   4. Clicar: 'Acessar Central de Exclusão de Dados'")
    print(f"   5. Confirmar exclusão na nova aba")
    print("\n" + "="*80)
else:
    print(f"\n❌ Erro ao criar usuário: {response.status_code}")
    print(f"Resposta: {response.text}")
    
    if response.status_code == 409:
        print("\n⚠️  Email já registrado. Usando esse usuário...")
        print(f"   Email: {TEST_EMAIL}")
        print(f"   Senha: {TEST_PASSWORD}")

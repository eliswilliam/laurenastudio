# -*- coding: utf-8 -*-
import re

with open('src/pages/CriarSite.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

pattern = re.compile(r"const partes = \[.*?partes\.push\(GitHub: \$\{gh\}\);", re.DOTALL | re.MULTILINE)

replacement = """const partes = [
              Site publicado com sucesso!,
              Site: ,
              O site está a ser protegido e propagado pelo Cloudflare. Aguarde até 30 minutos e carregue no link do seu site para o ver online.
            ];
            if (cr && cr !== site) {
              partes.push(Cloud Run (directo temporário): );
            }
            if (!dnsOk) {
              partes.push(
                Nota: o subdomínio não foi configurado com Cloudflare porque o backend não tem as credenciais necessárias.
              );
            }
            partes.push(GitHub do projecto: );"""

new_text = pattern.sub(replacement, text)

with open('src/pages/CriarSite.tsx', 'w', encoding='utf-8') as f:
    f.write(new_text)

print("Done.")

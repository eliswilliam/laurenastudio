$lines = Get-Content -Raw src/pages/CriarSite.tsx
$lines = $lines -replace 'const partes = \["Publicação concluída!.*?(?=textoSucesso = partes\.join.*)', "const partes = [\
                "Site publicado com sucesso!",
                "Site: ${site}",
                "O site está a ser protegido e propagado pelo Cloudflare. Aguarde até 30 minutos e carregue no link do seu site para o ver online."
              ];
              if (cr && cr !== site) {
                partes.push("Cloud Run (directo temporário): ${cr}");
              }
              if (!dnsOk) {
                partes.push(
                  "Nota: o subdomínio não foi configurado com Cloudflare porque o backend não tem as credenciais necessárias."
                );
              }
              partes.push("GitHub do projecto: ${gh}");
              "
[IO.File]::WriteAllText("src/pages/CriarSite.tsx", $lines)

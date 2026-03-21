/**
 * Garante que o build de produção inclui a rota /criar-site (bundle + index.html).
 * Uso: npm run verify:criar-site
 */
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

const dist = join(process.cwd(), "dist");
if (!existsSync(dist)) {
  console.error("dist/ não existe. Execute npm run build primeiro.");
  process.exit(1);
}

const indexHtml = readFileSync(join(dist, "index.html"), "utf8");
if (!indexHtml.includes("root")) {
  console.error("dist/index.html inválido.");
  process.exit(1);
}

const assetsDir = join(dist, "assets");
const jsFiles = readdirSync(assetsDir).filter((f) => f.endsWith(".js"));
let found = false;
for (const f of jsFiles) {
  const s = readFileSync(join(assetsDir, f), "utf8");
  if (s.includes("criar-site")) {
    found = true;
    break;
  }
}

if (!found) {
  console.error('Nenhum bundle .js em dist/assets contém a string "criar-site".');
  process.exit(1);
}

console.log("OK: /criar-site está no bundle de produção e dist/index.html existe.");

# -*- coding: utf-8 -*-
import re

with open('src/pages/CriarSite.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace assignments of 'const [lista, setLista] = useState...'
# with the store access.

replacements = {
    "const [lista, setLista] = useState<Mensagem[]>([ABERTURA]);": "const lista = useCriarSiteJobStore((s) => s.lista);\n  const setLista = useCriarSiteJobStore((s) => s.setLista);",
    "const [projectId, setProjectId] = useState<string | null>(null);": "const projectId = useCriarSiteJobStore((s) => s.projectId);\n  const setProjectId = useCriarSiteJobStore((s) => s.setProjectId);",
    "const [siteResult, setSiteResult] = useState<SiteResult | null>(null);": "const siteResult = useCriarSiteJobStore((s) => s.siteResult);\n  const setSiteResult = useCriarSiteJobStore((s) => s.setSiteResult);",
    "const [githubUrl, setGithubUrl] = useState<string | null>(null);": "const githubUrl = useCriarSiteJobStore((s) => s.githubUrl);\n  const setGithubUrl = useCriarSiteJobStore((s) => s.setGithubUrl);",
    "const [publicSiteUrl, setPublicSiteUrl] = useState<string | null>(null);": "const publicSiteUrl = useCriarSiteJobStore((s) => s.publicSiteUrl);\n  const setPublicSiteUrl = useCriarSiteJobStore((s) => s.setPublicSiteUrl);",
    "const [publishSlug, setPublishSlug] = useState('');": "const publishSlug = useCriarSiteJobStore((s) => s.publishSlug);\n  const setPublishSlug = useCriarSiteJobStore((s) => s.setPublishSlug);",
}

for k, v in replacements.items():
    text = text.replace(k, v)

# Initialize aGerar and aPublicar properly on mount because of refresh
# e.g., const [aGerar, setAGerar] = useState(!!generateJobId);
text = re.sub(r"const \[aGerar, setAGerar\] = useState\(false\);", "const [aGerar, setAGerar] = useState(!!generateJobId);", text)
text = re.sub(r"const \[aPublicar, setAPublicar\] = useState\(false\);", "const [aPublicar, setAPublicar] = useState(!!publishJobId);", text)


with open('src/pages/CriarSite.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Refactor done.")

# -*- coding: utf-8 -*-
import re

with open('src/pages/CriarSite.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# remove local definition
text = re.sub(r"interface SiteResult \{\n  previewUrl: string;\n  downloadUrl: string;\n\}", "", text)

# update import
text = text.replace("import { useCriarSiteJobStore } from '@/store/useCriarSiteJobStore';", "import { useCriarSiteJobStore, type SiteResult } from '@/store/useCriarSiteJobStore';")

with open('src/pages/CriarSite.tsx', 'w', encoding='utf-8') as f:
    f.write(text)


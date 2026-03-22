# -*- coding: utf-8 -*-
with open('src/pages/CriarSite.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# I want to add resetAll to the store extraction
import re
text = re.sub(r"const clearPublishJob = useCriarSiteJobStore\(\(s\) => s\.clearPublishJob\);", "const clearPublishJob = useCriarSiteJobStore((s) => s.clearPublishJob);\n  const resetAll = useCriarSiteJobStore((s) => s.resetAll);", text)

# I want to add a Reset button in the header
reset_btn = """<Button
                variant=\"ghost\"
                size=\"sm\"
                className=\"shrink-0 rounded-full h-9 gap-1.5 text-xs font-normal\"
                onClick={resetAll}
              >
                Novo Site
              </Button>\n              """

text = text.replace("{siteResult && (", reset_btn + "{siteResult && (")

with open('src/pages/CriarSite.tsx', 'w', encoding='utf-8') as f:
    f.write(text)


"""
Split monolithic HTML (e.g. Jinja-generated site) into index.html, styles.css, app.js
for publishing as separate static assets.
"""
from __future__ import annotations

import re


_STYLE_RE = re.compile(r"<style[^>]*>(.*?)</style>", re.DOTALL | re.IGNORECASE)
# Inner script bodies only (skip src="..." external scripts with no body)
_SCRIPT_RE = re.compile(
    r"<script(?![^>]*\bsrc\s*=)[^>]*>(.*?)</script>",
    re.DOTALL | re.IGNORECASE,
)


def split_html_to_static_files(html: str) -> list[tuple[str, str]]:
    """
    Extract <style> and inline <script> blocks; inject link + script tags before </head>.
    Returns ordered (path, content) tuples: index.html, styles.css, app.js.
    """
    styles = _STYLE_RE.findall(html)
    scripts = _SCRIPT_RE.findall(html)

    css = "\n\n".join(s.strip() for s in styles) if styles else "/* Generated site: no <style> blocks */\n"
    js = "\n\n".join(s.strip() for s in scripts) if scripts else "// Generated site: no inline scripts\n"

    html_stripped = _STYLE_RE.sub("", html)
    html_stripped = _SCRIPT_RE.sub("", html_stripped)

    inject = (
        '  <link rel="stylesheet" href="styles.css">\n'
        '  <script src="app.js" defer></script>\n'
    )
    lowered = html_stripped.lower()
    if "</head>" in lowered:
        html_stripped = re.sub(
            r"</head>",
            inject + "</head>",
            html_stripped,
            count=1,
            flags=re.IGNORECASE,
        )
    else:
        html_stripped = inject + html_stripped

    return [
        ("index.html", html_stripped.strip() + "\n"),
        ("styles.css", css.strip() + "\n"),
        ("app.js", js.strip() + "\n"),
    ]

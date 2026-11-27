"""
services/search_service.py
Global search across dashboard pages (and placeholders for future entities).
Routes and copy are aligned with src/App.tsx and the app sidebar.
"""
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession


class SearchResult(BaseModel):
    """One hit (type groups in the API response use plural keys, e.g. pages)."""

    type: str = Field(description='Logical kind, e.g. "page"')
    title: str
    description: str | None = None
    url: str


class SearchResponse(BaseModel):
    query: str
    total: int
    results: dict[str, list[SearchResult]]


# Dashboard / app routes — searchable title + description (PT keywords for discovery)
SYSTEM_PAGES: list[SearchResult] = [
    SearchResult(
        type="page",
        title="Dashboard",
        description="Painel principal, início, visão geral, conta, uso do plano, assinatura",
        url="/dashboard",
    ),
    SearchResult(
        type="page",
        title="Criar site",
        description="Gerador de sites com IA, publicar, template, domínio, Cloud Run",
        url="/criar-site",
    ),
    SearchResult(
        type="page",
        title="Indexar",
        description="Google Indexing API, pedir indexação, Search Console, subdomínio",
        url="/indexar",
    ),
    SearchResult(
        type="page",
        title="Marketing AI",
        description="Campanhas, criativos, marca, anúncios, vídeo marketing",
        url="/marketing-ai",
    ),
    SearchResult(
        type="page",
        title="AI Studio",
        description="Gemini, Minimax, áudio, inteligência artificial, gerar imagem e texto",
        url="/ai-studio",
    ),
    SearchResult(
        type="page",
        title="Plano e pagamento",
        description="Assinatura, Stripe, preços, upgrade, fatura, billing",
        url="/pagamento",
    ),
    SearchResult(
        type="page",
        title="Configurações",
        description="Perfil, utilizador, email, segurança, integrações",
        url="/configuracoes",
    ),
    SearchResult(
        type="page",
        title="Pré-visualizar post",
        description="Preview de publicação social",
        url="/preview-post",
    ),
    SearchResult(
        type="page",
        title="Editor",
        description="Editor de páginas e conteúdo",
        url="/editor",
    ),
    SearchResult(
        type="page",
        title="Escolher plano",
        description="Starter, Pro, Business, preços, checkout",
        url="/escolher-plano",
    ),
]


def _page_matches(page: SearchResult, q: str) -> bool:
    """Substring match or all significant tokens (length ≥ 2) present in title+description."""
    q = q.lower().strip()
    if not q:
        return False
    hay = f"{page.title} {(page.description or '')}".lower()
    if q in hay:
        return True
    tokens = [t for t in q.split() if len(t) >= 2]
    if not tokens:
        return False
    return all(t in hay for t in tokens)


async def global_search(
    db: AsyncSession,
    workspace_id: str,
    query: str,
) -> SearchResponse:
    _ = db  # reserved for future SQL search (posts, media, …)
    _ = workspace_id
    q = query.strip()
    results: dict[str, list[SearchResult]] = {}

    matching_pages = [p for p in SYSTEM_PAGES if _page_matches(p, q)]
    if matching_pages:
        results["pages"] = matching_pages

    # Placeholders until backed by tables
    # results["posts"] = …

    results = {k: v for k, v in results.items() if v}
    total = sum(len(v) for v in results.values())

    return SearchResponse(query=query, total=total, results=results)

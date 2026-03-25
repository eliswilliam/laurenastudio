"""
services/search_service.py
Global search across posts, media, campaigns, social accounts, and system pages.
Since posts/media/campaigns are not yet persisted, this searches system pages
and any future tables that get created.
"""
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession


class SearchResult(BaseModel):
    type: str  # "page" | "post" | "media" | "campaign" | "social_account"
    title: str
    description: str | None = None
    url: str


class SearchResponse(BaseModel):
    query: str
    total: int
    results: dict[str, list[SearchResult]]


# System pages available in the dashboard
SYSTEM_PAGES = [
    SearchResult(type="page", title="Dashboard", description="Painel de controle principal", url="/dashboard"),
    SearchResult(type="page", title="Criar Post", description="Criar e publicar novo post", url="/criar-post"),
    SearchResult(type="page", title="AI Studio", description="Gerar conteúdo com inteligência artificial", url="/ai-studio"),
    SearchResult(type="page", title="Agendador", description="Agendar publicações nas redes sociais", url="/agendador"),
    SearchResult(type="page", title="Analytics", description="Análise de métricas e desempenho", url="/analytics"),
    SearchResult(type="page", title="Ads Analytics", description="Análise de campanhas de anúncios", url="/ads-analytics"),
    SearchResult(type="page", title="Biblioteca de Mídia", description="Gerenciar imagens, vídeos e áudio", url="/midia"),
    SearchResult(type="page", title="Pagamento", description="Gerenciar plano e assinatura", url="/pagamento"),
    SearchResult(type="page", title="Configurações", description="Perfil, branding e contas sociais", url="/configuracoes"),
]


async def global_search(
    db: AsyncSession,
    workspace_id: str,
    query: str,
) -> SearchResponse:
    q = query.lower().strip()
    results: dict[str, list[SearchResult]] = {}

    # 1. Search system pages
    matching_pages = [
        p for p in SYSTEM_PAGES
        if q in p.title.lower() or (p.description and q in p.description.lower())
    ]
    if matching_pages:
        results["pages"] = matching_pages

    # 2. Search posts (placeholder — will query posts table when it exists)
    # TODO: Add actual post search when posts table is created
    # For now, search mock for demonstration
    results.setdefault("posts", [])

    # 3. Search media (placeholder)
    results.setdefault("media", [])

    # 4. Search campaigns (placeholder)
    results.setdefault("campaigns", [])

    # 5. Search social accounts (placeholder)
    results.setdefault("social_accounts", [])

    # Filter out empty categories
    results = {k: v for k, v in results.items() if v}

    total = sum(len(v) for v in results.values())

    return SearchResponse(query=query, total=total, results=results)

"""Smoke test: SiteProject / SiteDeployment models and migration 012 fields."""
from __future__ import annotations

import sys


def main() -> int:
    from app.models.site_project import SiteDeployment, SiteProject

    p = SiteProject()
    assert hasattr(p, "github_repo_url")
    assert hasattr(p, "user_prompt")
    assert hasattr(p, "publish_slug")

    d = SiteDeployment()
    assert hasattr(d, "commit_sha")
    assert hasattr(d, "status")

    from app.services.github_publish_service import publish_site_files  # noqa: F401

    print("OK: SiteProject, SiteDeployment, publish_site_files")
    return 0


if __name__ == "__main__":
    sys.exit(main())

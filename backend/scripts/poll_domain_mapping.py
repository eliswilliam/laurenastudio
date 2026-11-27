"""One-off: GET domain mapping status (run: docker compose exec api python scripts/poll_domain_mapping.py)."""
import json
import os
import sys
import time
from urllib.parse import quote

import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.config import settings
from app.services.cloud_run_lookup import get_gcp_access_token
from app.services.cloud_run_domain_mapping import _dm_api_base

slug = os.environ.get("DM_SLUG", "e2e-live-20250321")
root = settings.ROOT_DOMAIN.strip().lower().rstrip(".")
fqdn = f"{slug}.{root}"
pid = settings.GCP_PROJECT_ID.strip()
reg = (settings.GCP_REGION or "us-central1").strip()
tok = get_gcp_access_token()
url = f"{_dm_api_base(reg)}/namespaces/{pid}/domainmappings/{quote(fqdn, safe='')}"

for i in range(10):
    r = httpx.get(url, headers={"Authorization": f"Bearer {tok}"}, timeout=60)
    d = r.json() if r.status_code == 200 else {}
    st = d.get("status") or {}
    conds = st.get("conditions") or []
    recs = st.get("resourceRecords") or []
    print(f"poll {i} HTTP={r.status_code} conds={len(conds)} recs={len(recs)}")
    for c in conds:
        print(
            " ",
            c.get("type"),
            c.get("status"),
            c.get("reason"),
            (c.get("message") or "")[:200],
        )
    if recs:
        print("resourceRecords:", json.dumps(recs, ensure_ascii=False)[:2000])
    if any(
        (c.get("type") or "").lower() == "ready"
        and str(c.get("status")).lower() == "true"
        for c in conds
    ):
        print("READY")
        break
    time.sleep(4)

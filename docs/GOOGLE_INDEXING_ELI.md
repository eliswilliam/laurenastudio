# Test d’indexation — eli.laurenastudio.pro

URL notifiée à l’API Google Indexing (`URL_UPDATED`) lors du test manuel :

**https://eli.laurenastudio.pro/**

Commande (depuis `backend/`) :

```powershell
$env:RUN_GOOGLE_INDEXING_LIVE_TEST="1"
$env:RUN_GOOGLE_INDEXING_LIVE_PUBLISH="1"
$env:GOOGLE_INDEXING_TEST_URL="https://eli.laurenastudio.pro/"
pytest test_google_indexing_api.py::test_live_publish_url_updated_optional -v
```

L’automatisation en production passe par le worker ARQ après **Publicar** (voir `docs/SITE_BUILDER.md`).

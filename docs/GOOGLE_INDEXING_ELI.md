# Indexing Test — eli.laurenastudio.pro

URL notified to the Google Indexing API (`URL_UPDATED`) during manual testing:

**https://eli.laurenastudio.pro/**

Command (from `backend/`):

```powershell
$env:RUN_GOOGLE_INDEXING_LIVE_TEST="1"
$env:RUN_GOOGLE_INDEXING_LIVE_PUBLISH="1"
$env:GOOGLE_INDEXING_TEST_URL="https://eli.laurenastudio.pro/"
pytest test_google_indexing_api.py::test_live_publish_url_updated_optional -v
```

Production indexing is triggered from the **Indexar** page or background worker after **Publicar** (see `docs/SITE_BUILDER.md`).

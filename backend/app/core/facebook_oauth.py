"""
core/facebook_oauth.py
Authlib OAuth client configured for Facebook Login.
"""
from authlib.integrations.starlette_client import OAuth

from app.core.config import settings

oauth_facebook = OAuth()
oauth_facebook.register(
    name="facebook",
    client_id=settings.FACEBOOK_APP_ID,
    client_secret=settings.FACEBOOK_APP_SECRET,
    authorize_url="https://www.facebook.com/v19.0/dialog/oauth",
    access_token_url="https://graph.facebook.com/v19.0/oauth/access_token",
    # Fetch user info (id, name, email, picture) from the Graph API
    api_base_url="https://graph.facebook.com/v19.0/",
    client_kwargs={"scope": "public_profile email"},
)

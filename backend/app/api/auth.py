import os
import logging
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import auth, credentials, initialize_app

from app.config import settings

logger = logging.getLogger("app.api.auth")
security = HTTPBearer()

firebase_initialized = False

# Try service account file first
if os.path.exists(settings.FIREBASE_SERVICE_ACCOUNT_PATH):
    try:
        if not firebase_admin._apps:
            cred = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_PATH)
            initialize_app(cred)
        firebase_initialized = True
        logger.info("Firebase Admin SDK initialized successfully from service account file.")
    except Exception as e:
        logger.error(f"Failed to initialize Firebase Admin SDK from file: {e}")

# If not initialized, try env variables
if not firebase_initialized and settings.FIREBASE_CLIENT_EMAIL and settings.FIREBASE_PRIVATE_KEY:
    try:
        if not firebase_admin._apps:
            formatted_key = settings.FIREBASE_PRIVATE_KEY.replace("\\n", "\n")
            cred_dict = {
                "type": "service_account",
                "project_id": settings.FIREBASE_PROJECT_ID or "campus-connect-enanq",
                "private_key": formatted_key,
                "client_email": settings.FIREBASE_CLIENT_EMAIL,
                "token_uri": "https://oauth2.googleapis.com/token",
            }
            cred = credentials.Certificate(cred_dict)
            initialize_app(cred)
        firebase_initialized = True
        logger.info("Firebase Admin SDK initialized successfully from environment variables.")
    except Exception as e:
        logger.error(f"Failed to initialize Firebase Admin SDK from env variables: {e}")

if not firebase_initialized:
    logger.warning(
        "Firebase credentials not found or failed to initialize. "
        "Running in local development auth fallback mode (accepts any token and returns 'mock_user_123')."
    )

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> str:
    """Verifies Firebase JWT token and returns user ID.
    
    If Firebase is not configured locally, falls back to a development mode returning 'mock_user_123'.
    """
    token = credentials.credentials
    if not firebase_initialized:
        logger.info(f"Dev Auth Fallback: Accepted mock token '{token[:10]}...'. Returning user 'mock_user_123'")
        return "mock_user_123"
        
    try:
        decoded = auth.verify_id_token(token)
        return decoded["uid"]
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

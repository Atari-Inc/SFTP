from fastapi.middleware.cors import CORSMiddleware
from ..config import settings

def add_cors_middleware(app):
    """Add CORS middleware to the app"""
    # In development, be more permissive with CORS
    if settings.NODE_ENV == "development":
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],  # Allow all origins in development
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
            allow_headers=["Content-Type", "Authorization", "Accept", "X-Requested-With"],
        )
    else:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.CORS_ORIGINS,
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
            allow_headers=["Content-Type", "Authorization", "Accept", "X-Requested-With"],
        )
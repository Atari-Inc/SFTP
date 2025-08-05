from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
import os
import sys

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.config import settings
from app.database import engine, Base
from app.api import api_router
from app.middleware.cors import add_cors_middleware
from app.middleware.logging import LoggingMiddleware

# Create database tables
Base.metadata.create_all(bind=engine)

# Create FastAPI app
app = FastAPI(
    title="Atari Files Transfer API",
    description="A comprehensive API for Atari Files Transfer - SFTP server management and file operations",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add middleware
add_cors_middleware(app)
app.add_middleware(LoggingMiddleware)

# Add explicit CORS handling for development
@app.middleware("http")
async def add_cors_headers(request, call_next):
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

# Include API routes
app.include_router(api_router)

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Atari Files Transfer API",
        "version": "1.0.0",
        "docs": "/docs"
    }

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "environment": settings.NODE_ENV
    }

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "message": str(exc) if settings.NODE_ENV == "development" else "An error occurred"
        }
    )

if __name__ == "__main__":
    import uvicorn
    
    # Create logs directory if it doesn't exist
    os.makedirs(os.path.dirname(settings.LOG_FILE), exist_ok=True)
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.NODE_ENV == "development",
        log_level=settings.LOG_LEVEL.lower()
    )
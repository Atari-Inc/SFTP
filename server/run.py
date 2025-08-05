#!/usr/bin/env python3
"""
SFTP Admin Dashboard Server
Run this script to start the server
"""
import os
import sys
import uvicorn
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the current directory to Python path
sys.path.append(os.path.dirname(__file__))

from app.config import settings
from app.db.init_db import init_db
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)

def main():
    """Main function to run the server"""
    print("Starting SFTP Admin Dashboard Server...")
    print(f"Environment: {settings.NODE_ENV}")
    print(f"Port: {settings.PORT}")
    
    # Initialize database
    print("Initializing database...")
    try:
        init_db()
        print("Database initialized successfully")
    except Exception as e:
        print(f"Database initialization failed: {e}")
        sys.exit(1)
    
    # Create logs directory
    os.makedirs(os.path.dirname(settings.LOG_FILE), exist_ok=True)
    
    # Start server
    print("Starting server...")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.NODE_ENV == "development",
        log_level=settings.LOG_LEVEL.lower()
    )

if __name__ == "__main__":
    main()
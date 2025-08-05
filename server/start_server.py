#!/usr/bin/env python3
"""
Simple server startup script
"""
import os
import sys
import uvicorn
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the current directory to Python path
sys.path.append(os.path.dirname(__file__))

def main():
    """Start the server directly"""
    print("Starting SFTP Admin Dashboard Server...")
    print("Port: 3001")
    
    # Create logs directory
    os.makedirs("logs", exist_ok=True)
    
    try:
        # Start server directly without database init
        uvicorn.run(
            "main:app",
            host="127.0.0.1",
            port=3001,  # Use different port temporarily
            reload=True,  # Enable reload to pick up changes
            log_level="info"
        )
    except Exception as e:
        print(f"Failed to start server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
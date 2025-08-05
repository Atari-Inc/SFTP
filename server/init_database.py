#!/usr/bin/env python3
"""
Initialize database separately
"""
import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the current directory to Python path
sys.path.append(os.path.dirname(__file__))

def main():
    """Initialize the database"""
    print("Initializing database...")
    
    try:
        from app.db.init_db import init_db
        init_db()
        print("Database initialized successfully!")
        print("Default users:")
        print("  Admin: admin / admin123")
        print("  User: user / user123")
    except Exception as e:
        print(f"Database initialization failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
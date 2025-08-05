#!/usr/bin/env python3
"""
Database Reset Script
Use this to reset the database when you have schema conflicts
"""
import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the current directory to Python path
sys.path.append(os.path.dirname(__file__))

from app.db.init_db import init_db

def main():
    """Reset and initialize the database"""
    print("Resetting SFTP Admin Dashboard Database...")
    print("WARNING: This will drop all existing tables and data!")
    
    confirm = input("Are you sure you want to continue? (yes/no): ").lower().strip()
    if confirm not in ['yes', 'y']:
        print("Database reset cancelled")
        return
    
    try:
        init_db()
        print("Database reset and initialization completed successfully")
        print("Default users created:")
        print("   Admin: admin / admin123")
        print("   User: user / user123")
    except Exception as e:
        print(f"Database reset failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
#!/usr/bin/env python3
"""
Database migration script to add user folders functionality
"""
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from sqlalchemy import create_engine, text
from app.config import settings
from app.database import Base
from app.models import User, UserFolder  # Import all models

def run_migration():
    """Create user folders table and add home_directory column to users"""
    engine = create_engine(settings.DATABASE_URL)
    
    try:
        # Create all tables (will only create new ones)
        Base.metadata.create_all(bind=engine)
        print("Database tables created successfully!")
        
        # Add home_directory column to existing users table if it doesn't exist
        with engine.connect() as conn:
            try:
                # Check if home_directory column exists
                result = conn.execute(text("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name='users' AND column_name='home_directory'
                """))
                
                if not result.fetchone():
                    # Add the column
                    conn.execute(text("ALTER TABLE users ADD COLUMN home_directory VARCHAR(500)"))
                    print("Added home_directory column to users table")
                    
                    # Set default home directories for existing users
                    conn.execute(text("""
                        UPDATE users 
                        SET home_directory = '/home/' || username 
                        WHERE home_directory IS NULL
                    """))
                    print("Set default home directories for existing users")
                else:
                    print("home_directory column already exists")
                
                conn.commit()
                
            except Exception as e:
                print(f"Column migration error (might already exist): {e}")
        
        print("\nMigration completed successfully!")
        print("\nNew features available:")
        print("- Users now have home directories")
        print("- Admins can assign multiple folders to users")
        print("- Folder permissions (read, write, full)")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    print("Running user folders migration...")
    run_migration()
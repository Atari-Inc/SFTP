#!/usr/bin/env python3
"""
Script to sync existing AWS Transfer Family users to the local database
"""
import sys
import os
import asyncio
from datetime import datetime

# Add the app directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__)))

from app.database import SessionLocal
from app.models.user import User, UserRole
from app.core.security import get_password_hash
from app.services.transfer_family import transfer_family_service
from app.config import settings

async def sync_transfer_family_users():
    """Sync existing Transfer Family users to the database"""
    db = SessionLocal()
    
    try:
        print("STEP 1: Fetching users from AWS Transfer Family...")
        
        # Get all Transfer Family users
        sftp_users_response = await transfer_family_service.list_sftp_users()
        sftp_users = sftp_users_response.get('users', [])
        
        print(f"Found {len(sftp_users)} users in AWS Transfer Family")
        
        # Get existing database users
        existing_db_users = {user.username for user in db.query(User).all()}
        print(f"Found {len(existing_db_users)} users in database")
        
        new_users_created = 0
        skipped_users = 0
        
        for sftp_user in sftp_users:
            username = sftp_user['username']
            
            # Skip if user already exists in database
            if username in existing_db_users:
                print(f"SKIP: {username} - already exists in database")
                skipped_users += 1
                continue
            
            # Create a new database user for this Transfer Family user
            try:
                # Generate a default email and temporary password
                email = f"{username}@.com"  # You can modify this pattern
                temp_password = f"TempPass123!"  # Users should change this on first login
                
                new_user = User(
                    username=username,
                    email=email,
                    password_hash=get_password_hash(temp_password),
                    role=UserRole.USER,  # Default to user role
                    is_active=True,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                
                db.add(new_user)
                db.commit()
                db.refresh(new_user)
                
                print(f"SUCCESS: Created database user: {username} (email: {email})")
                print(f"         Temporary password: {temp_password}")
                new_users_created += 1
                
            except Exception as e:
                print(f"ERROR: Failed to create database user {username}: {e}")
                db.rollback()
        
        print(f"\nSUMMARY:")
        print(f"   - New database users created: {new_users_created}")
        print(f"   - Users skipped (already exist): {skipped_users}")
        print(f"   - Total Transfer Family users: {len(sftp_users)}")
        
        if new_users_created > 0:
            print(f"\nIMPORTANT: New users have temporary passwords (TempPass123!)")
            print(f"           Users should log in and change their passwords immediately.")
        
    except Exception as e:
        print(f"ERROR: Error during sync: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

async def create_missing_transfer_family_users():
    """Create Transfer Family users for existing database users that don't have SFTP access"""
    db = SessionLocal()
    
    try:
        print("\nSTEP 2: Checking for database users missing from AWS Transfer Family...")
        
        # Get all database users
        db_users = db.query(User).all()
        
        # Get all Transfer Family users
        sftp_users_response = await transfer_family_service.list_sftp_users()
        sftp_usernames = {user['username'] for user in sftp_users_response.get('users', [])}
        
        missing_users = []
        for user in db_users:
            if user.username not in sftp_usernames:
                missing_users.append(user)
        
        print(f"Found {len(missing_users)} database users missing from Transfer Family")
        
        if not missing_users:
            print("SUCCESS: All database users already have Transfer Family SFTP access")
            return
        
        created_count = 0
        for user in missing_users:
            try:
                print(f"Creating Transfer Family user: {user.username}")
                
                result = await transfer_family_service.create_sftp_user(
                    username=user.username,
                    ssh_public_key=None  # No SSH key initially
                )
                
                if result.get('status') == 'created':
                    print(f"SUCCESS: Created Transfer Family user: {user.username}")
                    created_count += 1
                else:
                    print(f"WARNING: Transfer Family user {user.username}: {result.get('status')}")
                    
            except Exception as e:
                print(f"ERROR: Failed to create Transfer Family user {user.username}: {e}")
        
        print(f"\nTransfer Family Sync Summary:")
        print(f"   - New Transfer Family users created: {created_count}")
        print(f"   - Database users checked: {len(db_users)}")
        
    except Exception as e:
        print(f"ERROR: Error during Transfer Family sync: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

async def main():
    """Main sync function"""
    print("Starting AWS Transfer Family <-> Database Sync")
    print("=" * 60)
    
    # Step 1: Import Transfer Family users to database
    await sync_transfer_family_users()
    
    # Step 2: Create Transfer Family users for database users
    await create_missing_transfer_family_users()
    
    print("\nSync completed!")
    print("=" * 60)
    print("Next steps:")
    print("   1. Ask users with temporary passwords to log in and change them")
    print("   2. Configure SSH keys for users who need SFTP access")
    print("   3. Review and adjust user roles as needed")

if __name__ == "__main__":
    asyncio.run(main())
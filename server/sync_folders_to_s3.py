#!/usr/bin/env python3
"""
Script to sync existing virtual folders from database to S3
Run this to create S3 placeholder objects for existing folders
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.file import File, FileType
from app.services.s3_service import s3_service

def sync_folders_to_s3():
    """Sync all existing folders from database to S3"""
    db: Session = SessionLocal()
    
    try:
        # Get all folders from database
        folders = db.query(File).filter(File.type == FileType.FOLDER).all()
        
        print(f"Found {len(folders)} folders in database")
        
        synced_count = 0
        failed_count = 0
        
        for folder in folders:
            # Generate S3 path
            folder_path = f"{folder.path.rstrip('/')}/{folder.name}" if folder.path != "/" else f"/{folder.name}"
            s3_folder_path = folder_path.lstrip("/")
            
            print(f"Processing folder: {folder.name} -> {s3_folder_path}")
            
            # Check if already exists in S3
            if s3_service.file_exists(f"{s3_folder_path}/"):
                print(f"  ✓ Already exists in S3")
                continue
            
            # Create in S3
            if s3_service.create_folder(s3_folder_path):
                print(f"  ✓ Created in S3")
                # Update database record with S3 key
                folder.s3_key = f"{s3_folder_path}/"
                synced_count += 1
            else:
                print(f"  ✗ Failed to create in S3")
                failed_count += 1
        
        # Commit database updates
        db.commit()
        
        print(f"\nSync completed:")
        print(f"  Synced: {synced_count} folders")
        print(f"  Failed: {failed_count} folders")
        print(f"  Total processed: {len(folders)} folders")
        
    except Exception as e:
        print(f"Error during sync: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("Starting folder sync to S3...")
    sync_folders_to_s3()
    print("Folder sync completed!")
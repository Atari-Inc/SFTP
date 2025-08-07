from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File as FastAPIFile, Form, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
import io
from datetime import datetime
from pydantic import BaseModel
from ..database import get_db
from ..models.file import File
from ..models.user import User
from ..core.dependencies import get_current_user
from ..services.s3_service import s3_service
from ..services.activity_logger import log_activity
from ..models.activity import ActivityAction, ActivityStatus
from ..config import settings

router = APIRouter()

@router.get("/test")
async def test_endpoint():
    """Test endpoint to verify files API is working"""
    return {"message": "Files API is working", "timestamp": datetime.utcnow().isoformat()}

@router.get("/test-file-listing")
async def test_file_listing(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Test endpoint to check file ID generation"""
    
    # Test different paths
    test_paths = ["/", "/atari-files-transfer", "/atari-files-transfer/suraj"]
    results = {}
    
    for test_path in test_paths:
        print(f"\n=== TESTING PATH: {test_path} ===")
        
        # Normalize path
        if not test_path.startswith("/"):
            test_path = "/" + test_path
        
        # Convert path to S3 prefix
        prefix = test_path.lstrip("/")
        if prefix and not prefix.endswith("/"):
            prefix += "/"
            
        print(f"S3 prefix: '{prefix}'")
        
        # Get files from S3
        s3_objects = s3_service.list_files(prefix)
        
        file_responses = []
        processed_paths = set()
        
        for obj in s3_objects[:3]:  # Limit to first 3 for testing
            key = obj.get('Key', '')
            size = obj.get('Size', 0)
            
            if not key or key == prefix:
                continue
                
            # Get relative path from current directory
            relative_key = key[len(prefix):] if prefix else key
            
            # Handle directory structure - show only direct children
            if "/" in relative_key:
                first_slash_index = relative_key.find("/")
                dir_name = relative_key[:first_slash_index]
                remaining_path = relative_key[first_slash_index + 1:]
                
                if remaining_path:  # There's more path after the first directory
                    if dir_name not in processed_paths:
                        processed_paths.add(dir_name)
                        # Create folder entry for the subdirectory  
                        folder_s3_key = f"{prefix}{dir_name}" if prefix else dir_name
                        file_resp = {
                            "id": f"s3_folder:{folder_s3_key}",
                            "name": dir_name,
                            "type": "folder"
                        }
                        file_responses.append(file_resp)
                else:
                    continue  # Skip directory markers
            else:
                # This is a file in current directory
                file_resp = {
                    "id": f"s3_file:{key}",
                    "name": relative_key,
                    "type": "file",
                    "size": size
                }
                file_responses.append(file_resp)
        
        results[test_path] = {
            "prefix": prefix,
            "s3_objects_count": len(s3_objects),
            "generated_items": file_responses
        }
        
        print(f"Generated {len(file_responses)} items:")
        for item in file_responses:
            print(f"  - {item['name']} ({item['type']}) → ID: {item['id']}")
    
    return results

@router.get("/download-by-path")
async def download_file_by_path(
    path: str = Query(..., description="File path to download"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download a file using its full path"""
    print(f"\n=== PATH-BASED DOWNLOAD ===")
    print(f"Requested path: {path}")
    print(f"User: {current_user.username}")
    
    # Normalize path - remove leading slash to get S3 key
    s3_key = path.lstrip('/')
    print(f"S3 key: {s3_key}")
    
    if not s3_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file path"
        )
    
    try:
        # Check if it's a folder (ends with / or is a directory)
        if s3_key.endswith('/') or '.' not in s3_key.split('/')[-1]:
            # This might be a folder - try to download as ZIP
            if not s3_key.endswith('/'):
                s3_key += '/'
            
            # List files in the folder
            objects = s3_service.list_files(s3_key)
            if not objects:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Folder not found or empty"
                )
            
            # Create ZIP file
            import zipfile
            from io import BytesIO
            
            folder_name = s3_key.rstrip('/').split('/')[-1] or 'files'
            zip_buffer = BytesIO()
            
            with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                for obj in objects:
                    obj_key = obj.get('Key', '')
                    if obj_key and obj_key != s3_key:
                        # Download file content
                        file_data = s3_service.download_file(obj_key)
                        if file_data:
                            # Add to zip with relative path
                            relative_path = obj_key[len(s3_key):]
                            zip_file.writestr(relative_path, file_data)
            
            zip_buffer.seek(0)
            
            # Log activity
            await log_activity(
                db=db,
                user_id=current_user.id,
                username=current_user.username,
                action=ActivityAction.DOWNLOAD,
                resource="folder",
                resource_id=path,
                status=ActivityStatus.SUCCESS,
                details={"folder_name": folder_name, "path": path}
            )
            
            return StreamingResponse(
                zip_buffer,
                media_type='application/zip',
                headers={
                    "Content-Disposition": f"attachment; filename=\"{folder_name}.zip\""
                }
            )
        
        else:
            # This is a file
            file_data = s3_service.download_file(s3_key)
            if not file_data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="File not found"
                )
            
            filename = s3_key.split('/')[-1]
            
            # Get file metadata for proper content type
            metadata = s3_service.get_object_metadata(s3_key)
            content_type = metadata.get('content_type') if metadata else _get_mime_type(filename)
            
            # Log activity
            await log_activity(
                db=db,
                user_id=current_user.id,
                username=current_user.username,
                action=ActivityAction.DOWNLOAD,
                resource="file",
                resource_id=path,
                status=ActivityStatus.SUCCESS,
                details={"filename": filename, "path": path}
            )
            
            return StreamingResponse(
                io.BytesIO(file_data),
                media_type=content_type or 'application/octet-stream',
                headers={
                    "Content-Disposition": f"attachment; filename=\"{filename}\""
                }
            )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Download error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Download failed"
        )

@router.put("/rename-by-path")
async def rename_file_by_path(
    old_path: str = Query(..., description="Current file path"),
    new_name: str = Query(..., description="New file name"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Rename a file using its full path"""
    print(f"\n=== PATH-BASED RENAME ===")
    print(f"Old path: {old_path}")
    print(f"New name: {new_name}")
    print(f"User: {current_user.username}")
    
    # Normalize paths
    old_s3_key = old_path.lstrip('/')
    
    if not old_s3_key or not new_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid path or name"
        )
    
    # Generate new S3 key
    path_parts = old_s3_key.split('/')
    path_parts[-1] = new_name  # Replace filename with new name
    new_s3_key = '/'.join(path_parts)
    
    print(f"Old S3 key: {old_s3_key}")
    print(f"New S3 key: {new_s3_key}")
    
    try:
        # Check if old file exists
        if old_s3_key.endswith('/') or '.' not in old_s3_key.split('/')[-1]:
            # This is a folder
            if not old_s3_key.endswith('/'):
                old_s3_key += '/'
                new_s3_key += '/'
            
            # Rename folder (move all contents)
            success = s3_service.move_folder(old_s3_key, new_s3_key)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to rename folder"
                )
        else:
            # This is a file
            success = s3_service.move_object(old_s3_key, new_s3_key)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to rename file"
                )
        
        # Log activity
        await log_activity(
            db=db,
            user_id=current_user.id,
            username=current_user.username,
            action=ActivityAction.UPLOAD,  # Using existing action
            resource="file",
            resource_id=old_path,
            status=ActivityStatus.SUCCESS,
            details={"old_path": old_path, "new_name": new_name, "new_path": f"/{new_s3_key}"}
        )
        
        return {
            "success": True,
            "old_path": old_path,
            "new_path": f"/{new_s3_key}",
            "message": "File renamed successfully"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Rename error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Rename failed"
        )

@router.get("/debug-user-folders")
async def debug_user_folders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Debug endpoint to check user's folder assignments"""
    from ..models.user_folder import UserFolder
    
    user_folders = db.query(UserFolder).filter(
        UserFolder.user_id == current_user.id,
        UserFolder.is_active == True
    ).all()
    
    return {
        "user_id": str(current_user.id),
        "username": current_user.username,
        "folders": [
            {
                "id": str(folder.id),
                "folder_path": folder.folder_path,
                "permission": folder.permission,
                "is_active": folder.is_active
            }
            for folder in user_folders
        ]
    }

@router.get("/", response_model=dict)
async def list_files(
    path: str = Query("/", description="Directory path"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List files in a directory"""
    # Normalize path
    if not path.startswith("/"):
        path = "/" + path
    
    # For admin users, list files directly from S3
    if current_user.role == "admin":
        # Convert path to S3 prefix
        prefix = path.lstrip("/")
        if prefix and not prefix.endswith("/"):
            prefix += "/"
        
        # Get files from S3
        s3_objects = s3_service.list_files(prefix)
        
        file_responses = []
        processed_paths = set()
        
        for obj in s3_objects:
            key = obj.get('Key', '')
            size = obj.get('Size', 0)
            last_modified = obj.get('LastModified')
            
            # Skip empty objects or current directory
            if not key or key == prefix:
                continue
                
            # Get relative path from current directory
            relative_key = key[len(prefix):] if prefix else key
            
            # Handle directory structure - show only direct children
            if "/" in relative_key:
                # Check if this is a direct child or deeper nested item
                first_slash_index = relative_key.find("/")
                dir_name = relative_key[:first_slash_index]
                remaining_path = relative_key[first_slash_index + 1:]
                
                if remaining_path:  # There's more path after the first directory
                    # This is either a subdirectory or a file in a subdirectory
                    if dir_name not in processed_paths:
                        processed_paths.add(dir_name)
                        # Create folder entry for the subdirectory  
                        # Use S3 prefix for folder ID, not filesystem path
                        folder_s3_key = f"{prefix}{dir_name}" if prefix else dir_name
                        file_resp = {
                            "id": f"s3_folder:{folder_s3_key}",
                            "name": dir_name,
                            "size": 0,
                            "type": "folder",
                            "path": f"{path.rstrip('/')}/{dir_name}" if path != "/" else f"/{dir_name}",
                            "mime_type": None,
                            "permissions": "755",
                            "owner": "admin",
                            "group": "admin",
                            "created_at": last_modified.isoformat() if last_modified else None,
                            "modified_at": last_modified.isoformat() if last_modified else None,
                            "accessed_at": None
                        }
                    else:
                        continue  # Already processed this directory
                else:
                    # This is a file directly in the current directory (ending with /)
                    continue  # Skip directory markers
            else:
                # This is a file in current directory
                file_resp = {
                    "id": f"s3_file:{key}",
                    "name": relative_key,
                    "size": size,
                    "type": "file",
                    "path": f"{path.rstrip('/')}/{relative_key}" if path != "/" else f"/{relative_key}",
                    "mime_type": _get_mime_type(relative_key),
                    "permissions": "644",
                    "owner": "admin",
                    "group": "admin",
                    "created_at": last_modified.isoformat() if last_modified else None,
                    "modified_at": last_modified.isoformat() if last_modified else None,
                    "accessed_at": None
                }
            
            file_responses.append(file_resp)
        
        # Debug: Log file listing info (console safe)
        print(f"Files API: Listed {len(file_responses)} items for path '{path}'")
        
        return {
            "data": file_responses,
            "total": len(file_responses),
            "path": path
        }
    
    else:
        # For regular users, get files from database based on their permissions
        # First get user's folder assignments
        from ..models.user_folder import UserFolder
        
        user_folders = db.query(UserFolder).filter(
            UserFolder.user_id == current_user.id,
            UserFolder.is_active == True
        ).all()
        
        # Check if user has access to requested path
        has_access = False
        accessible_paths = []
        
        # For root path, redirect to user's home directory or show accessible folders
        if path == "/":
            # Show user's accessible folders as if they were in root
            file_responses = []
            
            # Add user's home directory
            home_path = f"/home/{current_user.username}"
            file_responses.append({
                "id": f"s3_folder:{home_path}",
                "name": f"home ({current_user.username})",
                "size": 0,
                "type": "folder",
                "path": home_path,
                "mime_type": None,
                "permissions": "755",
                "owner": current_user.username,
                "group": current_user.username,
                "created_at": datetime.utcnow().isoformat(),
                "modified_at": datetime.utcnow().isoformat(),
                "accessed_at": None
            })
            
            # Add user's assigned folders
            for folder in user_folders:
                folder_name = folder.folder_path.strip('/').split('/')[-1] or folder.folder_path
                # Use the folder path as-is, but generate proper ID
                file_responses.append({
                    "id": f"s3_folder:{folder.folder_path}",
                    "name": folder_name,  # Remove "(assigned)" suffix for cleaner display
                    "size": 0,
                    "type": "folder",
                    "path": folder.folder_path,
                    "mime_type": None,
                    "permissions": folder.permission or "755",
                    "owner": current_user.username,
                    "group": current_user.username,
                    "created_at": datetime.utcnow().isoformat(),
                    "modified_at": datetime.utcnow().isoformat(),
                    "accessed_at": None
                })
            
            return {
                "data": file_responses,
                "total": len(file_responses),
                "path": path
            }
        
        # Check access to specific paths
        if path == f"/home/{current_user.username}" or path.startswith(f"/home/{current_user.username}/"):
            has_access = True
        else:
            for folder in user_folders:
                if path == folder.folder_path or path.startswith(folder.folder_path + "/"):
                    has_access = True
                    break
        
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this directory"
            )
        
        # For regular users, use S3 directly (same as admin) - no database storage
        # Convert path to S3 prefix
        prefix = path.lstrip("/")
        if prefix and not prefix.endswith("/"):
            prefix += "/"
        
        # Get files from S3
        s3_objects = s3_service.list_files(prefix)
        
        file_responses = []
        processed_paths = set()
        
        for obj in s3_objects:
            key = obj.get('Key', '')
            size = obj.get('Size', 0)
            last_modified = obj.get('LastModified')
            
            # Skip empty objects or current directory
            if not key or key == prefix:
                continue
                
            # Get relative path from current directory
            relative_key = key[len(prefix):] if prefix else key
            
            # Handle directory structure - show only direct children
            if "/" in relative_key:
                # This is a subdirectory or nested file
                dir_name = relative_key.split("/")[0]
                if dir_name in processed_paths:
                    continue
                processed_paths.add(dir_name)
                
                # Create folder entry
                file_resp = {
                    "id": f"s3_folder:{path.rstrip('/')}/{dir_name}" if path != "/" else f"s3_folder:{dir_name}",
                    "name": dir_name,
                    "size": 0,
                    "type": "folder",
                    "path": f"{path.rstrip('/')}/{dir_name}" if path != "/" else f"/{dir_name}",
                    "mime_type": None,
                    "permissions": "755",
                    "owner": current_user.username,
                    "group": current_user.username,
                    "created_at": last_modified.isoformat() if last_modified else None,
                    "modified_at": last_modified.isoformat() if last_modified else None,
                    "accessed_at": None
                }
            else:
                # This is a file in current directory
                file_resp = {
                    "id": f"s3_file:{key}",
                    "name": relative_key,
                    "size": size,
                    "type": "file",
                    "path": f"{path.rstrip('/')}/{relative_key}" if path != "/" else f"/{relative_key}",
                    "mime_type": _get_mime_type(relative_key),
                    "permissions": "644",
                    "owner": current_user.username,
                    "group": current_user.username,
                    "created_at": last_modified.isoformat() if last_modified else None,
                    "modified_at": last_modified.isoformat() if last_modified else None,
                    "accessed_at": None
                }
            
            file_responses.append(file_resp)
        
        return {
            "data": file_responses,
            "total": len(file_responses),
            "path": path
        }


def _get_mime_type(filename: str) -> Optional[str]:
    """Get MIME type based on file extension"""
    import mimetypes
    mime_type, _ = mimetypes.guess_type(filename)
    return mime_type

@router.post("/upload", response_model=dict)
async def upload_file(
    file: UploadFile = FastAPIFile(...),
    path: str = Form("/"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a file - S3 only, no database storage"""
    # Validate file size
    file_size = 0
    content = await file.read()
    file_size = len(content)
    
    if file_size > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {settings.MAX_FILE_SIZE}"
        )
    
    # Normalize the path for S3 key
    s3_path = path.strip("/")
    if s3_path and not s3_path.endswith("/"):
        s3_path += "/"
    s3_key = f"{s3_path}{file.filename}" if s3_path else file.filename
    
    # Upload to S3 only
    if not s3_service.upload_file(io.BytesIO(content), s3_key, file.content_type):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload file"
        )
    
    # Log activity (no database file record)
    await log_activity(
        db=db,
        user_id=current_user.id,
        username=current_user.username,
        action=ActivityAction.UPLOAD,
        resource="file",
        resource_id=s3_key,  # Use S3 key as ID
        status=ActivityStatus.SUCCESS,
        details={"filename": file.filename, "size": file_size, "s3_key": s3_key}
    )
    
    # Return file info (generated ID format like file listing)
    return {
        "id": f"s3_file:{s3_key}",
        "name": file.filename,
        "size": file_size,
        "type": "file",
        "path": path,
        "s3_key": s3_key,
        "mime_type": file.content_type,
        "permissions": "644",
        "owner": current_user.username,
        "group": current_user.username,
        "created_at": datetime.utcnow().isoformat(),
        "modified_at": datetime.utcnow().isoformat(),
        "accessed_at": None,
        "success": True,
        "message": "File uploaded successfully"
    }

@router.get("/{file_id}/download")
async def download_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download a file or folder as zip - S3 only, no database storage"""
    from urllib.parse import unquote
    
    # Debug logging (console safe)
    decoded_file_id = unquote(file_id)
    print(f"Download request: {decoded_file_id} by {current_user.username}")
    
    # Additional debug for S3 key extraction
    if decoded_file_id.startswith('s3_file:'):
        s3_key = decoded_file_id[8:]
        print(f"Extracted file S3 key: {s3_key}")
    elif decoded_file_id.startswith('s3_folder:'):
        s3_prefix = decoded_file_id[10:]
        print(f"Extracted folder S3 prefix: {s3_prefix}")
    
    # Handle both files and folders
    if decoded_file_id.startswith("s3_file:"):
        # Download single file
        s3_key = decoded_file_id[8:]  # Remove "s3_file:" prefix
        
        # Extract filename from S3 key
        filename = s3_key.split("/")[-1]
        
        # Download from S3
        file_data = s3_service.download_file(s3_key)
        if not file_data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to download file"
            )
        
        # Get file metadata for proper content type
        metadata = s3_service.get_object_metadata(s3_key)
        content_type = metadata.get('content_type') if metadata else _get_mime_type(filename)
        
        # Log activity
        await log_activity(
            db=db,
            user_id=current_user.id,
            username=current_user.username,
            action=ActivityAction.DOWNLOAD,
            resource="file",
            resource_id=decoded_file_id,
            status=ActivityStatus.SUCCESS,
            details={"filename": filename, "s3_key": s3_key}
        )
        
        return StreamingResponse(
            io.BytesIO(file_data),
            media_type=content_type or 'application/octet-stream',
            headers={
                "Content-Disposition": f"attachment; filename=\"{filename}\""
            }
        )
        
    elif decoded_file_id.startswith("s3_folder:"):
        # Download folder as zip
        import zipfile
        from io import BytesIO
        
        s3_prefix = decoded_file_id[10:]  # Remove "s3_folder:" prefix
        if not s3_prefix.endswith("/"):
            s3_prefix += "/"
        
        # Get folder name for zip file
        folder_name = s3_prefix.rstrip("/").split("/")[-1]
        
        # Create zip file in memory
        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # List all files in the folder
            objects = s3_service.list_files(s3_prefix)
            
            for obj in objects:
                key = obj.get('Key', '')
                if key and key != s3_prefix:
                    # Download file content
                    file_data = s3_service.download_file(key)
                    if file_data:
                        # Add to zip with relative path
                        relative_path = key[len(s3_prefix):]
                        zip_file.writestr(relative_path, file_data)
        
        # Log activity
        await log_activity(
            db=db,
            user_id=current_user.id,
            username=current_user.username,
            action=ActivityAction.DOWNLOAD,
            resource="folder",
            resource_id=decoded_file_id,
            status=ActivityStatus.SUCCESS,
            details={"folder_name": folder_name, "s3_prefix": s3_prefix}
        )
        
        # Return zip file
        zip_buffer.seek(0)
        return StreamingResponse(
            zip_buffer,
            media_type='application/zip',
            headers={
                "Content-Disposition": f"attachment; filename=\"{folder_name}.zip\""
            }
        )
    else:
        print(f"Invalid file ID format: {decoded_file_id}")
        print(f"File ID should start with 's3_file:' or 's3_folder:'")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invalid file ID format: {decoded_file_id}"
        )

class DeleteFilesRequest(BaseModel):
    file_ids: List[str]

@router.delete("/", response_model=dict)
async def delete_files(
    request: DeleteFilesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete multiple files - S3 only, no database storage"""
    deleted_count = 0
    errors = []
    
    for file_id in request.file_ids:
        try:
            # Only handle S3-only files and folders
            if file_id.startswith("s3_file:"):
                # Extract S3 key directly from the ID
                s3_key = file_id[8:]  # Remove "s3_file:" prefix
                
                # Extract filename from S3 key
                filename = s3_key.split("/")[-1]
                
                # Delete from S3
                success = s3_service.delete_file(s3_key)
                if success:
                    deleted_count += 1
                    # Log activity
                    await log_activity(
                        db=db,
                        user_id=current_user.id,
                        username=current_user.username,
                        action=ActivityAction.DELETE,
                        resource="file",
                        resource_id=file_id,
                        status=ActivityStatus.SUCCESS,
                        details={"filename": filename, "s3_key": s3_key}
                    )
                else:
                    errors.append(f"Failed to delete {filename} from S3")
                    
            elif file_id.startswith("s3_folder:"):
                # Handle folder deletion
                s3_prefix = file_id[10:]  # Remove "s3_folder:" prefix
                if not s3_prefix.endswith("/"):
                    s3_prefix += "/"
                
                # Extract folder name from S3 prefix
                foldername = s3_prefix.rstrip("/").split("/")[-1]
                
                # Delete folder from S3
                success = s3_service.delete_folder(s3_prefix)
                if success:
                    deleted_count += 1
                    # Log activity
                    await log_activity(
                        db=db,
                        user_id=current_user.id,
                        username=current_user.username,
                        action=ActivityAction.DELETE,
                        resource="folder",
                        resource_id=file_id,
                        status=ActivityStatus.SUCCESS,
                        details={"foldername": foldername, "s3_prefix": s3_prefix}
                    )
                else:
                    errors.append(f"Failed to delete folder {foldername} from S3")
            else:
                errors.append(f"Invalid file ID format: {file_id}")
                    
        except Exception as e:
            errors.append(f"Error deleting {file_id}: {str(e)}")
    
    return {
        "message": f"{deleted_count} files deleted successfully",
        "deleted_count": deleted_count,
        "errors": errors,
        "success": len(errors) == 0
    }

@router.post("/folder", response_model=dict)
async def create_folder(
    folder_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new folder - S3 only, no database storage"""
    name = folder_data.get("name")
    path = folder_data.get("path", "/")
    
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Folder name is required"
        )
    
    # Generate full folder path for S3
    folder_path = f"{path.rstrip('/')}/{name}" if path != "/" else f"/{name}"
    s3_folder_path = folder_path.lstrip("/")
    s3_key = f"{s3_folder_path}/"
    
    # Check if folder already exists in S3
    if s3_service.file_exists(s3_key):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Folder already exists"
        )
    
    # Create folder in S3
    if not s3_service.create_folder(s3_folder_path):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create folder in S3"
        )
    
    # Log activity
    await log_activity(
        db=db,
        user_id=current_user.id,
        username=current_user.username,
        action=ActivityAction.CREATE,
        resource="folder",
        resource_id=f"s3_folder:{s3_key}",
        status=ActivityStatus.SUCCESS,
        details={"folder_name": name, "path": path, "s3_path": s3_folder_path}
    )
    
    # Return folder info (generated ID format like file listing)
    from datetime import datetime
    now = datetime.utcnow()
    
    return {
        "id": f"s3_folder:{s3_key}",
        "name": name,
        "size": 0,
        "type": "folder",
        "path": folder_path,
        "mime_type": None,
        "permissions": "755",
        "owner": current_user.username,
        "group": "admin",
        "created_at": now.isoformat(),
        "modified_at": now.isoformat(),
        "accessed_at": None
    }

@router.put("/{file_id}/rename", response_model=dict)
async def rename_file(
    file_id: str,
    rename_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Rename a file or folder - S3 only, no database storage"""
    from urllib.parse import unquote
    
    # Decode the file_id in case it's URL encoded
    decoded_file_id = unquote(file_id)
    print(f"Rename request - Original: {file_id}, Decoded: {decoded_file_id}")
    
    new_name = rename_data.get("name")
    
    if not new_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New name is required"
        )
    
    # Check if this is a database file (UUID format) or S3-only file
    if decoded_file_id.startswith(("s3_file:", "s3_folder:")):
        # This is an S3-only file, extract the S3 key from the ID
        if decoded_file_id.startswith("s3_file:"):
            # Extract S3 key directly from the ID
            old_s3_key = decoded_file_id[8:]  # Remove "s3_file:" prefix
            
            # Extract current filename and path
            old_filename = old_s3_key.split("/")[-1]
            path_prefix = "/".join(old_s3_key.split("/")[:-1])
            
            # Generate new S3 key
            if path_prefix:
                new_s3_key = f"{path_prefix}/{new_name}"
            else:
                new_s3_key = new_name
            
            # Rename in S3 (move to new key)
            success = s3_service.move_object(old_s3_key, new_s3_key)
            
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to rename file in S3"
                )
            
            # Log activity
            await log_activity(
                db=db,
                user_id=current_user.id,
                username=current_user.username,
                action=ActivityAction.UPLOAD,  # Use existing action for now
                resource="file",
                resource_id=file_id,
                status=ActivityStatus.SUCCESS,
                details={"old_name": old_filename, "new_name": new_name, "old_key": old_s3_key, "new_key": new_s3_key}
            )
            
            # Get file metadata from S3 to get accurate size and timestamps
            metadata = s3_service.get_object_metadata(new_s3_key)
            
            return {
                "id": f"s3_file:{new_s3_key}",
                "name": new_name,
                "size": metadata.get('size', 0) if metadata else 0,
                "type": "file",
                "path": f"/{path_prefix}" if path_prefix else "/",
                "mime_type": _get_mime_type(new_name),
                "permissions": "644",
                "owner": current_user.username,
                "group": "admin",
                "created_at": metadata.get('last_modified').isoformat() if metadata and metadata.get('last_modified') else None,
                "modified_at": metadata.get('last_modified').isoformat() if metadata and metadata.get('last_modified') else None,
                "accessed_at": None
            }
            
        elif file_id.startswith("s3_folder:"):
            # Handle folder rename
            old_s3_prefix = file_id[10:]  # Remove "s3_folder:" prefix
            if not old_s3_prefix.endswith("/"):
                old_s3_prefix += "/"
            
            # Extract current folder name and parent path
            old_foldername = old_s3_prefix.rstrip("/").split("/")[-1]
            parent_path = "/".join(old_s3_prefix.rstrip("/").split("/")[:-1])
            
            # Generate new S3 prefix
            if parent_path:
                new_s3_prefix = f"{parent_path}/{new_name}/"
            else:
                new_s3_prefix = f"{new_name}/"
            
            # Rename folder in S3 (move all contents)
            success = s3_service.move_folder(old_s3_prefix, new_s3_prefix)
            
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to rename folder in S3"
                )
            
            # Log activity
            await log_activity(
                db=db,
                user_id=current_user.id,
                username=current_user.username,
                action=ActivityAction.UPLOAD,  # Use existing action for now
                resource="folder",
                resource_id=file_id,
                status=ActivityStatus.SUCCESS,
                details={"old_name": old_foldername, "new_name": new_name, "old_prefix": old_s3_prefix, "new_prefix": new_s3_prefix}
            )
            
            # Return updated folder info
            from datetime import datetime
            now = datetime.utcnow()
            
            return {
                "id": f"s3_folder:{new_s3_prefix.rstrip('/')}",
                "name": new_name,
                "size": 0,
                "type": "folder",
                "path": f"/{parent_path}" if parent_path else "/",
                "mime_type": None,
                "permissions": "755",
                "owner": current_user.username,
                "group": "admin",
                "created_at": now.isoformat(),
                "modified_at": now.isoformat(),
                "accessed_at": None
            }
    
    else:
        # This is a database file with proper UUID - legacy support
        try:
            uuid_id = UUID(file_id)
            file = db.query(File).filter(
                File.id == uuid_id,
                File.owner_id == current_user.id
            ).first()
            
            if not file:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="File not found"
                )
            
            old_name = file.name
            file.name = new_name
            file.modified_at = datetime.utcnow()
            
            db.commit()
            db.refresh(file)
            
            # Log activity
            await log_activity(
                db=db,
                user_id=current_user.id,
                username=current_user.username,
                action=ActivityAction.UPLOAD,
                resource="file",
                resource_id=str(file.id),
                status=ActivityStatus.SUCCESS,
                details={"old_name": old_name, "new_name": new_name}
            )
            
            return {
                "id": str(file.id),
                "name": file.name,
                "size": file.size,
                "type": file.type.value if hasattr(file.type, 'value') else str(file.type),
                "path": file.path,
                "mime_type": file.mime_type,
                "permissions": file.permissions,
                "owner": current_user.username,
                "group": file.group,
                "created_at": file.created_at.isoformat() if file.created_at else None,
                "modified_at": file.modified_at.isoformat() if file.modified_at else None,
                "accessed_at": file.accessed_at.isoformat() if file.accessed_at else None
            }
            
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file ID format"
            )

# Pydantic models for request/response
class MoveFilesRequest(BaseModel):
    file_ids: List[str]
    target_path: str

class CopyFilesRequest(BaseModel):
    file_ids: List[str]
    target_path: str

class RenameRequest(BaseModel):
    name: str

class ShareFileRequest(BaseModel):
    file_id: str
    share_with: List[str]  # emails or usernames
    permission: str = "read"  # read, write
    expires_in: Optional[int] = 3600  # seconds

class BulkOperationRequest(BaseModel):
    operation: str  # delete, move, copy
    file_ids: List[str]
    target_path: Optional[str] = None

@router.put("/move", response_model=dict)
async def move_files(
    request: MoveFilesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Move files to a different location - S3 only, no database storage"""
    moved_count = 0
    errors = []
    
    for file_id in request.file_ids:
        try:
            # Only handle S3-only files and folders
            if file_id.startswith("s3_file:"):
                # Extract S3 key directly from the ID
                old_s3_key = file_id[8:]  # Remove "s3_file:" prefix
                
                # Extract filename from S3 key
                filename = old_s3_key.split("/")[-1]
                
                # Generate new S3 key
                target_path_clean = request.target_path.strip("/")
                if target_path_clean:
                    new_s3_key = f"{target_path_clean}/{filename}"
                else:
                    new_s3_key = filename
                
                # Move in S3
                success = s3_service.move_object(old_s3_key, new_s3_key)
                
                if success:
                    moved_count += 1
                    # Log activity
                    await log_activity(
                        db=db,
                        user_id=current_user.id,
                        username=current_user.username,
                        action=ActivityAction.UPLOAD,  # Use existing action for now
                        resource="file",
                        resource_id=file_id,
                        status=ActivityStatus.SUCCESS,
                        details={"filename": filename, "from_key": old_s3_key, "to_key": new_s3_key}
                    )
                else:
                    errors.append(f"Failed to move {filename} in S3")
                    
            elif file_id.startswith("s3_folder:"):
                # Handle folder moves
                old_s3_prefix = file_id[10:]  # Remove "s3_folder:" prefix
                if not old_s3_prefix.endswith("/"):
                    old_s3_prefix += "/"
                
                # Extract folder name from S3 prefix
                foldername = old_s3_prefix.rstrip("/").split("/")[-1]
                
                # Generate new S3 prefix
                target_path_clean = request.target_path.strip("/")
                if target_path_clean:
                    new_s3_prefix = f"{target_path_clean}/{foldername}/"
                else:
                    new_s3_prefix = f"{foldername}/"
                
                # Move folder in S3
                success = s3_service.move_folder(old_s3_prefix, new_s3_prefix)
                
                if success:
                    moved_count += 1
                    # Log activity
                    await log_activity(
                        db=db,
                        user_id=current_user.id,
                        username=current_user.username,
                        action=ActivityAction.UPLOAD,
                        resource="folder",
                        resource_id=file_id,
                        status=ActivityStatus.SUCCESS,
                        details={"foldername": foldername, "from_prefix": old_s3_prefix, "to_prefix": new_s3_prefix}
                    )
                else:
                    errors.append(f"Failed to move folder {foldername} in S3")
            else:
                errors.append(f"Invalid file ID format: {file_id}")
                
        except Exception as e:
            errors.append(f"Error moving {file_id}: {str(e)}")
    
    return {
        "moved_count": moved_count,
        "errors": errors,
        "success": len(errors) == 0
    }

@router.post("/copy", response_model=dict)
async def copy_files(
    request: CopyFilesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Copy files to a different location - S3 only, no database storage"""
    copied_count = 0
    errors = []
    
    for file_id in request.file_ids:
        try:
            # Only handle S3-only files and folders
            if file_id.startswith("s3_file:"):
                # Extract S3 key directly from the ID
                old_s3_key = file_id[8:]  # Remove "s3_file:" prefix
                
                # Extract filename from S3 key
                filename = old_s3_key.split("/")[-1]
                
                # Generate new S3 key
                target_path_clean = request.target_path.strip("/")
                if target_path_clean:
                    new_s3_key = f"{target_path_clean}/{filename}"
                else:
                    new_s3_key = filename
                
                # Copy in S3
                success = s3_service.copy_object(old_s3_key, new_s3_key)
                
                if success:
                    copied_count += 1
                    # Log activity
                    await log_activity(
                        db=db,
                        user_id=current_user.id,
                        username=current_user.username,
                        action=ActivityAction.UPLOAD,  # Use existing action for now
                        resource="file",
                        resource_id=file_id,
                        status=ActivityStatus.SUCCESS,
                        details={"filename": filename, "from_key": old_s3_key, "to_key": new_s3_key}
                    )
                else:
                    errors.append(f"Failed to copy {filename} in S3")
                    
            elif file_id.startswith("s3_folder:"):
                # Handle folder copies
                old_s3_prefix = file_id[10:]  # Remove "s3_folder:" prefix
                if not old_s3_prefix.endswith("/"):
                    old_s3_prefix += "/"
                
                # Extract folder name from S3 prefix
                foldername = old_s3_prefix.rstrip("/").split("/")[-1]
                
                # Generate new S3 prefix
                target_path_clean = request.target_path.strip("/")
                if target_path_clean:
                    new_s3_prefix = f"{target_path_clean}/{foldername}/"
                else:
                    new_s3_prefix = f"{foldername}/"
                
                # Copy folder in S3
                success = s3_service.copy_folder(old_s3_prefix, new_s3_prefix)
                
                if success:
                    copied_count += 1
                    # Log activity
                    await log_activity(
                        db=db,
                        user_id=current_user.id,
                        username=current_user.username,
                        action=ActivityAction.UPLOAD,
                        resource="folder",
                        resource_id=file_id,
                        status=ActivityStatus.SUCCESS,
                        details={"foldername": foldername, "from_prefix": old_s3_prefix, "to_prefix": new_s3_prefix}
                    )
                else:
                    errors.append(f"Failed to copy folder {foldername} in S3")
            else:
                errors.append(f"Invalid file ID format: {file_id}")
                
        except Exception as e:
            errors.append(f"Error copying {file_id}: {str(e)}")
    
    return {
        "copied_count": copied_count,
        "errors": errors,
        "success": len(errors) == 0
    }

@router.post("/share", response_model=dict)
async def share_file(
    request: ShareFileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Share a file with other users"""
    file = db.query(File).filter(
        File.id == request.file_id,
        File.owner_id == current_user.id
    ).first()
    
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    # Generate presigned URL for sharing
    share_url = s3_service.generate_presigned_url(
        file.s3_key,
        expiration=request.expires_in
    )
    
    if not share_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate share URL"
        )
    
    # Log activity
    await log_activity(
        db=db,
        user_id=current_user.id,
        username=current_user.username,
        action=ActivityAction.UPLOAD,  # Use existing action for now
        resource="file",
        resource_id=str(file.id),
        status=ActivityStatus.SUCCESS,
        details={"shared_with": request.share_with, "permission": request.permission}
    )
    
    return {
        "share_url": share_url,
        "expires_in": request.expires_in,
        "shared_with": request.share_with,
        "permission": request.permission
    }

@router.post("/bulk-operation", response_model=dict)
async def bulk_operation(
    request: BulkOperationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Perform bulk operations on multiple files"""
    if request.operation == "delete":
        delete_req = DeleteFilesRequest(file_ids=request.file_ids)
        return await delete_files(delete_req, current_user, db)
    elif request.operation == "move" and request.target_path:
        move_req = MoveFilesRequest(file_ids=request.file_ids, target_path=request.target_path)
        return await move_files(move_req, current_user, db)
    elif request.operation == "copy" and request.target_path:
        copy_req = CopyFilesRequest(file_ids=request.file_ids, target_path=request.target_path)
        return await copy_files(copy_req, current_user, db)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid operation or missing required parameters"
        )

@router.get("/search", response_model=dict)
async def search_files(
    query: str = Query(..., description="Search query"),
    path: str = Query("/", description="Search within path"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search for files"""
    try:
        # Convert path to S3 prefix
        prefix = path.lstrip("/")
        if prefix and not prefix.endswith("/"):
            prefix += "/"
        
        # Search in S3
        results = s3_service.search_files(query, prefix)
        
        # Filter based on user permissions
        if current_user.role != "admin":
            # For regular users, filter based on their folder assignments
            # This would need to be implemented based on your backend logic
            pass
        
        return {
            "results": results,
            "query": query,
            "path": path,
            "total": len(results)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}"
        )

@router.get("/storage-stats", response_model=dict)
async def get_storage_stats(
    path: str = Query("/", description="Path to calculate stats for"),
    current_user: User = Depends(get_current_user)
):
    """Get storage usage statistics"""
    try:
        prefix = path.lstrip("/")
        if prefix and not prefix.endswith("/"):
            prefix += "/"
        
        stats = s3_service.get_storage_usage(prefix)
        return stats
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get storage stats: {str(e)}"
        )

@router.get("/preview/{file_id}", response_model=dict)
async def preview_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get file preview information - S3 only, no database storage"""
    
    # Only handle S3-only files
    if not file_id.startswith("s3_file:"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file ID format"
        )
    
    # Extract the S3 key from the ID
    s3_key = file_id[8:]  # Remove "s3_file:" prefix
    
    # Extract filename from S3 key
    filename = s3_key.split("/")[-1]
    
    # Get file metadata from S3
    metadata = s3_service.get_object_metadata(s3_key)
    
    if not metadata:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get file metadata"
        )
    
    # Generate temporary URL for preview (shorter expiration)
    preview_url = s3_service.generate_presigned_url(s3_key, expiration=300)  # 5 minutes
    
    mime_type = _get_mime_type(filename)
    
    return {
        "id": file_id,
        "name": filename,
        "size": metadata.get('size', 0),
        "mime_type": mime_type,
        "metadata": metadata,
        "preview_url": preview_url,
        "can_preview": mime_type and (
            mime_type.startswith('image/') or 
            mime_type.startswith('text/') or
            mime_type == 'application/pdf'
        )
    }
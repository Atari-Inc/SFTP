from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File as FastAPIFile, Query, Form, Body
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from uuid import UUID, uuid4
import os
import io
from datetime import datetime
from pydantic import BaseModel
from ..database import get_db
from ..models.file import File, FileType
from ..models.user import User
from ..schemas.file import FileResponse, FileList
from ..core.dependencies import get_current_user
from ..services.s3_service import s3_service
from ..services.activity_logger import log_activity
from ..models.activity import ActivityAction, ActivityStatus
from ..config import settings

router = APIRouter()

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
                # This is a subdirectory or nested file
                dir_name = relative_key.split("/")[0]
                if dir_name in processed_paths:
                    continue
                processed_paths.add(dir_name)
                
                # Create folder entry
                file_resp = {
                    "id": f"folder_{dir_name}_{hash(path + dir_name)}",
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
                # This is a file in current directory
                file_resp = {
                    "id": f"file_{relative_key}_{hash(key)}",
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
                "id": f"folder_home_{current_user.username}_{hash(home_path)}",
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
                    "id": f"folder_assigned_{folder_name}_{hash(folder.folder_path)}",
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
        
        # Get files from database
        files = db.query(File).filter(
            File.owner_id == current_user.id,
            File.path == path
        ).all()
        
        # Convert to response format
        file_responses = []
        for file in files:
            file_resp = {
                "id": str(file.id),
                "name": file.name,
                "size": file.size,
                "type": file.type.value,
                "path": file.path,
                "mime_type": file.mime_type,
                "permissions": file.permissions,
                "owner": current_user.username,
                "group": file.group,
                "created_at": file.created_at.isoformat() if file.created_at else None,
                "modified_at": file.modified_at.isoformat() if file.modified_at else None,
                "accessed_at": file.accessed_at.isoformat() if file.accessed_at else None
            }
            file_responses.append(file_resp)
        
        # If accessing user's home directory or assigned folder and no database files exist, also check S3 directly
        is_assigned_folder = False
        for folder in user_folders:
            if path == folder.folder_path or path.startswith(folder.folder_path + "/"):
                is_assigned_folder = True
                break
        
        # For assigned folders, always check S3 directly since they may not have database records
        if is_assigned_folder or (path.startswith(f"/home/{current_user.username}") and len(file_responses) == 0):
            # Check S3 for files in the assigned folder or user's home directory
            s3_prefix = path.lstrip("/")
            if s3_prefix and not s3_prefix.endswith("/"):
                s3_prefix += "/"
            
            s3_objects = s3_service.list_files(s3_prefix)
            processed_paths = set()
            
            for obj in s3_objects:
                key = obj.get('Key', '')
                size = obj.get('Size', 0)
                last_modified = obj.get('LastModified')
                
                # Skip empty objects or current directory
                if not key or key == s3_prefix:
                    continue
                    
                # Get relative path from current directory
                relative_key = key[len(s3_prefix):] if s3_prefix else key
                
                # Handle directory structure - show only direct children
                if "/" in relative_key:
                    # This is a subdirectory or nested file
                    dir_name = relative_key.split("/")[0]
                    if dir_name in processed_paths:
                        continue
                    processed_paths.add(dir_name)
                    
                    # Create folder entry
                    file_resp = {
                        "id": f"folder_{dir_name}_{hash(path + dir_name)}",
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
                    file_responses.append(file_resp)
                else:
                    # This is a file in current directory
                    file_resp = {
                        "id": f"file_{relative_key}_{hash(key)}",
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

@router.post("/upload", response_model=FileResponse)
async def upload_file(
    file: UploadFile = FastAPIFile(...),
    path: str = Form("/"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a file"""
    # Validate file size
    file_size = 0
    content = await file.read()
    file_size = len(content)
    
    if file_size > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {settings.MAX_FILE_SIZE}"
        )
    
    # Generate S3 key - use path-based structure for admin visibility
    file_id = uuid4()
    # Normalize the path for S3 key
    s3_path = path.strip("/")
    if s3_path and not s3_path.endswith("/"):
        s3_path += "/"
    s3_key = f"{s3_path}{file.filename}" if s3_path else file.filename
    
    # Upload to S3
    if not s3_service.upload_file(io.BytesIO(content), s3_key, file.content_type):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload file"
        )
    
    # Create database record
    db_file = File(
        id=file_id,
        name=file.filename,
        size=file_size,
        type=FileType.FILE,
        path=path,
        s3_key=s3_key,
        mime_type=file.content_type,
        owner_id=current_user.id
    )
    
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    
    # Log activity
    await log_activity(
        db=db,
        user_id=current_user.id,
        username=current_user.username,
        action=ActivityAction.UPLOAD,
        resource="file",
        resource_id=str(db_file.id),
        status=ActivityStatus.SUCCESS,
        details={"filename": file.filename, "size": file_size}
    )
    
    return FileResponse(
        id=db_file.id,
        name=db_file.name,
        size=db_file.size,
        type=db_file.type,
        path=db_file.path,
        mime_type=db_file.mime_type,
        permissions=db_file.permissions,
        owner=current_user.username,
        group=db_file.group,
        created_at=db_file.created_at,
        modified_at=db_file.modified_at,
        accessed_at=db_file.accessed_at
    )

@router.get("/{file_id}/download")
async def download_file(
    file_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download a file"""
    # Get file from database
    file = db.query(File).filter(
        File.id == file_id,
        File.owner_id == current_user.id
    ).first()
    
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    # Download from S3
    file_data = s3_service.download_file(file.s3_key)
    if not file_data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to download file"
        )
    
    # Update accessed time
    file.accessed_at = datetime.utcnow()
    db.commit()
    
    # Log activity
    await log_activity(
        db=db,
        user_id=current_user.id,
        username=current_user.username,
        action=ActivityAction.DOWNLOAD,
        resource="file",
        resource_id=str(file.id),
        status=ActivityStatus.SUCCESS,
        details={"filename": file.name}
    )
    
    return StreamingResponse(
        io.BytesIO(file_data),
        media_type=file.mime_type or 'application/octet-stream',
        headers={
            "Content-Disposition": f"attachment; filename={file.name}"
        }
    )

class DeleteFilesRequest(BaseModel):
    file_ids: List[str]
    current_path: Optional[str] = "/"

@router.delete("/", response_model=dict)
async def delete_files(
    request: DeleteFilesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete multiple files"""
    deleted_count = 0
    errors = []
    
    for file_id in request.file_ids:
        try:
            # Check if this is a database file (UUID format) or S3-only file
            if file_id.startswith(("file_", "folder_")):
                # This is an S3-only file, extract the S3 key from the ID
                if file_id.startswith("file_"):
                    # Extract filename from the generated ID
                    parts = file_id.split("_")
                    if len(parts) >= 2:
                        filename = "_".join(parts[1:-1])  # Remove "file_" prefix and hash suffix
                        
                        # Construct S3 key
                        current_path_clean = request.current_path.strip("/") if request.current_path != "/" else ""
                        if current_path_clean:
                            s3_key = f"{current_path_clean}/{filename}"
                        else:
                            s3_key = filename
                        
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
                    else:
                        errors.append(f"Invalid file ID format: {file_id}")
                        
                elif file_id.startswith("folder_"):
                    # Handle folder deletion
                    parts = file_id.split("_")
                    if len(parts) >= 2:
                        foldername = "_".join(parts[1:-1])
                        
                        # Construct S3 prefix
                        current_path_clean = request.current_path.strip("/") if request.current_path != "/" else ""
                        if current_path_clean:
                            s3_prefix = f"{current_path_clean}/{foldername}/"
                        else:
                            s3_prefix = f"{foldername}/"
                        
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
                        errors.append(f"Invalid folder ID format: {file_id}")
                        
            else:
                # This is a database file with proper UUID
                try:
                    uuid_id = UUID(file_id)
                    file = db.query(File).filter(
                        File.id == uuid_id,
                        File.owner_id == current_user.id
                    ).first()
                    
                    if file:
                        # Delete from S3
                        if file.s3_key:
                            s3_service.delete_file(file.s3_key)
                        
                        # Delete from database
                        db.delete(file)
                        deleted_count += 1
                        
                        # Log activity
                        await log_activity(
                            db=db,
                            user_id=current_user.id,
                            username=current_user.username,
                            action=ActivityAction.DELETE,
                            resource="file",
                            resource_id=str(file.id),
                            status=ActivityStatus.SUCCESS,
                            details={"filename": file.name}
                        )
                    else:
                        errors.append(f"File {file_id} not found in database")
                        
                except ValueError:
                    errors.append(f"Invalid UUID format: {file_id}")
                    
        except Exception as e:
            errors.append(f"Error deleting {file_id}: {str(e)}")
    
    db.commit()
    
    return {
        "message": f"{deleted_count} files deleted successfully",
        "deleted_count": deleted_count,
        "errors": errors,
        "success": len(errors) == 0
    }

@router.post("/folder", response_model=FileResponse)
async def create_folder(
    folder_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new folder"""
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
    
    # Check if folder already exists in S3
    if s3_service.file_exists(f"{s3_folder_path}/"):
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
    
    # Create folder record in database
    folder = File(
        name=name,
        size=0,
        type=FileType.FOLDER,
        path=path,
        s3_key=f"{s3_folder_path}/",
        owner_id=current_user.id
    )
    
    db.add(folder)
    db.commit()
    db.refresh(folder)
    
    # Log activity
    await log_activity(
        db=db,
        user_id=current_user.id,
        username=current_user.username,
        action=ActivityAction.CREATE,
        resource="folder",
        resource_id=str(folder.id),
        status=ActivityStatus.SUCCESS,
        details={"folder_name": name, "path": path, "s3_path": s3_folder_path}
    )
    
    return FileResponse(
        id=folder.id,
        name=folder.name,
        size=folder.size,
        type=folder.type,
        path=folder.path,
        mime_type=folder.mime_type,
        permissions=folder.permissions,
        owner=current_user.username,
        group=folder.group,
        created_at=folder.created_at,
        modified_at=folder.modified_at,
        accessed_at=folder.accessed_at
    )

@router.put("/{file_id}/rename", response_model=FileResponse)
async def rename_file(
    file_id: UUID,
    rename_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Rename a file or folder"""
    new_name = rename_data.get("name")
    
    if not new_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New name is required"
        )
    
    file = db.query(File).filter(
        File.id == file_id,
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
        action=ActivityAction.RENAME,
        resource="file",
        resource_id=str(file.id),
        status=ActivityStatus.SUCCESS,
        details={"old_name": old_name, "new_name": new_name}
    )
    
    return FileResponse(
        id=file.id,
        name=file.name,
        size=file.size,
        type=file.type,
        path=file.path,
        mime_type=file.mime_type,
        permissions=file.permissions,
        owner=current_user.username,
        group=file.group,
        created_at=file.created_at,
        modified_at=file.modified_at,
        accessed_at=file.accessed_at
    )

# Pydantic models for request/response
class MoveFilesRequest(BaseModel):
    file_ids: List[str]
    target_path: str
    current_path: Optional[str] = "/"

class CopyFilesRequest(BaseModel):
    file_ids: List[str]
    target_path: str
    current_path: Optional[str] = "/"

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
    current_path: Optional[str] = "/"

@router.put("/move", response_model=dict)
async def move_files(
    request: MoveFilesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Move files to a different location"""
    moved_count = 0
    errors = []
    
    for file_id in request.file_ids:
        try:
            # Check if this is a database file (UUID format) or S3-only file
            if file_id.startswith(("file_", "folder_")):
                # This is an S3-only file, extract the S3 key from the ID
                if file_id.startswith("file_"):
                    # Extract filename from the generated ID
                    parts = file_id.split("_")
                    if len(parts) >= 2:
                        # Reconstruct the filename (everything between "file_" and the hash)
                        filename = "_".join(parts[1:-1])  # Remove "file_" prefix and hash suffix
                        
                        # Get current path to construct full S3 key
                        current_path_clean = request.current_path.strip("/") if request.current_path != "/" else ""
                        if current_path_clean:
                            old_s3_key = f"{current_path_clean}/{filename}"
                        else:
                            old_s3_key = filename
                        
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
                    else:
                        errors.append(f"Invalid file ID format: {file_id}")
                        
                elif file_id.startswith("folder_"):
                    # Handle folder moves similarly
                    parts = file_id.split("_")
                    if len(parts) >= 2:
                        foldername = "_".join(parts[1:-1])
                        
                        # Construct S3 prefix for folder
                        current_path_clean = request.current_path.strip("/") if request.current_path != "/" else ""
                        if current_path_clean:
                            old_s3_prefix = f"{current_path_clean}/{foldername}/"
                        else:
                            old_s3_prefix = f"{foldername}/"
                        
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
                        errors.append(f"Invalid folder ID format: {file_id}")
                        
            else:
                # This is a database file with proper UUID
                try:
                    uuid_id = UUID(file_id)
                    file = db.query(File).filter(
                        File.id == uuid_id,
                        File.owner_id == current_user.id
                    ).first()
                    
                    if not file:
                        errors.append(f"File {file_id} not found in database")
                        continue
                    
                    # Generate new S3 key
                    old_s3_key = file.s3_key
                    target_path_clean = request.target_path.strip("/")
                    if target_path_clean:
                        new_s3_key = f"{target_path_clean}/{file.name}"
                    else:
                        new_s3_key = file.name
                    
                    # Move in S3
                    if file.type == FileType.FOLDER:
                        success = s3_service.move_folder(old_s3_key, new_s3_key)
                    else:
                        success = s3_service.move_object(old_s3_key, new_s3_key)
                    
                    if success:
                        # Update database
                        file.s3_key = new_s3_key
                        file.path = request.target_path
                        file.modified_at = datetime.utcnow()
                        moved_count += 1
                        
                        # Log activity
                        await log_activity(
                            db=db,
                            user_id=current_user.id,
                            username=current_user.username,
                            action=ActivityAction.UPLOAD,
                            resource="file",
                            resource_id=str(file.id),
                            status=ActivityStatus.SUCCESS,
                            details={"from_path": file.path, "to_path": request.target_path}
                        )
                    else:
                        errors.append(f"Failed to move {file.name} in S3")
                        
                except ValueError:
                    errors.append(f"Invalid UUID format: {file_id}")
                
        except Exception as e:
            errors.append(f"Error moving {file_id}: {str(e)}")
    
    db.commit()
    
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
    """Copy files to a different location"""
    copied_count = 0
    errors = []
    
    for file_id in request.file_ids:
        try:
            # Check if this is a database file (UUID format) or S3-only file
            if file_id.startswith(("file_", "folder_")):
                # This is an S3-only file, extract the S3 key from the ID
                if file_id.startswith("file_"):
                    # Extract filename from the generated ID
                    parts = file_id.split("_")
                    if len(parts) >= 2:
                        # Reconstruct the filename (everything between "file_" and the hash)
                        filename = "_".join(parts[1:-1])  # Remove "file_" prefix and hash suffix
                        
                        # Get current path to construct full S3 key
                        current_path_clean = request.current_path.strip("/") if request.current_path != "/" else ""
                        if current_path_clean:
                            old_s3_key = f"{current_path_clean}/{filename}"
                        else:
                            old_s3_key = filename
                        
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
                    else:
                        errors.append(f"Invalid file ID format: {file_id}")
                        
                elif file_id.startswith("folder_"):
                    # Handle folder copies similarly
                    parts = file_id.split("_")
                    if len(parts) >= 2:
                        foldername = "_".join(parts[1:-1])
                        
                        # Construct S3 prefix for folder
                        current_path_clean = request.current_path.strip("/") if request.current_path != "/" else ""
                        if current_path_clean:
                            old_s3_prefix = f"{current_path_clean}/{foldername}/"
                        else:
                            old_s3_prefix = f"{foldername}/"
                        
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
                        errors.append(f"Invalid folder ID format: {file_id}")
                        
            else:
                # This is a database file with proper UUID
                try:
                    uuid_id = UUID(file_id)
                    file = db.query(File).filter(
                        File.id == uuid_id,
                        File.owner_id == current_user.id
                    ).first()
                    
                    if not file:
                        errors.append(f"File {file_id} not found in database")
                        continue
                    
                    # Generate new S3 key
                    old_s3_key = file.s3_key
                    target_path_clean = request.target_path.strip("/")
                    if target_path_clean:
                        new_s3_key = f"{target_path_clean}/{file.name}"
                    else:
                        new_s3_key = file.name
                    
                    # Copy in S3
                    if file.type == FileType.FOLDER:
                        success = s3_service.copy_folder(old_s3_key, new_s3_key)
                    else:
                        success = s3_service.copy_object(old_s3_key, new_s3_key)
                    
                    if success:
                        # Create new database record
                        new_file = File(
                            id=uuid4(),
                            name=file.name,
                            size=file.size,
                            type=file.type,
                            path=request.target_path,
                            s3_key=new_s3_key,
                            mime_type=file.mime_type,
                            owner_id=current_user.id
                        )
                        
                        db.add(new_file)
                        copied_count += 1
                        
                        # Log activity
                        await log_activity(
                            db=db,
                            user_id=current_user.id,
                            username=current_user.username,
                            action=ActivityAction.UPLOAD,
                            resource="file",
                            resource_id=str(new_file.id),
                            status=ActivityStatus.SUCCESS,
                            details={"from_path": file.path, "to_path": request.target_path, "original_id": str(file.id)}
                        )
                    else:
                        errors.append(f"Failed to copy {file.name} in S3")
                        
                except ValueError:
                    errors.append(f"Invalid UUID format: {file_id}")
                
        except Exception as e:
            errors.append(f"Error copying {file_id}: {str(e)}")
    
    db.commit()
    
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
        delete_req = DeleteFilesRequest(file_ids=request.file_ids, current_path=request.current_path)
        return await delete_files(delete_req, current_user, db)
    elif request.operation == "move" and request.target_path:
        move_req = MoveFilesRequest(file_ids=request.file_ids, target_path=request.target_path, current_path=request.current_path)
        return await move_files(move_req, current_user, db)
    elif request.operation == "copy" and request.target_path:
        copy_req = CopyFilesRequest(file_ids=request.file_ids, target_path=request.target_path, current_path=request.current_path)
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
    file_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get file preview information"""
    file = db.query(File).filter(
        File.id == file_id,
        File.owner_id == current_user.id
    ).first()
    
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    # Get file metadata from S3
    metadata = s3_service.get_object_metadata(file.s3_key)
    
    if not metadata:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get file metadata"
        )
    
    # Generate temporary URL for preview (shorter expiration)
    preview_url = s3_service.generate_presigned_url(file.s3_key, expiration=300)  # 5 minutes
    
    return {
        "id": str(file.id),
        "name": file.name,
        "size": file.size,
        "mime_type": file.mime_type,
        "metadata": metadata,
        "preview_url": preview_url,
        "can_preview": file.mime_type and (
            file.mime_type.startswith('image/') or 
            file.mime_type.startswith('text/') or
            file.mime_type == 'application/pdf'
        )
    }
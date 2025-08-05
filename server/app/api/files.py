from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File as FastAPIFile, Query, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID, uuid4
import os
import io
from datetime import datetime
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
    
    # Get files from database
    files = db.query(File).filter(
        File.owner_id == current_user.id,
        File.path == path
    ).all()
    
    # Convert to response format
    file_responses = []
    for file in files:
        file_resp = FileResponse(
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
        file_responses.append(file_resp)
    
    return {
        "data": file_responses,
        "total": len(file_responses),
        "path": path
    }

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
    
    # Generate S3 key
    file_id = uuid4()
    s3_key = f"{current_user.id}/{file_id}/{file.filename}"
    
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

@router.delete("/", response_model=dict)
async def delete_files(
    file_ids: List[UUID],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete multiple files"""
    deleted_count = 0
    
    for file_id in file_ids:
        file = db.query(File).filter(
            File.id == file_id,
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
    
    db.commit()
    
    return {"message": f"{deleted_count} files deleted successfully"}

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
    
    # Check if folder already exists
    existing = db.query(File).filter(
        File.owner_id == current_user.id,
        File.path == path,
        File.name == name,
        File.type == FileType.FOLDER
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Folder already exists"
        )
    
    # Create folder record
    folder = File(
        name=name,
        size=0,
        type=FileType.FOLDER,
        path=path,
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
        details={"folder_name": name, "path": path}
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
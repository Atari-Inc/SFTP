from pydantic import BaseModel, Field, UUID4
from typing import Optional, List
from datetime import datetime
from ..models.file import FileType

class FileBase(BaseModel):
    name: str = Field(..., max_length=255)
    type: FileType
    path: str = Field(..., max_length=1000)

class FileCreate(FileBase):
    size: Optional[int] = 0
    mime_type: Optional[str] = None
    s3_key: Optional[str] = None

class FileResponse(FileBase):
    id: UUID4
    size: int
    mime_type: Optional[str]
    permissions: str
    owner: str  # username
    group: str
    created_at: datetime
    modified_at: datetime
    accessed_at: datetime
    
    class Config:
        from_attributes = True

class FileList(BaseModel):
    files: List[FileResponse]
    total: int
    path: str
from pydantic import BaseModel, EmailStr, Field, UUID4
from typing import Optional, List
from datetime import datetime
from ..models.user import UserRole

class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    role: UserRole = UserRole.USER
    home_directory: Optional[str] = None

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)
    ssh_public_key: Optional[str] = None
    folder_assignments: Optional[List['FolderAssignmentCreate']] = []
    enable_sftp: Optional[bool] = False
    private_key: Optional[str] = None

class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    password: Optional[str] = Field(None, min_length=6)
    ssh_public_key: Optional[str] = None
    home_directory: Optional[str] = None
    folder_assignments: Optional[List['FolderAssignmentCreate']] = None

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(UserBase):
    id: UUID4
    is_active: bool
    last_login: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    folder_assignments: Optional[List['FolderAssignmentResponse']] = []
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse

# Folder Assignment Schemas
class FolderAssignmentBase(BaseModel):
    folder_path: str
    permission: str = "read"

class FolderAssignmentCreate(FolderAssignmentBase):
    pass

class FolderAssignmentResponse(FolderAssignmentBase):
    id: UUID4
    user_id: UUID4
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class TokenData(BaseModel):
    username: Optional[str] = None
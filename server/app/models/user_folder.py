from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from ..database import Base

class FolderPermission(str, enum.Enum):
    READ = "read"
    WRITE = "write"
    FULL = "full"

class UserFolder(Base):
    __tablename__ = "user_folders"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    folder_path = Column(String(500), nullable=False)
    permission = Column(Enum(FolderPermission), default=FolderPermission.READ, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="folder_assignments")
    
    def __repr__(self):
        return f"<UserFolder {self.user_id}:{self.folder_path}>"
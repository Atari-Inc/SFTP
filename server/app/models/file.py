from sqlalchemy import Column, String, BigInteger, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from ..database import Base

class FileType(str, enum.Enum):
    FILE = "file"
    FOLDER = "folder"

class File(Base):
    __tablename__ = "files"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    size = Column(BigInteger, default=0)
    type = Column(Enum(FileType), nullable=False)
    path = Column(String(1000), nullable=False, index=True)
    s3_key = Column(String(1000), nullable=True)  # S3 object key
    mime_type = Column(String(100), nullable=True)
    permissions = Column(String(10), default="rw-r--r--")
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    group = Column(String(50), default="users")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    accessed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    owner = relationship("User", back_populates="files")
    
    def __repr__(self):
        return f"<File {self.name} ({self.type})>"
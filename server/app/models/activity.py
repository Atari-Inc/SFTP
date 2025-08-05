from sqlalchemy import Column, String, DateTime, ForeignKey, JSON, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from ..database import Base

class ActivityStatus(str, enum.Enum):
    SUCCESS = "success"
    FAILURE = "failure"

class ActivityAction(str, enum.Enum):
    LOGIN = "login"
    LOGOUT = "logout"
    UPLOAD = "upload"
    DOWNLOAD = "download"
    DELETE = "delete"
    CREATE = "create"
    UPDATE = "update"
    VIEW = "view"
    MOVE = "move"
    RENAME = "rename"

class ActivityLog(Base):
    __tablename__ = "activity_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    username = Column(String(50), nullable=False)  # Denormalized for performance
    action = Column(Enum(ActivityAction), nullable=False, index=True)
    resource = Column(String(255), nullable=False)
    resource_id = Column(String(255), nullable=True)
    details = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=False)
    user_agent = Column(String(500), nullable=True)
    file_path = Column(String(1000), nullable=True)  # Track file paths for file operations
    location_country = Column(String(100), nullable=True)  # Country from IP geolocation
    location_city = Column(String(100), nullable=True)  # City from IP geolocation
    location_region = Column(String(100), nullable=True)  # State/Region from IP geolocation
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    status = Column(Enum(ActivityStatus), nullable=False, index=True)
    
    # Relationships
    user = relationship("User", back_populates="activity_logs")
    
    def __repr__(self):
        return f"<ActivityLog {self.username} - {self.action} - {self.timestamp}>"
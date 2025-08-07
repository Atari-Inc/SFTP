from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from ..database import Base

class SftpAuth(Base):
    """Store SFTP authentication credentials separately from web login"""
    __tablename__ = "sftp_auth"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True)
    sftp_username = Column(String(50), unique=True, nullable=False, index=True)
    sftp_password_hash = Column(String(255), nullable=True)  # For password auth
    ssh_public_key = Column(Text, nullable=True)  # For key auth
    ssh_private_key = Column(Text, nullable=True)  # Store generated private key
    auth_method = Column(String(20), default="ssh_key")  # "password" or "ssh_key"
    is_active = Column(Boolean, default=True, nullable=False)
    last_sftp_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationship
    user = relationship("User", backref="sftp_auth", uselist=False)
    
    def __repr__(self):
        return f"<SftpAuth {self.sftp_username}>"
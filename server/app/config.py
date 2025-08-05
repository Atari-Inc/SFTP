
from pydantic_settings import BaseSettings
from typing import Optional
import os
from functools import lru_cache

class Settings(BaseSettings):
    # Server Configuration
    PORT: int = 3001
    NODE_ENV: str = "development"
    
    # Database Configuration
    DB_HOST: str
    DB_PORT: int = 5432
    DB_NAME: str
    DB_USER: str
    DB_PASSWORD: str
    DATABASE_URL: str
    
    # JWT Configuration
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRES_IN: str = "7d"
    JWT_REFRESH_SECRET: str
    JWT_REFRESH_EXPIRES_IN: str = "30d"
    
    # AWS Configuration
    AWS_ACCESS_KEY_ID: str
    AWS_SECRET_ACCESS_KEY: str
    AWS_REGION: str
    AWS_S3_BUCKET: str
    AWS_ROLE_ARN: str
    
    # SFTP Configuration
    SFTP_HOST: Optional[str] = None
    SFTP_PORT: int = 22
    SFTP_USERNAME: Optional[str] = None
    SFTP_PASSWORD: Optional[str] = None
    SFTP_PRIVATE_KEY_PATH: Optional[str] = None
    
    # Email Configuration
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_SECURE: bool = False
    SMTP_USER: Optional[str] = None
    SMTP_PASS: Optional[str] = None
    
    # Redis Configuration
    REDIS_URL: Optional[str] = None
    
    # File Upload Configuration
    MAX_FILE_SIZE: str = "100MB"
    ALLOWED_FILE_TYPES: str = "*"
    UPLOAD_DIR: str = "uploads/"
    
    # Security Configuration
    BCRYPT_ROUNDS: int = 12
    RATE_LIMIT_WINDOW_MS: int = 900000
    RATE_LIMIT_MAX_REQUESTS: int = 100
    
    # Logging Configuration
    LOG_LEVEL: str = "info"
    LOG_FILE: str = "logs/app.log"
    
    # CORS Configuration
    CORS_ORIGINS: list = ["http://localhost:3000", "http://localhost:3001"]
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        
    @property
    def max_file_size_bytes(self) -> int:
        """Convert MAX_FILE_SIZE to bytes"""
        size = self.MAX_FILE_SIZE.upper()
        if size.endswith('GB'):
            return int(size[:-2]) * 1024 * 1024 * 1024
        elif size.endswith('MB'):
            return int(size[:-2]) * 1024 * 1024
        elif size.endswith('KB'):
            return int(size[:-2]) * 1024
        else:
            return int(size)

@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
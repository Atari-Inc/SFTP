from datetime import datetime, timedelta
from typing import Optional, Union
from jose import JWTError, jwt
from passlib.context import CryptContext
from ..config import settings

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed password"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        # Parse JWT_EXPIRES_IN (e.g., "7d" -> 7 days)
        expires_in = settings.JWT_EXPIRES_IN
        if expires_in.endswith('d'):
            days = int(expires_in[:-1])
            expire = datetime.utcnow() + timedelta(days=days)
        elif expires_in.endswith('h'):
            hours = int(expires_in[:-1])
            expire = datetime.utcnow() + timedelta(hours=hours)
        else:
            expire = datetime.utcnow() + timedelta(days=7)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict) -> str:
    """Create a JWT refresh token"""
    to_encode = data.copy()
    
    # Parse JWT_REFRESH_EXPIRES_IN (e.g., "30d" -> 30 days)
    expires_in = settings.JWT_REFRESH_EXPIRES_IN
    if expires_in.endswith('d'):
        days = int(expires_in[:-1])
        expire = datetime.utcnow() + timedelta(days=days)
    else:
        expire = datetime.utcnow() + timedelta(days=30)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_REFRESH_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def decode_token(token: str, secret: str = None) -> dict:
    """Decode a JWT token"""
    if secret is None:
        secret = settings.JWT_SECRET
    
    try:
        payload = jwt.decode(token, secret, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        return None
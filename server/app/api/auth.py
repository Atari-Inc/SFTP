from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import datetime
from ..database import get_db
from ..models.user import User
from ..schemas.user import UserLogin, Token, UserResponse
from ..core.security import verify_password, create_access_token, create_refresh_token
from ..core.dependencies import get_current_user
from ..services.activity_logger import log_activity
from ..models.activity import ActivityAction, ActivityStatus

router = APIRouter()

@router.get("/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user information for debugging"""
    # Refresh user from database to ensure we have latest data
    db.refresh(current_user)
    
    # Debug logging
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"User {current_user.username} - SFTP enabled: {current_user.enable_sftp}")
    logger.info(f"SSH Public Key exists: {bool(current_user.ssh_public_key)}")
    logger.info(f"Private Key exists: {bool(current_user.private_key)}")
    if current_user.ssh_public_key:
        logger.info(f"Public key length: {len(current_user.ssh_public_key)}")
    if current_user.private_key:
        logger.info(f"Private key length: {len(current_user.private_key)}")
    
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "enable_sftp": current_user.enable_sftp,
        "ssh_public_key": current_user.ssh_public_key,
        "private_key": current_user.private_key,
        "home_directory": current_user.home_directory,
        "last_login": current_user.last_login.isoformat() if current_user.last_login else None,
        "created_at": current_user.created_at.isoformat(),
        "updated_at": current_user.updated_at.isoformat()
    }

@router.get("/test-keys")
async def test_ssh_keys(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Test endpoint to debug SSH key retrieval"""
    db.refresh(current_user)
    
    # Direct database query to double-check
    from sqlalchemy import text
    result = db.execute(
        text("SELECT ssh_public_key, private_key FROM users WHERE id = :user_id"),
        {"user_id": current_user.id}
    ).fetchone()
    
    return {
        "user_id": str(current_user.id),
        "username": current_user.username,
        "model_ssh_public_key": current_user.ssh_public_key,
        "model_private_key": current_user.private_key,
        "model_ssh_key_lengths": {
            "public": len(current_user.ssh_public_key) if current_user.ssh_public_key else 0,
            "private": len(current_user.private_key) if current_user.private_key else 0
        },
        "direct_db_query": {
            "public": result[0] if result and result[0] else None,
            "private": result[1] if result and result[1] else None,
            "lengths": {
                "public": len(result[0]) if result and result[0] else 0,
                "private": len(result[1]) if result and result[1] else 0
            }
        }
    }

@router.post("/debug-token")
async def debug_token(request_data: dict):
    """Debug endpoint to check token validity without authentication"""
    from ..core.security import decode_token
    
    token = request_data.get('token')
    if not token:
        return {"status": "error", "message": "No token provided"}
    
    try:
        payload = decode_token(token)
        if payload:
            return {
                "status": "valid", 
                "user_id": payload.get("sub"), 
                "exp": payload.get("exp"),
                "message": "Token is valid"
            }
        else:
            return {"status": "invalid", "message": "Token decode failed"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.get("/debug-user/{username}")
async def debug_user_keys(
    username: str,
    db: Session = Depends(get_db)
):
    """Debug endpoint to check user SSH keys (development only)"""
    import os
    if os.getenv("ENV") == "production":
        raise HTTPException(status_code=404, detail="Not found")
    
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return {"error": "User not found"}
    
    return {
        "username": user.username,
        "enable_sftp": user.enable_sftp,
        "has_ssh_public_key": bool(user.ssh_public_key),
        "ssh_public_key_length": len(user.ssh_public_key) if user.ssh_public_key else 0,
        "ssh_public_key_start": user.ssh_public_key[:50] if user.ssh_public_key else None,
        "has_private_key": bool(user.private_key),
        "private_key_length": len(user.private_key) if user.private_key else 0,
        "private_key_start": user.private_key[:50] if user.private_key else None
    }

@router.post("/login", response_model=Token)
async def login(
    request: Request,
    user_credentials: UserLogin,
    db: Session = Depends(get_db)
):
    """Login endpoint"""
    # Find user by username
    user = db.query(User).filter(User.username == user_credentials.username).first()
    
    if not user or not verify_password(user_credentials.password, user.password_hash):
        # Log failed login attempt
        await log_activity(
            db=db,
            user_id=user.id if user else None,
            username=user_credentials.username,
            action=ActivityAction.LOGIN,
            resource="auth",
            status=ActivityStatus.FAILURE,
            ip_address=request.client.host,
            user_agent=request.headers.get("user-agent"),
            details={"reason": "Invalid credentials"}
        )
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Create tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    # Log successful login
    await log_activity(
        db=db,
        user_id=user.id,
        username=user.username,
        action=ActivityAction.LOGIN,
        resource="auth",
        status=ActivityStatus.SUCCESS,
        ip_address=request.client.host,
        user_agent=request.headers.get("user-agent")
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": UserResponse.from_orm(user)
    }

@router.post("/register", response_model=UserResponse)
async def register(
    request: Request,
    user_data: dict,
    db: Session = Depends(get_db)
):
    """Register a new user (admin only in production)"""
    # Check if username exists
    if db.query(User).filter(User.username == user_data["username"]).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Check if email exists
    if db.query(User).filter(User.email == user_data["email"]).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    from ..core.security import get_password_hash
    user = User(
        username=user_data["username"],
        email=user_data["email"],
        password_hash=get_password_hash(user_data["password"]),
        role=user_data.get("role", "user")
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Log registration
    await log_activity(
        db=db,
        user_id=user.id,
        username=user.username,
        action=ActivityAction.CREATE,
        resource="user",
        resource_id=str(user.id),
        status=ActivityStatus.SUCCESS,
        ip_address=request.client.host,
        user_agent=request.headers.get("user-agent")
    )
    
    return user


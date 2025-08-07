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
    current_user: User = Depends(get_current_user)
):
    """Get current user information for debugging"""
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "enable_sftp": current_user.enable_sftp
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

@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user)
):
    """Get current user info"""
    return current_user
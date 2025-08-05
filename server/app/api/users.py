from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from ..database import get_db
from ..models.user import User
from ..schemas.user import UserCreate, UserUpdate, UserResponse
from ..core.dependencies import get_current_admin_user, get_current_user
from ..core.security import get_password_hash
from ..services.transfer_family import transfer_family_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/", response_model=dict)
async def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get list of users (admin only)"""
    query = db.query(User)
    
    # Search filter
    if search:
        query = query.filter(
            (User.username.ilike(f"%{search}%")) |
            (User.email.ilike(f"%{search}%"))
        )
    
    # Calculate total
    total = query.count()
    
    # Pagination
    offset = (page - 1) * limit
    users = query.offset(offset).limit(limit).all()
    
    return {
        "data": [UserResponse.from_orm(user) for user in users],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "totalPages": (total + limit - 1) // limit,
            "hasNext": offset + limit < total,
            "hasPrev": page > 1
        }
    }

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get user by ID (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user

@router.post("/", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Create a new user (admin only)"""
    # Check if username exists
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Check if email exists
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user in database
    user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        role=user_data.role
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Create corresponding SFTP user in AWS Transfer Family
    try:
        sftp_result = await transfer_family_service.create_sftp_user(
            username=user_data.username,
            ssh_public_key=getattr(user_data, 'ssh_public_key', None)
        )
        logger.info(f"SFTP user created for {user_data.username}: {sftp_result}")
        
        # Store SFTP creation result in user metadata or logs
        if sftp_result.get('status') == 'created':
            logger.info(f"Successfully created SFTP user for {user_data.username}")
        elif sftp_result.get('status') == 'already_exists':
            logger.warning(f"SFTP user {user_data.username} already exists in Transfer Family")
        
    except Exception as e:
        # Log the error but don't fail user creation if SFTP fails
        logger.error(f"Failed to create SFTP user for {user_data.username}: {str(e)}")
        # Could optionally store this error state in the user record for later retry
    
    return user

@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update user (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update fields if provided
    update_data = user_data.dict(exclude_unset=True)
    
    if "password" in update_data:
        update_data["password_hash"] = get_password_hash(update_data.pop("password"))
    
    for field, value in update_data.items():
        setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    
    return user

@router.delete("/{user_id}")
async def delete_user(
    user_id: UUID,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Delete user (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent deleting self
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    # Store username before deleting user
    username_to_delete = user.username
    
    # Delete user from database
    db.delete(user)
    db.commit()
    
    # Delete corresponding SFTP user from AWS Transfer Family
    try:
        sftp_result = await transfer_family_service.delete_sftp_user(username_to_delete)
        logger.info(f"SFTP user deleted for {username_to_delete}: {sftp_result}")
        
        if sftp_result.get('status') == 'deleted':
            logger.info(f"Successfully deleted SFTP user {username_to_delete}")
        elif sftp_result.get('status') == 'not_found':
            logger.warning(f"SFTP user {username_to_delete} not found in Transfer Family")
            
    except Exception as e:
        # Log the error but don't fail deletion if SFTP cleanup fails
        logger.error(f"Failed to delete SFTP user for {username_to_delete}: {str(e)}")
    
    return {"message": "User deleted successfully"}

@router.put("/profile", response_model=UserResponse)
async def update_profile(
    profile_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user's profile"""
    # Only allow updating username, email, and password
    allowed_fields = ["username", "email", "currentPassword", "newPassword"]
    
    # Verify current password if changing password
    if "newPassword" in profile_data:
        if "currentPassword" not in profile_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password required to change password"
            )
        
        from ..core.security import verify_password
        if not verify_password(profile_data["currentPassword"], current_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )
        
        current_user.password_hash = get_password_hash(profile_data["newPassword"])
    
    # Update other fields
    if "username" in profile_data and profile_data["username"] != current_user.username:
        # Check if username exists
        if db.query(User).filter(User.username == profile_data["username"]).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
        current_user.username = profile_data["username"]
    
    if "email" in profile_data and profile_data["email"] != current_user.email:
        # Check if email exists
        if db.query(User).filter(User.email == profile_data["email"]).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        current_user.email = profile_data["email"]
    
    db.commit()
    db.refresh(current_user)
    
    return current_user

@router.get("/{user_id}/sftp", response_model=dict)
async def get_sftp_user_info(
    user_id: UUID,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get SFTP user information from AWS Transfer Family (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    try:
        sftp_info = await transfer_family_service.get_sftp_user(user.username)
        return {
            "user_id": user_id,
            "username": user.username,
            "sftp_info": sftp_info
        }
    except Exception as e:
        logger.error(f"Failed to get SFTP info for {user.username}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get SFTP user information: {str(e)}"
        )

@router.put("/{user_id}/sftp/ssh-key", response_model=dict)
async def update_sftp_ssh_key(
    user_id: UUID,
    ssh_key_data: dict,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update SSH public key for SFTP user (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    ssh_public_key = ssh_key_data.get("ssh_public_key")
    if not ssh_public_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SSH public key is required"
        )
    
    try:
        result = await transfer_family_service.update_sftp_user_ssh_key(
            user.username,
            ssh_public_key
        )
        return {
            "user_id": user_id,
            "username": user.username,
            "ssh_key_result": result
        }
    except Exception as e:
        logger.error(f"Failed to update SSH key for {user.username}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update SSH key: {str(e)}"
        )

@router.get("/sftp/list", response_model=dict)
async def list_sftp_users(
    current_user: User = Depends(get_current_admin_user)
):
    """List all SFTP users from AWS Transfer Family (admin only)"""
    try:
        result = await transfer_family_service.list_sftp_users()
        return result
    except Exception as e:
        logger.error(f"Failed to list SFTP users: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list SFTP users: {str(e)}"
        )
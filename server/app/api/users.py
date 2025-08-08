from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from ..database import get_db
from ..models.user import User
from ..models.user_folder import UserFolder
from ..models.sftp_auth import SftpAuth
from ..schemas.user import UserCreate, UserUpdate, UserResponse, FolderAssignmentCreate
from ..core.dependencies import get_current_admin_user, get_current_user
from ..core.security import get_password_hash
import bcrypt
from ..services.transfer_family import transfer_family_service
from ..utils.ssh_key_generator import ssh_key_generator
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
    
    # Load folder assignments for each user
    for user in users:
        user.folder_assignments = db.query(UserFolder).filter(
            UserFolder.user_id == user.id,
            UserFolder.is_active == True
        ).all()
    
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
    
    # Validate SSH public key if provided
    ssh_public_key = user_data.ssh_public_key
    private_key = user_data.private_key
    
    if user_data.enable_sftp:
        if ssh_public_key:
            # Validate provided SSH key
            if not ssh_key_generator.validate_ssh_public_key(ssh_public_key):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid SSH public key format"
                )
        else:
            # Generate SSH key pair if SFTP is enabled but no key provided
            try:
                key_pair = ssh_key_generator.generate_rsa_key_pair(user_data.username)
                ssh_public_key = key_pair['public_key']
                private_key = key_pair['private_key']
                logger.info(f"Auto-generated SSH key pair for user: {user_data.username}")
            except Exception as e:
                logger.error(f"Failed to auto-generate SSH key for {user_data.username}: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to generate SSH key pair"
                )
    
    # Create new user in database
    user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        role=user_data.role,
        home_directory=user_data.home_directory or f"/home/{user_data.username}",
        enable_sftp=user_data.enable_sftp or False,
        ssh_public_key=ssh_public_key,
        private_key=private_key
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Create folder assignments if provided
    if user_data.folder_assignments:
        for folder_assignment in user_data.folder_assignments:
            user_folder = UserFolder(
                user_id=user.id,
                folder_path=folder_assignment.folder_path,
                permission=folder_assignment.permission
            )
            db.add(user_folder)
        db.commit()
    
    # Create SFTP auth record if SFTP is enabled
    if user_data.enable_sftp and ssh_public_key:
        sftp_auth = SftpAuth(
            user_id=user.id,
            sftp_username=user_data.username,
            ssh_public_key=ssh_public_key,
            ssh_private_key=private_key,
            auth_method="ssh_key",
            is_active=True
        )
        db.add(sftp_auth)
        db.commit()
    
    # Create corresponding SFTP user in AWS Transfer Family if SFTP is enabled
    if user_data.enable_sftp and ssh_public_key:
        try:
            sftp_result = await transfer_family_service.create_sftp_user(
                username=user_data.username,
                ssh_public_key=ssh_public_key
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
    elif user_data.enable_sftp:
        logger.warning(f"SFTP enabled for {user_data.username} but no SSH public key was provided or generated")
    
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

@router.put("/{user_id}/folders", response_model=dict)
async def update_user_folders(
    user_id: UUID,
    folder_assignments: List[FolderAssignmentCreate],
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update folder assignments for a user (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Delete existing folder assignments
    db.query(UserFolder).filter(UserFolder.user_id == user_id).delete()
    
    # Create new folder assignments
    for folder_assignment in folder_assignments:
        user_folder = UserFolder(
            user_id=user_id,
            folder_path=folder_assignment.folder_path,
            permission=folder_assignment.permission
        )
        db.add(user_folder)
    
    db.commit()
    
    return {
        "message": "Folder assignments updated successfully",
        "user_id": user_id,
        "folder_count": len(folder_assignments)
    }

@router.get("/{user_id}/folders", response_model=List[dict])
async def get_user_folders(
    user_id: UUID,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get folder assignments for a user (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    folders = db.query(UserFolder).filter(UserFolder.user_id == user_id).all()
    
    return [
        {
            "id": str(folder.id),
            "folder_path": folder.folder_path,
            "permission": folder.permission,
            "is_active": folder.is_active,
            "created_at": folder.created_at
        }
        for folder in folders
    ]

@router.post("/generate-ssh-key", response_model=dict)
async def generate_ssh_key(
    username_data: dict,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Generate a new SSH key pair for a user and save to database (admin only)"""
    username = username_data.get('username')
    save_to_db = username_data.get('save_to_db', True)  # Default to saving
    
    if not username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is required"
        )
    
    # Find the user
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {username} not found"
        )
    
    try:
        key_pair = ssh_key_generator.generate_rsa_key_pair(username)
        
        # Validate the generated public key
        if not ssh_key_generator.validate_ssh_public_key(key_pair['public_key']):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Generated SSH key validation failed"
            )
        
        # Save to database if requested
        if save_to_db:
            user.ssh_public_key = key_pair['public_key']
            user.private_key = key_pair['private_key']
            
            # Update or create SFTP auth record
            sftp_auth = db.query(SftpAuth).filter(SftpAuth.user_id == user.id).first()
            if sftp_auth:
                sftp_auth.ssh_public_key = key_pair['public_key']
                sftp_auth.ssh_private_key = key_pair['private_key']
                sftp_auth.auth_method = "ssh_key"
                sftp_auth.is_active = True
            else:
                sftp_auth = SftpAuth(
                    user_id=user.id,
                    sftp_username=user.username,
                    ssh_public_key=key_pair['public_key'],
                    ssh_private_key=key_pair['private_key'],
                    auth_method="ssh_key",
                    is_active=True
                )
                db.add(sftp_auth)
            
            # Update AWS Transfer Family if SFTP is enabled
            if user.enable_sftp:
                try:
                    await transfer_family_service.update_sftp_user_ssh_key(
                        username=user.username,
                        ssh_public_key=key_pair['public_key']
                    )
                    logger.info(f"Updated SSH key in AWS Transfer Family for {username}")
                except Exception as e:
                    logger.error(f"Failed to update Transfer Family: {str(e)}")
                    # Continue anyway - key is saved in DB
            
            db.commit()
            logger.info(f"Generated and saved SSH key pair for user: {username}")
        else:
            logger.info(f"Generated SSH key pair for user: {username} (not saved)")
        
        return {
            "username": username,
            "public_key": key_pair['public_key'],
            "private_key": key_pair['private_key'],
            "saved_to_db": save_to_db,
            "message": "SSH key pair generated successfully"
        }
        
    except Exception as e:
        logger.error(f"Failed to generate SSH key for {username}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate SSH key: {str(e)}"
        )

@router.post("/fix-missing-ssh-keys", response_model=dict)
async def fix_missing_ssh_keys(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Fix SFTP users with missing SSH keys (admin only)"""
    # Find all users with SFTP enabled but missing SSH keys
    users_to_fix = db.query(User).filter(
        User.enable_sftp == True,
        (User.ssh_public_key == None) | (User.private_key == None)
    ).all()
    
    fixed_users = []
    failed_users = []
    
    for user in users_to_fix:
        try:
            # Generate new SSH key pair
            key_pair = ssh_key_generator.generate_rsa_key_pair(user.username)
            
            # Save to user record
            user.ssh_public_key = key_pair['public_key']
            user.private_key = key_pair['private_key']
            
            # Update or create SFTP auth record
            sftp_auth = db.query(SftpAuth).filter(SftpAuth.user_id == user.id).first()
            if sftp_auth:
                sftp_auth.ssh_public_key = key_pair['public_key']
                sftp_auth.ssh_private_key = key_pair['private_key']
                sftp_auth.auth_method = "ssh_key"
                sftp_auth.is_active = True
            else:
                sftp_auth = SftpAuth(
                    user_id=user.id,
                    sftp_username=user.username,
                    ssh_public_key=key_pair['public_key'],
                    ssh_private_key=key_pair['private_key'],
                    auth_method="ssh_key",
                    is_active=True
                )
                db.add(sftp_auth)
            
            # Update AWS Transfer Family
            try:
                # Try to update first, if user doesn't exist, create
                try:
                    await transfer_family_service.update_sftp_user_ssh_key(
                        username=user.username,
                        ssh_public_key=key_pair['public_key']
                    )
                except:
                    # User might not exist in Transfer Family, try to create
                    await transfer_family_service.create_sftp_user(
                        username=user.username,
                        ssh_public_key=key_pair['public_key']
                    )
                logger.info(f"Updated SSH key in AWS Transfer Family for {user.username}")
            except Exception as e:
                logger.error(f"Failed to update Transfer Family for {user.username}: {str(e)}")
                # Continue anyway - key is saved in DB
            
            fixed_users.append(user.username)
            logger.info(f"Fixed SSH keys for user: {user.username}")
            
        except Exception as e:
            logger.error(f"Failed to fix SSH keys for {user.username}: {str(e)}")
            failed_users.append({"username": user.username, "error": str(e)})
    
    db.commit()
    
    return {
        "fixed_users": fixed_users,
        "failed_users": failed_users,
        "total_fixed": len(fixed_users),
        "total_failed": len(failed_users),
        "message": f"Fixed {len(fixed_users)} users with missing SSH keys"
    }

@router.post("/{user_id}/regenerate-ssh-keys", response_model=dict)
async def regenerate_user_ssh_keys(
    user_id: UUID,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Regenerate SSH keys for a specific user (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if not user.enable_sftp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have SFTP enabled"
        )
    
    try:
        # Generate new SSH key pair
        key_pair = ssh_key_generator.generate_rsa_key_pair(user.username)
        
        # Save to user record
        user.ssh_public_key = key_pair['public_key']
        user.private_key = key_pair['private_key']
        
        # Update or create SFTP auth record
        sftp_auth = db.query(SftpAuth).filter(SftpAuth.user_id == user.id).first()
        if sftp_auth:
            sftp_auth.ssh_public_key = key_pair['public_key']
            sftp_auth.ssh_private_key = key_pair['private_key']
            sftp_auth.auth_method = "ssh_key"
            sftp_auth.is_active = True
        else:
            sftp_auth = SftpAuth(
                user_id=user.id,
                sftp_username=user.username,
                ssh_public_key=key_pair['public_key'],
                ssh_private_key=key_pair['private_key'],
                auth_method="ssh_key",
                is_active=True
            )
            db.add(sftp_auth)
        
        # Update AWS Transfer Family
        try:
            await transfer_family_service.update_sftp_user_ssh_key(
                username=user.username,
                ssh_public_key=key_pair['public_key']
            )
            logger.info(f"Updated SSH key in AWS Transfer Family for {user.username}")
        except Exception as e:
            logger.error(f"Failed to update Transfer Family: {str(e)}")
            # Continue anyway - key is saved in DB
        
        db.commit()
        
        return {
            "username": user.username,
            "public_key": key_pair['public_key'],
            "private_key": key_pair['private_key'],
            "message": "SSH keys regenerated successfully"
        }
        
    except Exception as e:
        logger.error(f"Failed to regenerate SSH keys for {user.username}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to regenerate SSH keys: {str(e)}"
        )

@router.post("/{user_id}/sftp-password")
async def reset_sftp_password(
    user_id: UUID,
    password_data: dict,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Reset SFTP password for a user (admin only)"""
    password = password_data.get('password')
    if not password or len(password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if user has SFTP enabled
    if not user.enable_sftp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SFTP is not enabled for this user"
        )
    
    # Hash the password
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Find or create SFTP auth record
    sftp_auth = db.query(SftpAuth).filter(SftpAuth.user_id == user_id).first()
    
    if sftp_auth:
        # Update existing SFTP auth record
        sftp_auth.sftp_password_hash = password_hash
        sftp_auth.auth_method = "password"
        sftp_auth.is_active = True
    else:
        # Create new SFTP auth record
        sftp_auth = SftpAuth(
            user_id=user_id,
            sftp_username=user.username,
            sftp_password_hash=password_hash,
            auth_method="password",
            is_active=True
        )
        db.add(sftp_auth)
    
    db.commit()
    
    logger.info(f"SFTP password reset for user: {user.username}")
    
    return {
        "message": "SFTP password reset successfully",
        "username": user.username
    }

@router.post("/{user_id}/sftp-ssh-key")
async def update_sftp_ssh_key(
    user_id: UUID,
    ssh_key_data: dict,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update SSH key for SFTP access (admin only)"""
    ssh_public_key = ssh_key_data.get('ssh_public_key')
    if not ssh_public_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SSH public key is required"
        )
    
    # Validate SSH public key
    if not ssh_key_generator.validate_ssh_public_key(ssh_public_key):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid SSH public key format"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update user's SSH public key
    user.ssh_public_key = ssh_public_key
    
    # Find or create SFTP auth record
    sftp_auth = db.query(SftpAuth).filter(SftpAuth.user_id == user_id).first()
    
    if sftp_auth:
        # Update existing SFTP auth record
        sftp_auth.ssh_public_key = ssh_public_key
        sftp_auth.auth_method = "ssh_key"
        sftp_auth.is_active = True
    else:
        # Create new SFTP auth record
        sftp_auth = SftpAuth(
            user_id=user_id,
            sftp_username=user.username,
            ssh_public_key=ssh_public_key,
            auth_method="ssh_key",
            is_active=True
        )
        db.add(sftp_auth)
    
    db.commit()
    
    logger.info(f"SSH key updated for user: {user.username}")
    
    return {
        "message": "SSH key updated successfully",
        "username": user.username
    }
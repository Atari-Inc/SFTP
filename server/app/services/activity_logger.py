from sqlalchemy.orm import Session
from fastapi import Request
from typing import Optional, Dict, Any
from uuid import UUID
import logging
from ..models.activity import ActivityLog, ActivityAction, ActivityStatus
from ..models.user import User
from .geolocation import geolocation_service

logger = logging.getLogger(__name__)

class ActivityLogger:
    """Service to log user activities with enhanced tracking"""
    
    @staticmethod
    def get_client_ip(request: Request) -> str:
        """Extract client IP address from request"""
        # Check for forwarded headers (in case of proxy/load balancer)
        forwarded_for = request.headers.get('X-Forwarded-For')
        if forwarded_for:
            # Take the first IP in the chain
            return forwarded_for.split(',')[0].strip()
        
        real_ip = request.headers.get('X-Real-IP')
        if real_ip:
            return real_ip
        
        # Fallback to direct client IP
        return request.client.host if request.client else '127.0.0.1'
    
    @staticmethod
    def get_user_agent(request: Request) -> Optional[str]:
        """Extract user agent from request"""
        return request.headers.get('User-Agent')
    
    @staticmethod
    async def log_activity(
        db: Session,
        user: User,
        action: ActivityAction,
        resource: str,
        request: Request,
        status: ActivityStatus = ActivityStatus.SUCCESS,
        resource_id: Optional[str] = None,
        file_path: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> ActivityLog:
        """
        Log user activity with IP geolocation and file path tracking
        """
        try:
            # Get IP address and user agent
            ip_address = ActivityLogger.get_client_ip(request)
            user_agent = ActivityLogger.get_user_agent(request)
            
            # Get location from IP (async)
            location = await geolocation_service.get_location_async(ip_address)
            
            # Create activity log entry
            activity_log = ActivityLog(
                user_id=user.id,
                username=user.username,
                action=action,
                resource=resource,
                resource_id=resource_id,
                file_path=file_path,
                details=details,
                ip_address=ip_address,
                user_agent=user_agent,
                location_country=location.get('country'),
                location_city=location.get('city'),
                location_region=location.get('region'),
                status=status
            )
            
            # Save to database
            db.add(activity_log)
            db.commit()
            
            logger.info(f"Activity logged: {user.username} - {action.value} on {resource} from {ip_address} ({location.get('city', 'Unknown')}, {location.get('country', 'Unknown')})")
            
            return activity_log
            
        except Exception as e:
            logger.error(f"Failed to log activity for user {user.username}: {str(e)}")
            db.rollback()
            raise
    
    @staticmethod
    async def log_file_activity(
        db: Session,
        user: User,
        action: ActivityAction,
        file_path: str,
        request: Request,
        status: ActivityStatus = ActivityStatus.SUCCESS,
        file_size: Optional[int] = None,
        file_type: Optional[str] = None,
        additional_details: Optional[Dict[str, Any]] = None
    ) -> ActivityLog:
        """Convenience method for logging file-related activities"""
        # Prepare details
        details = additional_details or {}
        if file_size is not None:
            details['file_size'] = file_size
        if file_type:
            details['file_type'] = file_type
        
        # Extract filename from path for resource
        filename = file_path.split('/')[-1] if '/' in file_path else file_path
        
        return await ActivityLogger.log_activity(
            db=db,
            user=user,
            action=action,
            resource=f"File: {filename}",
            request=request,
            status=status,
            resource_id=file_path,  # Use full path as resource_id
            file_path=file_path,
            details=details
        )

# Legacy function for backward compatibility
async def log_activity(
    db: Session,
    user_id: Optional[UUID],
    username: str,
    action: ActivityAction,
    resource: str,
    status: ActivityStatus,
    resource_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    ip_address: str = "127.0.0.1",
    user_agent: Optional[str] = None
):
    """Legacy log function for backward compatibility"""
    activity = ActivityLog(
        user_id=user_id,
        username=username,
        action=action,
        resource=resource,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent,
        status=status
    )
    
    db.add(activity)
    db.commit()
    
    return activity

# Create singleton instances
activity_logger = ActivityLogger()
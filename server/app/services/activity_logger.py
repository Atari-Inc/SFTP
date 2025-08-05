from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from uuid import UUID
from ..models.activity import ActivityLog, ActivityAction, ActivityStatus

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
    """Log user activity to database"""
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
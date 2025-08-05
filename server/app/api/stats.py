from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import Optional
from datetime import datetime, timedelta
import psutil
from ..database import get_db
from ..models.user import User
from ..models.file import File, FileType
from ..models.activity import ActivityLog, ActivityAction
from ..core.dependencies import get_current_user

router = APIRouter()

@router.get("/dashboard")
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get dashboard statistics"""
    # Total users (admin only)
    total_users = 0
    active_users = 0
    if current_user.role == "admin":
        total_users = db.query(User).count()
        # Active users in last 30 days
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        active_users = db.query(User).filter(
            User.last_login >= thirty_days_ago
        ).count()
    
    # File statistics (user's own files or all files for admin)
    file_query = db.query(File)
    if current_user.role != "admin":
        file_query = file_query.filter(File.owner_id == current_user.id)
    
    total_files = file_query.filter(File.type == FileType.FILE).count()
    
    # Storage statistics
    total_storage_result = file_query.filter(File.type == FileType.FILE).with_entities(
        func.sum(File.size)
    ).scalar()
    used_storage = total_storage_result or 0
    
    # For demo purposes, set a fixed total storage limit
    total_storage = 10 * 1024 * 1024 * 1024  # 10GB
    
    # Recent activity (last 24 hours)
    twenty_four_hours_ago = datetime.utcnow() - timedelta(hours=24)
    
    activity_query = db.query(ActivityLog).filter(
        ActivityLog.timestamp >= twenty_four_hours_ago
    )
    if current_user.role != "admin":
        activity_query = activity_query.filter(ActivityLog.user_id == current_user.id)
    
    recent_uploads = activity_query.filter(
        ActivityLog.action == ActivityAction.UPLOAD
    ).count()
    
    recent_downloads = activity_query.filter(
        ActivityLog.action == ActivityAction.DOWNLOAD
    ).count()
    
    # System load (admin only)
    system_load = {"cpu": 0, "memory": 0, "disk": 0}
    if current_user.role == "admin":
        try:
            system_load = {
                "cpu": psutil.cpu_percent(interval=1),
                "memory": psutil.virtual_memory().percent,
                "disk": psutil.disk_usage('/').percent
            }
        except Exception:
            # Fallback values if psutil fails
            system_load = {"cpu": 25, "memory": 60, "disk": 45}
    
    return {
        "totalUsers": total_users,
        "activeUsers": active_users,
        "totalFiles": total_files,
        "totalStorage": total_storage,
        "usedStorage": used_storage,
        "recentUploads": recent_uploads,
        "recentDownloads": recent_downloads,
        "systemLoad": system_load
    }

@router.get("/storage")
async def get_storage_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get storage statistics"""
    file_query = db.query(File)
    if current_user.role != "admin":
        file_query = file_query.filter(File.owner_id == current_user.id)
    
    # Total storage used
    total_used = file_query.filter(File.type == FileType.FILE).with_entities(
        func.sum(File.size)
    ).scalar() or 0
    
    # Storage by file type
    file_types = db.query(
        File.mime_type,
        func.sum(File.size).label('total_size'),
        func.count(File.id).label('file_count')
    ).filter(
        File.type == FileType.FILE,
        File.mime_type.isnot(None)
    )
    
    if current_user.role != "admin":
        file_types = file_types.filter(File.owner_id == current_user.id)
    
    file_types = file_types.group_by(File.mime_type).all()
    
    # Top 10 largest files
    largest_files_query = file_query.filter(File.type == FileType.FILE).order_by(
        File.size.desc()
    ).limit(10)
    
    largest_files = largest_files_query.all()
    
    return {
        "totalUsed": total_used,
        "fileTypes": [
            {
                "mimeType": ft.mime_type,
                "totalSize": ft.total_size,
                "fileCount": ft.file_count
            }
            for ft in file_types
        ],
        "largestFiles": [
            {
                "id": str(f.id),
                "name": f.name,
                "size": f.size,
                "createdAt": f.created_at.isoformat()
            }
            for f in largest_files
        ]
    }

@router.get("/users")
async def get_user_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user statistics (admin only)"""
    if current_user.role != "admin":
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    # Total users
    total_users = db.query(User).count()
    
    # Active users (logged in last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    active_users = db.query(User).filter(
        User.last_login >= thirty_days_ago
    ).count()
    
    # Users by role
    user_roles = db.query(
        User.role,
        func.count(User.id).label('count')
    ).group_by(User.role).all()
    
    # New users (last 30 days)
    new_users = db.query(User).filter(
        User.created_at >= thirty_days_ago
    ).count()
    
    # User activity (last 7 days)
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    user_activity = db.query(
        func.date(ActivityLog.timestamp).label('date'),
        func.count(func.distinct(ActivityLog.user_id)).label('active_users')
    ).filter(
        ActivityLog.timestamp >= seven_days_ago
    ).group_by(
        func.date(ActivityLog.timestamp)
    ).all()
    
    return {
        "totalUsers": total_users,
        "activeUsers": active_users,
        "newUsers": new_users,
        "userRoles": [
            {"role": role.role, "count": role.count}
            for role in user_roles
        ],
        "dailyActivity": [
            {"date": activity.date.isoformat(), "activeUsers": activity.active_users}
            for activity in user_activity
        ]
    }

@router.get("/activity")
async def get_activity_stats(
    period: str = Query("24h", regex="^(24h|7d|30d)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get activity statistics"""
    # Calculate time range
    if period == "24h":
        time_delta = timedelta(hours=24)
    elif period == "7d":
        time_delta = timedelta(days=7)
    else:  # 30d
        time_delta = timedelta(days=30)
    
    start_time = datetime.utcnow() - time_delta
    
    # Base query
    activity_query = db.query(ActivityLog).filter(
        ActivityLog.timestamp >= start_time
    )
    
    if current_user.role != "admin":
        activity_query = activity_query.filter(ActivityLog.user_id == current_user.id)
    
    # Activity by action
    activity_by_action = activity_query.with_entities(
        ActivityLog.action,
        func.count(ActivityLog.id).label('count')
    ).group_by(ActivityLog.action).all()
    
    # Activity over time (hourly for 24h, daily for others)
    if period == "24h":
        # Group by hour
        time_series = activity_query.with_entities(
            func.extract('hour', ActivityLog.timestamp).label('hour'),
            func.count(ActivityLog.id).label('count')
        ).group_by(func.extract('hour', ActivityLog.timestamp)).all()
    else:
        # Group by day
        time_series = activity_query.with_entities(
            func.date(ActivityLog.timestamp).label('date'),
            func.count(ActivityLog.id).label('count')
        ).group_by(func.date(ActivityLog.timestamp)).all()
    
    # Success vs failure rate
    status_stats = activity_query.with_entities(
        ActivityLog.status,
        func.count(ActivityLog.id).label('count')
    ).group_by(ActivityLog.status).all()
    
    return {
        "period": period,
        "totalActivities": activity_query.count(),
        "activityByAction": [
            {"action": activity.action.value, "count": activity.count}
            for activity in activity_by_action
        ],
        "timeSeries": [
            {
                "time": str(ts.hour if period == "24h" else ts.date),
                "count": ts.count
            }
            for ts in time_series
        ],
        "statusStats": [
            {"status": status.status.value, "count": status.count}
            for status in status_stats
        ]
    }
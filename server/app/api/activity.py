from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import Optional
from datetime import datetime, date
import csv
import json
import io
from ..database import get_db
from ..models.activity import ActivityLog, ActivityAction, ActivityStatus
from ..models.user import User
from ..schemas.activity import ActivityLogResponse
from ..core.dependencies import get_current_user

router = APIRouter()

@router.get("/", response_model=dict)
async def get_activity_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    action: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    user_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get activity logs with filtering"""
    query = db.query(ActivityLog)
    
    # Base filter - users can only see their own logs unless admin
    if current_user.role != "admin":
        query = query.filter(ActivityLog.user_id == current_user.id)
    
    # Apply filters
    if search:
        query = query.filter(
            or_(
                ActivityLog.username.ilike(f"%{search}%"),
                ActivityLog.resource.ilike(f"%{search}%"),
                ActivityLog.action.ilike(f"%{search}%")
            )
        )
    
    if action:
        try:
            action_enum = ActivityAction(action)
            query = query.filter(ActivityLog.action == action_enum)
        except ValueError:
            pass
    
    if status:
        try:
            status_enum = ActivityStatus(status)
            query = query.filter(ActivityLog.status == status_enum)
        except ValueError:
            pass
    
    if start_date:
        query = query.filter(ActivityLog.timestamp >= start_date)
    
    if end_date:
        # Include the entire end date
        end_datetime = datetime.combine(end_date, datetime.max.time())
        query = query.filter(ActivityLog.timestamp <= end_datetime)
    
    if user_id and current_user.role == "admin":
        query = query.filter(ActivityLog.user_id == user_id)
    
    # Order by timestamp descending
    query = query.order_by(ActivityLog.timestamp.desc())
    
    # Calculate total
    total = query.count()
    
    # Pagination
    offset = (page - 1) * limit
    logs = query.offset(offset).limit(limit).all()
    
    # Convert to response format
    log_responses = [ActivityLogResponse.from_orm(log) for log in logs]
    
    return {
        "data": log_responses,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "totalPages": (total + limit - 1) // limit,
            "hasNext": offset + limit < total,
            "hasPrev": page > 1
        }
    }

@router.get("/{log_id}", response_model=ActivityLogResponse)
async def get_activity_log(
    log_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get specific activity log"""
    query = db.query(ActivityLog).filter(ActivityLog.id == log_id)
    
    # Users can only see their own logs unless admin
    if current_user.role != "admin":
        query = query.filter(ActivityLog.user_id == current_user.id)
    
    log = query.first()
    if not log:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity log not found"
        )
    
    return log

@router.get("/export", response_class=StreamingResponse)
async def export_activity_logs(
    format: str = Query("csv", regex="^(csv|json)$"),
    search: Optional[str] = None,
    action: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export activity logs in CSV or JSON format"""
    query = db.query(ActivityLog)
    
    # Base filter - users can only see their own logs unless admin
    if current_user.role != "admin":
        query = query.filter(ActivityLog.user_id == current_user.id)
    
    # Apply filters (same as get_activity_logs)
    if search:
        query = query.filter(
            or_(
                ActivityLog.username.ilike(f"%{search}%"),
                ActivityLog.resource.ilike(f"%{search}%"),
                ActivityLog.action.ilike(f"%{search}%")
            )
        )
    
    if action:
        try:
            action_enum = ActivityAction(action)
            query = query.filter(ActivityLog.action == action_enum)
        except ValueError:
            pass
    
    if status:
        try:
            status_enum = ActivityStatus(status)
            query = query.filter(ActivityLog.status == status_enum)
        except ValueError:
            pass
    
    if start_date:
        query = query.filter(ActivityLog.timestamp >= start_date)
    
    if end_date:
        end_datetime = datetime.combine(end_date, datetime.max.time())
        query = query.filter(ActivityLog.timestamp <= end_datetime)
    
    # Order by timestamp descending
    query = query.order_by(ActivityLog.timestamp.desc())
    
    # Get all matching logs
    logs = query.all()
    
    if format == "csv":
        # Create CSV
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            'Timestamp', 'Username', 'Action', 'Resource', 'Resource ID',
            'File Path', 'Status', 'IP Address', 'Location', 'User Agent', 'Details'
        ])
        
        # Write data
        for log in logs:
            # Format location
            location_parts = []
            if log.location_city:
                location_parts.append(log.location_city)
            if log.location_region:
                location_parts.append(log.location_region)
            if log.location_country:
                location_parts.append(log.location_country)
            location_str = ', '.join(location_parts) if location_parts else ''
            
            writer.writerow([
                log.timestamp.isoformat(),
                log.username,
                log.action.value,
                log.resource,
                log.resource_id or '',
                log.file_path or '',
                log.status.value,
                log.ip_address,
                location_str,
                log.user_agent or '',
                json.dumps(log.details) if log.details else ''
            ])
        
        output.seek(0)
        
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type='text/csv',
            headers={'Content-Disposition': f'attachment; filename="activity_logs_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv"'}
        )
    
    else:  # JSON format
        log_data = []
        for log in logs:
            log_data.append({
                'id': str(log.id),
                'timestamp': log.timestamp.isoformat(),
                'user_id': str(log.user_id),
                'username': log.username,
                'action': log.action.value,
                'resource': log.resource,
                'resource_id': log.resource_id,
                'file_path': log.file_path,
                'status': log.status.value,
                'ip_address': log.ip_address,
                'location': {
                    'country': log.location_country,
                    'region': log.location_region,
                    'city': log.location_city
                },
                'user_agent': log.user_agent,
                'details': log.details
            })
        
        json_data = json.dumps(log_data, indent=2)
        
        return StreamingResponse(
            io.BytesIO(json_data.encode()),
            media_type='application/json',
            headers={'Content-Disposition': f'attachment; filename="activity_logs_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json"'}
        )
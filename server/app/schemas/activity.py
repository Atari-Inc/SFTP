from pydantic import BaseModel, UUID4
from typing import Optional, List, Dict, Any
from datetime import datetime
from ..models.activity import ActivityAction, ActivityStatus

class ActivityLogBase(BaseModel):
    action: ActivityAction
    resource: str
    resource_id: Optional[str] = None
    status: ActivityStatus

class ActivityLogResponse(ActivityLogBase):
    id: UUID4
    user_id: UUID4
    username: str
    details: Optional[Dict[str, Any]] = None
    ip_address: str
    user_agent: Optional[str]
    file_path: Optional[str] = None
    location_country: Optional[str] = None
    location_city: Optional[str] = None
    location_region: Optional[str] = None
    timestamp: datetime
    
    class Config:
        from_attributes = True

class ActivityLogList(BaseModel):
    logs: List[ActivityLogResponse]
    total: int
    page: int
    limit: int
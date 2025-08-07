from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import paramiko
import socket
import json
from datetime import datetime, timedelta

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.activity import ActivityLog
from app.schemas.user import UserResponse
from app.services.activity_logger import ActivityLogger
from app.utils.ssh_key_generator import SSHKeyGenerator

router = APIRouter()

class SFTPConnectionManager:
    def __init__(self):
        self.connections = {}
    
    async def create_connection(self, host: str, port: int, username: str, private_key: str) -> Dict[str, Any]:
        """Create and test SFTP connection"""
        try:
            ssh_client = paramiko.SSHClient()
            ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            # Create private key object
            from io import StringIO
            key_file = StringIO(private_key)
            private_key_obj = paramiko.RSAKey.from_private_key(key_file)
            
            # Connect
            ssh_client.connect(
                hostname=host,
                port=port,
                username=username,
                pkey=private_key_obj,
                timeout=10
            )
            
            # Create SFTP client
            sftp_client = ssh_client.open_sftp()
            
            connection_id = f"{username}@{host}:{port}"
            self.connections[connection_id] = {
                'ssh_client': ssh_client,
                'sftp_client': sftp_client,
                'host': host,
                'port': port,
                'username': username,
                'connected_at': datetime.now(),
                'bytes_transferred': 0,
                'files_transferred': 0
            }
            
            return {
                'id': connection_id,
                'status': 'connected',
                'message': 'Connection established successfully'
            }
            
        except paramiko.AuthenticationException:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication failed"
            )
        except paramiko.SSHException as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"SSH connection error: {str(e)}"
            )
        except socket.timeout:
            raise HTTPException(
                status_code=status.HTTP_408_REQUEST_TIMEOUT,
                detail="Connection timeout"
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Connection failed: {str(e)}"
            )
    
    def get_connection(self, connection_id: str):
        return self.connections.get(connection_id)
    
    def close_connection(self, connection_id: str):
        if connection_id in self.connections:
            conn = self.connections[connection_id]
            if 'sftp_client' in conn:
                conn['sftp_client'].close()
            if 'ssh_client' in conn:
                conn['ssh_client'].close()
            del self.connections[connection_id]
            return True
        return False
    
    def list_connections(self) -> List[Dict[str, Any]]:
        result = []
        for conn_id, conn in self.connections.items():
            result.append({
                'id': conn_id,
                'host': conn['host'],
                'port': conn['port'],
                'username': conn['username'],
                'status': 'connected',
                'connected_at': conn['connected_at'].isoformat(),
                'bytes_transferred': conn['bytes_transferred'],
                'files_transferred': conn['files_transferred']
            })
        return result

# Global connection manager
sftp_manager = SFTPConnectionManager()

@router.get("/status")
async def get_server_status(
    current_user: User = Depends(get_current_user)
):
    """Get SFTP server status and statistics"""
    # Mock server status - in production, this would check actual SFTP server
    return {
        'status': 'online',
        'uptime': '2d 14h 32m',
        'active_connections': len(sftp_manager.connections),
        'total_connections': 127,  # Mock data
        'bytes_transferred': '2.4 GB',  # Mock data
        'files_transferred': 486,  # Mock data
        'last_activity': '2 minutes ago',  # Mock data
        'server_info': {
            'host': 'localhost',
            'port': 22,
            'protocol': 'SFTP/SSH',
            'version': '2.0'
        }
    }

@router.post("/connect")
async def create_sftp_connection(
    connection_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create new SFTP connection"""
    host = connection_data.get('host')
    port = connection_data.get('port', 22)
    username = connection_data.get('username')
    
    if not host or not username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Host and username are required"
        )
    
    # Get user's private key
    if not current_user.private_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No SSH private key found for user"
        )
    
    try:
        result = await sftp_manager.create_connection(
            host=host,
            port=port,
            username=username,
            private_key=current_user.private_key
        )
        
        # Log the activity
        activity_logger = ActivityLogger(db)
        await activity_logger.log_activity(
            user_id=current_user.id,
            action="sftp_connect",
            resource_type="sftp",
            resource_id=result['id'],
            details=f"Connected to {host}:{port}",
            request=None  # No request object available here
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/connections")
async def list_connections(
    current_user: User = Depends(get_current_user)
):
    """List active SFTP connections"""
    return {
        'connections': sftp_manager.list_connections()
    }

@router.delete("/connections/{connection_id}")
async def close_connection(
    connection_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Close SFTP connection"""
    if sftp_manager.close_connection(connection_id):
        # Log the activity
        activity_logger = ActivityLogger(db)
        await activity_logger.log_activity(
            user_id=current_user.id,
            action="sftp_disconnect",
            resource_type="sftp",
            resource_id=connection_id,
            details=f"Disconnected from {connection_id}",
            request=None
        )
        
        return {'message': 'Connection closed successfully'}
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found"
        )

@router.get("/connections/{connection_id}/files")
async def list_remote_files(
    connection_id: str,
    path: str = "/",
    current_user: User = Depends(get_current_user)
):
    """List files in remote SFTP directory"""
    connection = sftp_manager.get_connection(connection_id)
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found"
        )
    
    try:
        sftp_client = connection['sftp_client']
        files = []
        
        for item in sftp_client.listdir_attr(path):
            file_info = {
                'name': item.filename,
                'size': item.st_size,
                'modified': datetime.fromtimestamp(item.st_mtime).isoformat() if item.st_mtime else None,
                'is_directory': item.st_mode and (item.st_mode >> 15) == 0o04,  # Check if directory
                'permissions': oct(item.st_mode)[-3:] if item.st_mode else '644'
            }
            files.append(file_info)
        
        return {
            'path': path,
            'files': files
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list files: {str(e)}"
        )

@router.post("/connections/{connection_id}/upload")
async def upload_file_sftp(
    connection_id: str,
    upload_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload file via SFTP"""
    connection = sftp_manager.get_connection(connection_id)
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found"
        )
    
    local_path = upload_data.get('local_path')
    remote_path = upload_data.get('remote_path')
    
    if not local_path or not remote_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Local and remote paths are required"
        )
    
    try:
        sftp_client = connection['sftp_client']
        
        # Upload file
        sftp_client.put(local_path, remote_path)
        
        # Update connection stats
        file_size = sftp_client.stat(remote_path).st_size
        connection['bytes_transferred'] += file_size
        connection['files_transferred'] += 1
        
        # Log the activity
        activity_logger = ActivityLogger(db)
        await activity_logger.log_activity(
            user_id=current_user.id,
            action="sftp_upload",
            resource_type="file",
            resource_id=remote_path,
            details=f"Uploaded {local_path} to {remote_path}",
            request=None
        )
        
        return {
            'message': 'File uploaded successfully',
            'remote_path': remote_path,
            'size': file_size
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}"
        )

@router.post("/connections/{connection_id}/download")
async def download_file_sftp(
    connection_id: str,
    download_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download file via SFTP"""
    connection = sftp_manager.get_connection(connection_id)
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found"
        )
    
    remote_path = download_data.get('remote_path')
    local_path = download_data.get('local_path')
    
    if not remote_path or not local_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Remote and local paths are required"
        )
    
    try:
        sftp_client = connection['sftp_client']
        
        # Download file
        sftp_client.get(remote_path, local_path)
        
        # Update connection stats
        file_size = sftp_client.stat(remote_path).st_size
        connection['bytes_transferred'] += file_size
        connection['files_transferred'] += 1
        
        # Log the activity
        activity_logger = ActivityLogger(db)
        await activity_logger.log_activity(
            user_id=current_user.id,
            action="sftp_download",
            resource_type="file",
            resource_id=remote_path,
            details=f"Downloaded {remote_path} to {local_path}",
            request=None
        )
        
        return {
            'message': 'File downloaded successfully',
            'local_path': local_path,
            'size': file_size
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Download failed: {str(e)}"
        )

@router.get("/users")
async def get_sftp_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get SFTP-enabled users"""
    if current_user.role == 'admin':
        # Admin can see all SFTP users
        users = db.query(User).filter(User.enable_sftp == True).all()
    else:
        # Regular users can only see themselves
        users = [current_user] if current_user.enable_sftp else []
    
    result = []
    for user in users:
        result.append({
            'id': user.id,
            'username': user.username,
            'status': 'active' if user.is_active else 'inactive',
            'last_login': user.last_login.isoformat() if user.last_login else None,
            'public_key': user.ssh_public_key or 'Not configured',
            'home_directory': f"/home/{user.username}",
            'permissions': ['read', 'write', 'execute'] if user.enable_sftp else [],
            'sftp_enabled': user.enable_sftp
        })
    
    return {'users': result}

@router.get("/logs")
async def get_sftp_logs(
    skip: int = 0,
    limit: int = 100,
    user_filter: Optional[str] = None,
    action_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get SFTP activity logs"""
    query = db.query(ActivityLog).filter(
        ActivityLog.action.in_(['sftp_connect', 'sftp_disconnect', 'sftp_upload', 'sftp_download'])
    )
    
    if current_user.role != 'admin':
        # Non-admin users can only see their own logs
        query = query.filter(ActivityLog.user_id == current_user.id)
    
    if user_filter:
        query = query.join(User).filter(User.username.ilike(f"%{user_filter}%"))
    
    if action_filter:
        query = query.filter(ActivityLog.action == action_filter)
    
    total = query.count()
    logs = query.order_by(ActivityLog.timestamp.desc()).offset(skip).limit(limit).all()
    
    result = []
    for log in logs:
        result.append({
            'id': log.id,
            'timestamp': log.timestamp.isoformat(),
            'user': log.user.username if log.user else 'Unknown',
            'action': log.action,
            'details': log.details,
            'ip_address': log.ip_address,
            'location_country': log.location_country,
            'location_city': log.location_city
        })
    
    return {
        'logs': result,
        'total': total,
        'skip': skip,
        'limit': limit
    }

@router.post("/server/start")
async def start_sftp_server(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Start SFTP server (admin only)"""
    if current_user.role != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    # In a real implementation, this would start the actual SFTP server
    # For now, we'll just log the action
    activity_logger = ActivityLogger(db)
    await activity_logger.log_activity(
        user_id=current_user.id,
        action="sftp_server_start",
        resource_type="server",
        resource_id="sftp_server",
        details="SFTP server started",
        request=None
    )
    
    return {'message': 'SFTP server started successfully'}

@router.post("/server/stop")
async def stop_sftp_server(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Stop SFTP server (admin only)"""
    if current_user.role != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    # Close all active connections
    for conn_id in list(sftp_manager.connections.keys()):
        sftp_manager.close_connection(conn_id)
    
    # Log the action
    activity_logger = ActivityLogger(db)
    await activity_logger.log_activity(
        user_id=current_user.id,
        action="sftp_server_stop",
        resource_type="server",
        resource_id="sftp_server",
        details="SFTP server stopped",
        request=None
    )
    
    return {'message': 'SFTP server stopped successfully'}
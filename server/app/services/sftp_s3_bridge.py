"""
SFTP-S3 Bridge Service
Maps SFTP file operations to S3 operations through AWS Transfer Family
Provides the same interface as S3Service for seamless file management
"""

import boto3
import paramiko
from typing import Dict, Any, List, Optional, BinaryIO, Tuple
import os
import tempfile
import logging
from datetime import datetime
from io import BytesIO
from pathlib import Path
from botocore.exceptions import ClientError

from .s3_service import S3Service
from .transfer_family import TransferFamilyService
from ..config import settings

logger = logging.getLogger(__name__)

class SftpS3Bridge:
    """
    Bridge service that provides S3-like operations through SFTP
    Routes operations to either direct SFTP or S3 based on configuration
    """
    
    def __init__(self):
        self.s3_service = S3Service()
        self.transfer_service = TransferFamilyService()
        
        # SFTP connection details for AWS Transfer Family
        self.sftp_host = settings.AWS_TRANSFER_SERVER_ID + ".server.transfer." + settings.AWS_REGION + ".amazonaws.com"
        self.sftp_port = 22
        
        # Cache for active SFTP connections
        self._connections = {}
        
    def _get_sftp_connection(self, username: str, ssh_private_key: str) -> paramiko.SFTPClient:
        """Get or create SFTP connection for user"""
        connection_key = f"{username}@{self.sftp_host}"
        
        if connection_key in self._connections:
            # Test if connection is still alive
            try:
                self._connections[connection_key].listdir('.')
                return self._connections[connection_key]
            except:
                # Connection is dead, remove it
                del self._connections[connection_key]
        
        # Create new connection
        try:
            ssh_client = paramiko.SSHClient()
            ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            # Parse private key
            from io import StringIO
            key_file = StringIO(ssh_private_key)
            private_key_obj = paramiko.RSAKey.from_private_key(key_file)
            
            # Connect to AWS Transfer Family
            ssh_client.connect(
                hostname=self.sftp_host,
                port=self.sftp_port,
                username=username,
                pkey=private_key_obj,
                timeout=30
            )
            
            # Create SFTP client
            sftp_client = ssh_client.open_sftp()
            self._connections[connection_key] = sftp_client
            
            logger.info(f"SFTP connection established for user: {username}")
            return sftp_client
            
        except Exception as e:
            logger.error(f"Failed to create SFTP connection for {username}: {str(e)}")
            raise Exception(f"SFTP connection failed: {str(e)}")
    
    def upload_file(self, file_data: BinaryIO, key: str, content_type: Optional[str] = None, 
                   user_context: Optional[Dict] = None) -> bool:
        """Upload a file via SFTP"""
        if not user_context or not user_context.get('ssh_private_key'):
            # Fallback to direct S3 upload
            return self.s3_service.upload_file(file_data, key, content_type)
        
        try:
            username = user_context.get('username')
            ssh_key = user_context.get('ssh_private_key')
            
            sftp_client = self._get_sftp_connection(username, ssh_key)
            
            # Create temporary file for upload
            with tempfile.NamedTemporaryFile(delete=False) as temp_file:
                # Write data to temp file
                file_data.seek(0)
                temp_file.write(file_data.read())
                temp_file.flush()
                
                # Upload via SFTP
                remote_path = f"/{key.lstrip('/')}"
                
                # Ensure remote directory exists
                self._ensure_remote_directory(sftp_client, os.path.dirname(remote_path))
                
                sftp_client.put(temp_file.name, remote_path)
                
                # Clean up temp file
                os.unlink(temp_file.name)
                
                logger.info(f"File uploaded via SFTP: {key}")
                return True
                
        except Exception as e:
            logger.error(f"SFTP upload failed for {key}: {str(e)}")
            return False
    
    def download_file(self, key: str, user_context: Optional[Dict] = None) -> Optional[bytes]:
        """Download a file via SFTP"""
        if not user_context or not user_context.get('ssh_private_key'):
            # Fallback to direct S3 download
            return self.s3_service.download_file(key)
        
        try:
            username = user_context.get('username')
            ssh_key = user_context.get('ssh_private_key')
            
            sftp_client = self._get_sftp_connection(username, ssh_key)
            
            # Create temporary file for download
            with tempfile.NamedTemporaryFile() as temp_file:
                remote_path = f"/{key.lstrip('/')}"
                
                # Download via SFTP
                sftp_client.get(remote_path, temp_file.name)
                
                # Read data
                temp_file.seek(0)
                data = temp_file.read()
                
                logger.info(f"File downloaded via SFTP: {key}")
                return data
                
        except Exception as e:
            logger.error(f"SFTP download failed for {key}: {str(e)}")
            return None
    
    def delete_file(self, key: str, user_context: Optional[Dict] = None) -> bool:
        """Delete a file via SFTP"""
        if not user_context or not user_context.get('ssh_private_key'):
            # Fallback to direct S3 delete
            return self.s3_service.delete_file(key)
        
        try:
            username = user_context.get('username')
            ssh_key = user_context.get('ssh_private_key')
            
            sftp_client = self._get_sftp_connection(username, ssh_key)
            
            remote_path = f"/{key.lstrip('/')}"
            
            # Check if it's a file or directory
            try:
                stat = sftp_client.stat(remote_path)
                if stat.st_mode & 0o40000:  # Directory
                    self._delete_directory_recursive(sftp_client, remote_path)
                else:  # File
                    sftp_client.remove(remote_path)
            except FileNotFoundError:
                logger.warning(f"File not found for deletion: {key}")
                return False
            
            logger.info(f"File deleted via SFTP: {key}")
            return True
            
        except Exception as e:
            logger.error(f"SFTP delete failed for {key}: {str(e)}")
            return False
    
    def list_files(self, prefix: str = "", user_context: Optional[Dict] = None) -> List[Dict[str, Any]]:
        """List files via SFTP"""
        if not user_context or not user_context.get('ssh_private_key'):
            # Fallback to direct S3 list
            return self.s3_service.list_files(prefix)
        
        try:
            username = user_context.get('username')
            ssh_key = user_context.get('ssh_private_key')
            
            sftp_client = self._get_sftp_connection(username, ssh_key)
            
            # List directory contents
            remote_path = f"/{prefix.lstrip('/')}" if prefix else "/"
            
            try:
                items = sftp_client.listdir_attr(remote_path)
            except FileNotFoundError:
                return []
            
            results = []
            for item in items:
                file_path = f"{prefix.rstrip('/')}/{item.filename}" if prefix else item.filename
                
                results.append({
                    'Key': file_path,
                    'Size': item.st_size or 0,
                    'LastModified': datetime.fromtimestamp(item.st_mtime) if item.st_mtime else datetime.now(),
                    'ETag': '',
                    'IsDirectory': bool(item.st_mode and (item.st_mode & 0o40000))
                })
            
            logger.info(f"Listed {len(results)} items via SFTP from: {prefix}")
            return results
            
        except Exception as e:
            logger.error(f"SFTP list failed for {prefix}: {str(e)}")
            return []
    
    def create_folder(self, folder_path: str, user_context: Optional[Dict] = None) -> bool:
        """Create a folder via SFTP"""
        if not user_context or not user_context.get('ssh_private_key'):
            # Fallback to direct S3 folder creation
            return self.s3_service.create_folder(folder_path)
        
        try:
            username = user_context.get('username')
            ssh_key = user_context.get('ssh_private_key')
            
            sftp_client = self._get_sftp_connection(username, ssh_key)
            
            remote_path = f"/{folder_path.strip('/')}"
            
            # Create directory recursively
            self._ensure_remote_directory(sftp_client, remote_path)
            
            logger.info(f"Folder created via SFTP: {folder_path}")
            return True
            
        except Exception as e:
            logger.error(f"SFTP folder creation failed for {folder_path}: {str(e)}")
            return False
    
    def copy_object(self, source_key: str, dest_key: str, user_context: Optional[Dict] = None) -> bool:
        """Copy an object via SFTP (download then upload)"""
        try:
            # Download source file
            data = self.download_file(source_key, user_context)
            if not data:
                return False
            
            # Upload to destination
            return self.upload_file(BytesIO(data), dest_key, user_context=user_context)
            
        except Exception as e:
            logger.error(f"SFTP copy failed from {source_key} to {dest_key}: {str(e)}")
            return False
    
    def move_object(self, source_key: str, dest_key: str, user_context: Optional[Dict] = None) -> bool:
        """Move an object by copying then deleting the source"""
        try:
            if self.copy_object(source_key, dest_key, user_context):
                return self.delete_file(source_key, user_context)
            return False
        except Exception as e:
            logger.error(f"SFTP move failed from {source_key} to {dest_key}: {str(e)}")
            return False
    
    def rename_object(self, old_key: str, new_key: str, user_context: Optional[Dict] = None) -> bool:
        """Rename an object via SFTP"""
        if not user_context or not user_context.get('ssh_private_key'):
            # Fallback to S3 rename (move)
            return self.s3_service.rename_object(old_key, new_key)
        
        try:
            username = user_context.get('username')
            ssh_key = user_context.get('ssh_private_key')
            
            sftp_client = self._get_sftp_connection(username, ssh_key)
            
            old_path = f"/{old_key.lstrip('/')}"
            new_path = f"/{new_key.lstrip('/')}"
            
            # Ensure destination directory exists
            self._ensure_remote_directory(sftp_client, os.path.dirname(new_path))
            
            # Rename via SFTP
            sftp_client.rename(old_path, new_path)
            
            logger.info(f"File renamed via SFTP: {old_key} -> {new_key}")
            return True
            
        except Exception as e:
            logger.error(f"SFTP rename failed from {old_key} to {new_key}: {str(e)}")
            return False
    
    def get_object_metadata(self, key: str, user_context: Optional[Dict] = None) -> Optional[Dict[str, Any]]:
        """Get object metadata via SFTP"""
        if not user_context or not user_context.get('ssh_private_key'):
            # Fallback to S3 metadata
            return self.s3_service.get_object_metadata(key)
        
        try:
            username = user_context.get('username')
            ssh_key = user_context.get('ssh_private_key')
            
            sftp_client = self._get_sftp_connection(username, ssh_key)
            
            remote_path = f"/{key.lstrip('/')}"
            stat = sftp_client.stat(remote_path)
            
            return {
                'size': stat.st_size or 0,
                'last_modified': datetime.fromtimestamp(stat.st_mtime) if stat.st_mtime else None,
                'content_type': 'application/octet-stream',
                'etag': '',
                'metadata': {},
                'permissions': oct(stat.st_mode)[-3:] if stat.st_mode else '644',
                'is_directory': bool(stat.st_mode and (stat.st_mode & 0o40000))
            }
            
        except Exception as e:
            logger.error(f"SFTP metadata failed for {key}: {str(e)}")
            return None
    
    def list_files_detailed(self, prefix: str = "", delimiter: str = "/", 
                           user_context: Optional[Dict] = None) -> Dict[str, List[Dict[str, Any]]]:
        """List files with detailed information via SFTP"""
        if not user_context or not user_context.get('ssh_private_key'):
            # Fallback to S3 detailed list
            return self.s3_service.list_files_detailed(prefix, delimiter)
        
        try:
            username = user_context.get('username')
            ssh_key = user_context.get('ssh_private_key')
            
            sftp_client = self._get_sftp_connection(username, ssh_key)
            
            remote_path = f"/{prefix.lstrip('/')}" if prefix else "/"
            
            try:
                items = sftp_client.listdir_attr(remote_path)
            except FileNotFoundError:
                return {'files': [], 'folders': [], 'has_more': False}
            
            files = []
            folders = []
            
            for item in items:
                is_directory = bool(item.st_mode and (item.st_mode & 0o40000))
                
                if is_directory:
                    folders.append({
                        'key': f"{prefix.rstrip('/')}/{item.filename}/" if prefix else f"{item.filename}/",
                        'name': item.filename,
                        'size': 0,
                        'last_modified': datetime.fromtimestamp(item.st_mtime) if item.st_mtime else None,
                        'type': 'folder'
                    })
                else:
                    files.append({
                        'key': f"{prefix.rstrip('/')}/{item.filename}" if prefix else item.filename,
                        'name': item.filename,
                        'size': item.st_size or 0,
                        'last_modified': datetime.fromtimestamp(item.st_mtime) if item.st_mtime else None,
                        'etag': '',
                        'type': 'file'
                    })
            
            return {
                'files': files,
                'folders': folders,
                'has_more': False
            }
            
        except Exception as e:
            logger.error(f"SFTP detailed list failed for {prefix}: {str(e)}")
            return {'files': [], 'folders': [], 'has_more': False}
    
    def search_files(self, query: str, prefix: str = "", user_context: Optional[Dict] = None) -> List[Dict[str, Any]]:
        """Search for files via SFTP"""
        try:
            # Get all files in the directory
            all_items = self.list_files(prefix, user_context)
            
            # Filter by query
            matching_files = []
            for item in all_items:
                filename = os.path.basename(item.get('Key', ''))
                if query.lower() in filename.lower():
                    matching_files.append({
                        'key': item.get('Key'),
                        'name': filename,
                        'size': item.get('Size', 0),
                        'last_modified': item.get('LastModified'),
                        'path': os.path.dirname(item.get('Key', '')) or '/'
                    })
            
            return matching_files
            
        except Exception as e:
            logger.error(f"SFTP search failed for query '{query}': {str(e)}")
            return []
    
    def _ensure_remote_directory(self, sftp_client: paramiko.SFTPClient, directory_path: str):
        """Ensure remote directory exists, creating if necessary"""
        if not directory_path or directory_path == '/':
            return
        
        try:
            sftp_client.stat(directory_path)
            return  # Directory exists
        except FileNotFoundError:
            # Directory doesn't exist, create it
            parent_dir = os.path.dirname(directory_path)
            if parent_dir != directory_path:
                self._ensure_remote_directory(sftp_client, parent_dir)
            
            try:
                sftp_client.mkdir(directory_path)
            except Exception as e:
                logger.warning(f"Could not create directory {directory_path}: {str(e)}")
    
    def _delete_directory_recursive(self, sftp_client: paramiko.SFTPClient, directory_path: str):
        """Recursively delete directory and its contents"""
        try:
            # List directory contents
            items = sftp_client.listdir_attr(directory_path)
            
            for item in items:
                item_path = f"{directory_path}/{item.filename}"
                
                if item.st_mode & 0o40000:  # Directory
                    self._delete_directory_recursive(sftp_client, item_path)
                else:  # File
                    sftp_client.remove(item_path)
            
            # Remove the empty directory
            sftp_client.rmdir(directory_path)
            
        except Exception as e:
            logger.error(f"Failed to delete directory {directory_path}: {str(e)}")
            raise
    
    def close_connection(self, username: str):
        """Close SFTP connection for user"""
        connection_key = f"{username}@{self.sftp_host}"
        if connection_key in self._connections:
            try:
                self._connections[connection_key].close()
            except:
                pass
            del self._connections[connection_key]
    
    def generate_presigned_url(self, key: str, expiration: int = 3600) -> Optional[str]:
        """Generate presigned URL - fallback to S3"""
        return self.s3_service.generate_presigned_url(key, expiration)
    
    def file_exists(self, key: str, user_context: Optional[Dict] = None) -> bool:
        """Check if file exists via SFTP"""
        if not user_context or not user_context.get('ssh_private_key'):
            return self.s3_service.file_exists(key)
        
        try:
            username = user_context.get('username')
            ssh_key = user_context.get('ssh_private_key')
            
            sftp_client = self._get_sftp_connection(username, ssh_key)
            remote_path = f"/{key.lstrip('/')}"
            
            sftp_client.stat(remote_path)
            return True
            
        except FileNotFoundError:
            return False
        except Exception as e:
            logger.error(f"SFTP file exists check failed for {key}: {str(e)}")
            return False

# Singleton instance
sftp_s3_bridge = SftpS3Bridge()
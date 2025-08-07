import boto3
from botocore.exceptions import ClientError
from typing import Optional, BinaryIO, List, Dict, Any, Tuple
import os
import mimetypes
from datetime import datetime, timezone
from urllib.parse import urlparse
from ..config import settings

class S3Service:
    def __init__(self):
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION
        )
        self.bucket_name = settings.AWS_S3_BUCKET
    
    def upload_file(self, file_data: BinaryIO, key: str, content_type: Optional[str] = None) -> bool:
        """Upload a file to S3"""
        try:
            extra_args = {}
            if content_type:
                extra_args['ContentType'] = content_type
            
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=file_data,
                **extra_args
            )
            return True
        except ClientError as e:
            print(f"Error uploading file to S3: {e}")
            return False
    
    def download_file(self, key: str) -> Optional[bytes]:
        """Download a file from S3"""
        try:
            response = self.s3_client.get_object(
                Bucket=self.bucket_name,
                Key=key
            )
            return response['Body'].read()
        except ClientError as e:
            print(f"Error downloading file from S3: {e}")
            return None
    
    def delete_file(self, key: str) -> bool:
        """Delete a file from S3"""
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=key
            )
            return True
        except ClientError as e:
            print(f"Error deleting file from S3: {e}")
            return False
    
    def generate_presigned_url(self, key: str, expiration: int = 3600) -> Optional[str]:
        """Generate a presigned URL for downloading a file"""
        try:
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': key},
                ExpiresIn=expiration
            )
            return url
        except ClientError as e:
            print(f"Error generating presigned URL: {e}")
            return None
    
    def list_files(self, prefix: str = "") -> list:
        """List files in S3 bucket with given prefix"""
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=prefix
            )
            
            if 'Contents' not in response:
                return []
            
            return response['Contents']
        except ClientError as e:
            print(f"Error listing files from S3: {e}")
            return []
    
    def file_exists(self, key: str) -> bool:
        """Check if a file exists in S3"""
        try:
            self.s3_client.head_object(
                Bucket=self.bucket_name,
                Key=key
            )
            return True
        except ClientError:
            return False
    
    def create_folder(self, folder_path: str) -> bool:
        """Create a folder in S3 by uploading a placeholder object"""
        try:
            # Ensure folder path ends with /
            if not folder_path.endswith("/"):
                folder_path += "/"
            
            # Create placeholder object for the folder
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=folder_path,
                Body=b'',
                ContentType='application/x-directory'
            )
            return True
        except ClientError as e:
            print(f"Error creating folder in S3: {e}")
            return False
    
    def copy_object(self, source_key: str, dest_key: str) -> bool:
        """Copy an object within the same S3 bucket"""
        try:
            copy_source = {'Bucket': self.bucket_name, 'Key': source_key}
            self.s3_client.copy_object(
                CopySource=copy_source,
                Bucket=self.bucket_name,
                Key=dest_key
            )
            return True
        except ClientError as e:
            print(f"Error copying object in S3: {e}")
            return False
    
    def move_object(self, source_key: str, dest_key: str) -> bool:
        """Move an object by copying then deleting the source"""
        try:
            if self.copy_object(source_key, dest_key):
                return self.delete_file(source_key)
            return False
        except Exception as e:
            print(f"Error moving object in S3: {e}")
            return False
    
    def rename_object(self, old_key: str, new_key: str) -> bool:
        """Rename an object by moving it to the new key"""
        return self.move_object(old_key, new_key)
    
    def copy_folder(self, source_prefix: str, dest_prefix: str) -> bool:
        """Copy all objects from source folder to destination folder"""
        try:
            # List all objects in the source folder
            objects = self.list_files(source_prefix)
            if not objects:
                # If empty folder, just create the destination folder
                return self.create_folder(dest_prefix)
            
            success_count = 0
            for obj in objects:
                source_key = obj['Key']
                # Replace source prefix with destination prefix
                dest_key = source_key.replace(source_prefix, dest_prefix, 1)
                if self.copy_object(source_key, dest_key):
                    success_count += 1
            
            return success_count > 0
        except Exception as e:
            print(f"Error copying folder in S3: {e}")
            return False
    
    def move_folder(self, source_prefix: str, dest_prefix: str) -> bool:
        """Move all objects from source folder to destination folder"""
        try:
            if self.copy_folder(source_prefix, dest_prefix):
                return self.delete_folder(source_prefix)
            return False
        except Exception as e:
            print(f"Error moving folder in S3: {e}")
            return False
    
    def delete_folder(self, folder_prefix: str) -> bool:
        """Delete all objects in a folder"""
        try:
            objects = self.list_files(folder_prefix)
            if not objects:
                return True
            
            # Batch delete objects
            delete_keys = [{'Key': obj['Key']} for obj in objects]
            
            # S3 batch delete limit is 1000
            for i in range(0, len(delete_keys), 1000):
                batch = delete_keys[i:i+1000]
                self.s3_client.delete_objects(
                    Bucket=self.bucket_name,
                    Delete={'Objects': batch}
                )
            
            return True
        except ClientError as e:
            print(f"Error deleting folder in S3: {e}")
            return False
    
    def get_object_metadata(self, key: str) -> Optional[Dict[str, Any]]:
        """Get metadata for an object"""
        try:
            response = self.s3_client.head_object(
                Bucket=self.bucket_name,
                Key=key
            )
            return {
                'size': response.get('ContentLength', 0),
                'last_modified': response.get('LastModified'),
                'content_type': response.get('ContentType'),
                'etag': response.get('ETag', '').strip('"'),
                'metadata': response.get('Metadata', {})
            }
        except ClientError as e:
            print(f"Error getting object metadata: {e}")
            return None
    
    def list_files_detailed(self, prefix: str = "", delimiter: str = "/") -> Dict[str, List[Dict[str, Any]]]:
        """List files and folders with detailed information"""
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=prefix,
                Delimiter=delimiter
            )
            
            files = []
            folders = []
            
            # Process files
            for obj in response.get('Contents', []):
                # Skip the folder itself if it's just a placeholder
                if obj['Key'] == prefix or obj['Key'].endswith('/'):
                    continue
                    
                files.append({
                    'key': obj['Key'],
                    'name': os.path.basename(obj['Key']),
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'],
                    'etag': obj['ETag'].strip('"'),
                    'type': 'file'
                })
            
            # Process folders (common prefixes)
            for prefix_info in response.get('CommonPrefixes', []):
                folder_name = prefix_info['Prefix'].rstrip('/').split('/')[-1]
                folders.append({
                    'key': prefix_info['Prefix'],
                    'name': folder_name,
                    'size': 0,
                    'last_modified': None,
                    'type': 'folder'
                })
            
            return {
                'files': files,
                'folders': folders,
                'has_more': response.get('IsTruncated', False)
            }
        except ClientError as e:
            print(f"Error listing files detailed: {e}")
            return {'files': [], 'folders': [], 'has_more': False}
    
    def generate_upload_url(self, key: str, content_type: str = 'binary/octet-stream', expiration: int = 3600) -> Optional[Dict[str, Any]]:
        """Generate a presigned URL for direct uploads"""
        try:
            response = self.s3_client.generate_presigned_post(
                Bucket=self.bucket_name,
                Key=key,
                Fields={"Content-Type": content_type},
                Conditions=[
                    {"Content-Type": content_type},
                    ["content-length-range", 1, 100 * 1024 * 1024]  # 100MB max
                ],
                ExpiresIn=expiration
            )
            return response
        except ClientError as e:
            print(f"Error generating upload URL: {e}")
            return None
    
    def get_file_size(self, key: str) -> Optional[int]:
        """Get file size without downloading"""
        try:
            response = self.s3_client.head_object(
                Bucket=self.bucket_name,
                Key=key
            )
            return response['ContentLength']
        except ClientError:
            return None
    
    def search_files(self, query: str, prefix: str = "") -> List[Dict[str, Any]]:
        """Search for files matching a query"""
        try:
            all_objects = self.list_files(prefix)
            matching_files = []
            
            for obj in all_objects:
                key = obj.get('Key', '')
                filename = os.path.basename(key)
                if query.lower() in filename.lower():
                    matching_files.append({
                        'key': key,
                        'name': filename,
                        'size': obj.get('Size', 0),
                        'last_modified': obj.get('LastModified'),
                        'path': os.path.dirname(key) or '/'
                    })
            
            return matching_files
        except Exception as e:
            print(f"Error searching files: {e}")
            return []
    
    def bulk_delete(self, keys: List[str]) -> Dict[str, Any]:
        """Delete multiple objects in batches"""
        try:
            deleted = []
            errors = []
            
            # Process in batches of 1000 (S3 limit)
            for i in range(0, len(keys), 1000):
                batch = keys[i:i+1000]
                delete_objects = [{'Key': key} for key in batch]
                
                response = self.s3_client.delete_objects(
                    Bucket=self.bucket_name,
                    Delete={'Objects': delete_objects}
                )
                
                deleted.extend(response.get('Deleted', []))
                errors.extend(response.get('Errors', []))
            
            return {
                'deleted': deleted,
                'errors': errors,
                'success_count': len(deleted),
                'error_count': len(errors)
            }
        except ClientError as e:
            print(f"Error in bulk delete: {e}")
            return {'deleted': [], 'errors': [], 'success_count': 0, 'error_count': len(keys)}
    
    def get_storage_usage(self, prefix: str = "") -> Dict[str, Any]:
        """Calculate storage usage for a prefix"""
        try:
            objects = self.list_files(prefix)
            total_size = sum(obj.get('Size', 0) for obj in objects)
            file_count = len([obj for obj in objects if not obj.get('Key', '').endswith('/')])
            folder_count = len([obj for obj in objects if obj.get('Key', '').endswith('/')])
            
            return {
                'total_size': total_size,
                'file_count': file_count,
                'folder_count': folder_count,
                'object_count': len(objects)
            }
        except Exception as e:
            print(f"Error calculating storage usage: {e}")
            return {'total_size': 0, 'file_count': 0, 'folder_count': 0, 'object_count': 0}

# Singleton instance
s3_service = S3Service()
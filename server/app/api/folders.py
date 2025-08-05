from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
import boto3
from botocore.exceptions import ClientError, NoCredentialsError
from ..core.dependencies import get_current_admin_user
from ..models.user import User
from ..config import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/", response_model=List[dict])
async def list_s3_folders(
    current_user: User = Depends(get_current_admin_user)
):
    """List all folders from S3 bucket (admin only)"""
    try:
        # Initialize S3 client
        s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION
        )
        
        # List objects with delimiter to get folder structure
        response = s3_client.list_objects_v2(
            Bucket=settings.AWS_S3_BUCKET,
            Delimiter='/'
        )
        
        folders = []
        
        # Get only top-level folders (root level)
        if 'CommonPrefixes' in response:
            for prefix in response['CommonPrefixes']:
                folder_name = prefix['Prefix'].rstrip('/')
                folders.append({
                    'path': f'/{folder_name}',
                    'name': folder_name,
                    'type': 'folder',
                    'level': 1
                })
        
        # Sort folders by path
        folders.sort(key=lambda x: x['path'])
        
        # Only return actual S3 folders, no system folders
        all_folders = folders
        
        logger.info(f"Found {len(all_folders)} folders for admin {current_user.username}")
        
        return all_folders
        
    except NoCredentialsError:
        logger.error("AWS credentials not found")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AWS credentials not configured"
        )
    except ClientError as e:
        logger.error(f"AWS S3 client error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to access S3 bucket: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error listing folders: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list folders: {str(e)}"
        )

@router.get("/bucket-info", response_model=dict)
async def get_bucket_info(
    current_user: User = Depends(get_current_admin_user)
):
    """Get S3 bucket information (admin only)"""
    try:
        s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION
        )
        
        # Get bucket location
        bucket_location = s3_client.get_bucket_location(Bucket=settings.AWS_S3_BUCKET)
        
        # Count total objects
        response = s3_client.list_objects_v2(Bucket=settings.AWS_S3_BUCKET)
        object_count = response.get('KeyCount', 0)
        
        return {
            'bucket_name': settings.AWS_S3_BUCKET,
            'region': bucket_location.get('LocationConstraint') or 'us-east-1',
            'object_count': object_count,
            'status': 'accessible'
        }
        
    except Exception as e:
        logger.error(f"Error getting bucket info: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get bucket information: {str(e)}"
        )
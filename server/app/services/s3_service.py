import boto3
from botocore.exceptions import ClientError
from typing import Optional, BinaryIO
import os
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

# Singleton instance
s3_service = S3Service()
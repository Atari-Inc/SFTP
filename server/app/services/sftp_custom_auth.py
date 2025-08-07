"""
Custom Identity Provider for AWS Transfer Family to support password authentication
This can be deployed as an AWS Lambda function or API Gateway endpoint
"""
import json
import logging
import os
from datetime import datetime
from typing import Dict, Any, Optional
import bcrypt
import boto3
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from ..models.user import User
from ..models.sftp_auth import SftpAuth
from ..config import settings

logger = logging.getLogger(__name__)

class SftpCustomAuthProvider:
    def __init__(self):
        self.database_url = settings.DATABASE_URL
        self.s3_bucket = settings.AWS_S3_BUCKET
        self.role_arn = settings.AWS_ROLE_ARN
        
        # Initialize database connection
        self.engine = create_engine(self.database_url)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
    
    def authenticate_user(self, username: str, password: Optional[str] = None, 
                         protocol: str = "SFTP", server_id: str = None,
                         source_ip: str = None) -> Dict[str, Any]:
        """
        Authenticate user with password for AWS Transfer Family
        Returns authentication response in AWS Transfer Family format
        """
        db = self.SessionLocal()
        try:
            # Find user by username
            user = db.query(User).filter(User.username == username).first()
            if not user:
                logger.warning(f"User not found: {username}")
                return self._auth_failure_response()
            
            # Check if user has SFTP access enabled
            if not user.enable_sftp:
                logger.warning(f"SFTP not enabled for user: {username}")
                return self._auth_failure_response()
            
            # Check if user is active
            if not user.is_active:
                logger.warning(f"User is not active: {username}")
                return self._auth_failure_response()
            
            # Get SFTP auth record
            sftp_auth = db.query(SftpAuth).filter(
                SftpAuth.user_id == user.id,
                SftpAuth.is_active == True
            ).first()
            
            if not sftp_auth:
                logger.warning(f"SFTP auth not configured for user: {username}")
                return self._auth_failure_response()
            
            # Verify password if provided
            if password and sftp_auth.auth_method == "password":
                if not sftp_auth.sftp_password_hash:
                    logger.warning(f"No password set for user: {username}")
                    return self._auth_failure_response()
                
                # Verify password
                if not bcrypt.checkpw(password.encode('utf-8'), 
                                    sftp_auth.sftp_password_hash.encode('utf-8')):
                    logger.warning(f"Invalid password for user: {username}")
                    return self._auth_failure_response()
            
            # Build home directory path
            home_directory = f"/{self.s3_bucket}/{username}"
            
            # Get user's assigned folders from database
            folder_assignments = []
            for folder in user.folder_assignments:
                if folder.permission in ['read', 'write', 'read_write']:
                    folder_path = folder.folder_path.strip('/')
                    folder_assignments.append(folder_path)
            
            # Build the policy for S3 access
            policy = self._build_s3_policy(username, folder_assignments)
            
            # Build successful authentication response
            response = {
                "Role": self.role_arn,
                "Policy": json.dumps(policy),
                "HomeDirectoryType": "LOGICAL",
                "HomeDirectoryDetails": json.dumps([
                    {
                        "Entry": "/",
                        "Target": home_directory
                    }
                ])
            }
            
            # Update last SFTP login
            sftp_auth.last_sftp_login = datetime.utcnow()
            db.commit()
            
            logger.info(f"Successful authentication for user: {username}")
            return response
            
        except Exception as e:
            logger.error(f"Error authenticating user {username}: {str(e)}")
            return self._auth_failure_response()
        finally:
            db.close()
    
    def _build_s3_policy(self, username: str, folder_assignments: list) -> Dict[str, Any]:
        """Build S3 access policy for the user"""
        # Base paths the user can access
        allowed_prefixes = [f"{username}/*", username]
        
        # Add assigned folders
        for folder in folder_assignments:
            allowed_prefixes.append(f"{folder}/*")
            allowed_prefixes.append(folder)
        
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Sid": "AllowListingOfUserFolder",
                    "Effect": "Allow",
                    "Action": [
                        "s3:ListBucket",
                        "s3:GetBucketLocation"
                    ],
                    "Resource": f"arn:aws:s3:::{self.s3_bucket}",
                    "Condition": {
                        "StringLike": {
                            "s3:prefix": allowed_prefixes
                        }
                    }
                },
                {
                    "Sid": "AllowAllS3ActionsInUserFolder",
                    "Effect": "Allow",
                    "Action": [
                        "s3:GetObject",
                        "s3:GetObjectVersion",
                        "s3:PutObject",
                        "s3:DeleteObject",
                        "s3:DeleteObjectVersion"
                    ],
                    "Resource": [f"arn:aws:s3:::{self.s3_bucket}/{prefix}" 
                               for prefix in allowed_prefixes]
                }
            ]
        }
        
        return policy
    
    def _auth_failure_response(self) -> Dict[str, Any]:
        """Return authentication failure response"""
        return {}  # Empty response indicates authentication failure

    def lambda_handler(self, event: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """
        AWS Lambda handler for custom identity provider
        """
        # Extract authentication parameters
        username = event.get('username', '')
        password = event.get('password')
        protocol = event.get('protocol', 'SFTP')
        server_id = event.get('serverId')
        source_ip = event.get('sourceIp')
        
        # Special handling for SSH key authentication
        # When using SSH key, password field contains the SSH key signature
        if not password or len(password) > 100:
            # This is likely SSH key authentication, let Transfer Family handle it
            logger.info(f"SSH key authentication detected for user: {username}")
            # Return empty response to let Transfer Family handle SSH key auth
            return {}
        
        # Authenticate with password
        return self.authenticate_user(
            username=username,
            password=password,
            protocol=protocol,
            server_id=server_id,
            source_ip=source_ip
        )

# For Lambda deployment
def lambda_handler(event, context):
    """AWS Lambda entry point"""
    auth_provider = SftpCustomAuthProvider()
    return auth_provider.lambda_handler(event, context)
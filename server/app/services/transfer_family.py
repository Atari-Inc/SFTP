import boto3
import logging
from typing import Dict, Any, Optional
from botocore.exceptions import ClientError, BotoCoreError
from ..config import settings

logger = logging.getLogger(__name__)

class TransferFamilyService:
    def __init__(self, settings_instance=None):
        if settings_instance is None:
            settings_instance = settings
        self.settings = settings_instance
        
        self.client = boto3.client(
            'transfer',
            aws_access_key_id=self.settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=self.settings.AWS_SECRET_ACCESS_KEY,
            region_name=self.settings.AWS_REGION
        )
        self.server_id = self.settings.AWS_TRANSFER_SERVER_ID
        self.role_arn = self.settings.AWS_ROLE_ARN
        self.s3_bucket = self.settings.AWS_S3_BUCKET

    async def create_sftp_user(self, username: str, ssh_public_key: Optional[str] = None) -> Dict[str, Any]:
        """
        Create an SFTP user in AWS Transfer Family
        """
        try:
            # Define the home directory mapping for AWS Transfer Family
            # This maps the SFTP root "/" to the user's S3 directory
            home_directory_mappings = [
                {
                    'Entry': '/',
                    'Target': f'/{self.s3_bucket}/{username}'
                }
            ]

            # Base user parameters
            user_params = {
                'ServerId': self.server_id,
                'UserName': username,
                'Role': self.role_arn,
                'HomeDirectoryType': 'LOGICAL',
                'HomeDirectoryMappings': home_directory_mappings,
                'Policy': '''{
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Sid": "AllowFullAccessToOwnFolder",
                            "Effect": "Allow",
                            "Action": [
                                "s3:ListBucket",
                                "s3:GetBucketLocation"
                            ],
                            "Resource": "arn:aws:s3:::''' + self.s3_bucket + '''",
                            "Condition": {
                                "StringLike": {
                                    "s3:prefix": [
                                        "''' + username + '''/*",
                                        "''' + username + '''"
                                    ]
                                }
                            }
                        },
                        {
                            "Effect": "Allow",
                            "Action": [
                                "s3:GetObject",
                                "s3:PutObject",
                                "s3:DeleteObject",
                                "s3:GetObjectVersion"
                            ],
                            "Resource": "arn:aws:s3:::''' + self.s3_bucket + '''/''' + username + '''/*"
                        }
                    ]
                }'''
            }

            # Add SSH public key if provided
            if ssh_public_key:
                user_params['SshPublicKeyBody'] = ssh_public_key

            # Create the user
            response = self.client.create_user(**user_params)
            
            logger.info(f"Successfully created SFTP user: {username}")
            return {
                'username': username,
                'server_id': self.server_id,
                'arn': response.get('Arn'),
                'home_directory': f'/{self.s3_bucket}/{username}',
                'status': 'created'
            }

        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            
            if error_code == 'ResourceExistsException':
                logger.warning(f"SFTP user {username} already exists")
                return {
                    'username': username,
                    'server_id': self.server_id,
                    'status': 'already_exists',
                    'error': 'User already exists in Transfer Family'
                }
            else:
                logger.error(f"Failed to create SFTP user {username}: {error_message}")
                raise Exception(f"Failed to create SFTP user: {error_message}")

        except BotoCoreError as e:
            logger.error(f"AWS service error while creating SFTP user {username}: {str(e)}")
            raise Exception(f"AWS service error: {str(e)}")

        except Exception as e:
            logger.error(f"Unexpected error creating SFTP user {username}: {str(e)}")
            raise Exception(f"Unexpected error: {str(e)}")

    async def delete_sftp_user(self, username: str) -> Dict[str, Any]:
        """
        Delete an SFTP user from AWS Transfer Family
        """
        try:
            self.client.delete_user(
                ServerId=self.server_id,
                UserName=username
            )
            
            logger.info(f"Successfully deleted SFTP user: {username}")
            return {
                'username': username,
                'server_id': self.server_id,
                'status': 'deleted'
            }

        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            
            if error_code == 'ResourceNotFoundException':
                logger.warning(f"SFTP user {username} not found")
                return {
                    'username': username,
                    'server_id': self.server_id,
                    'status': 'not_found',
                    'error': 'User not found in Transfer Family'
                }
            else:
                logger.error(f"Failed to delete SFTP user {username}: {error_message}")
                raise Exception(f"Failed to delete SFTP user: {error_message}")

        except Exception as e:
            logger.error(f"Unexpected error deleting SFTP user {username}: {str(e)}")
            raise Exception(f"Unexpected error: {str(e)}")

    async def get_sftp_user(self, username: str) -> Dict[str, Any]:
        """
        Get SFTP user details from AWS Transfer Family
        """
        try:
            response = self.client.describe_user(
                ServerId=self.server_id,
                UserName=username
            )
            
            user_details = response['User']
            return {
                'username': username,
                'server_id': self.server_id,
                'arn': user_details.get('Arn'),
                'home_directory': user_details.get('HomeDirectory'),
                'home_directory_type': user_details.get('HomeDirectoryType'),
                'role': user_details.get('Role'),
                'ssh_public_keys': user_details.get('SshPublicKeys', []),
                'status': 'active'
            }

        except ClientError as e:
            error_code = e.response['Error']['Code']
            
            if error_code == 'ResourceNotFoundException':
                return {
                    'username': username,
                    'server_id': self.server_id,
                    'status': 'not_found'
                }
            else:
                logger.error(f"Failed to get SFTP user {username}: {e.response['Error']['Message']}")
                raise Exception(f"Failed to get SFTP user: {e.response['Error']['Message']}")

        except Exception as e:
            logger.error(f"Unexpected error getting SFTP user {username}: {str(e)}")
            raise Exception(f"Unexpected error: {str(e)}")

    async def update_sftp_user_ssh_key(self, username: str, ssh_public_key: str) -> Dict[str, Any]:
        """
        Update SSH public key for an existing SFTP user
        """
        try:
            # First, get existing SSH keys to avoid duplicates
            user_info = await self.get_sftp_user(username)
            if user_info['status'] == 'not_found':
                raise Exception(f"SFTP user {username} not found")

            # Import the new SSH key
            response = self.client.import_ssh_public_key(
                ServerId=self.server_id,
                UserName=username,
                SshPublicKeyBody=ssh_public_key
            )
            
            logger.info(f"Successfully updated SSH key for SFTP user: {username}")
            return {
                'username': username,
                'server_id': self.server_id,
                'ssh_public_key_id': response.get('SshPublicKeyId'),
                'status': 'key_updated'
            }

        except ClientError as e:
            error_message = e.response['Error']['Message']
            logger.error(f"Failed to update SSH key for SFTP user {username}: {error_message}")
            raise Exception(f"Failed to update SSH key: {error_message}")

        except Exception as e:
            logger.error(f"Unexpected error updating SSH key for SFTP user {username}: {str(e)}")
            raise Exception(f"Unexpected error: {str(e)}")

    async def list_sftp_users(self) -> Dict[str, Any]:
        """
        List all SFTP users on the Transfer Family server
        """
        try:
            response = self.client.list_users(ServerId=self.server_id)
            users = []
            
            for user in response.get('Users', []):
                users.append({
                    'username': user.get('UserName'),
                    'arn': user.get('Arn'),
                    'home_directory': user.get('HomeDirectory'),
                    'role': user.get('Role'),
                    'ssh_public_key_count': user.get('SshPublicKeyCount', 0)
                })
            
            return {
                'server_id': self.server_id,
                'users': users,
                'count': len(users)
            }

        except Exception as e:
            logger.error(f"Failed to list SFTP users: {str(e)}")
            raise Exception(f"Failed to list SFTP users: {str(e)}")

# Create a singleton instance
transfer_family_service = TransferFamilyService()
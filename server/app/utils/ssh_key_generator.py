import base64
import os
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend
from typing import Dict, Tuple
import logging

logger = logging.getLogger(__name__)

class SSHKeyGenerator:
    """Generate real SSH key pairs for SFTP users"""
    
    @staticmethod
    def generate_rsa_key_pair(username: str, key_size: int = 2048) -> Dict[str, str]:
        """
        Generate a real RSA SSH key pair
        
        Args:
            username: Username for the key comment
            key_size: RSA key size (default 2048, recommended 2048 or 4096)
            
        Returns:
            Dict containing 'public_key' and 'private_key' as strings
        """
        try:
            # Generate RSA private key
            private_key = rsa.generate_private_key(
                public_exponent=65537,
                key_size=key_size,
                backend=default_backend()
            )
            
            # Get public key
            public_key = private_key.public_key()
            
            # Serialize private key in PEM format (standard format)
            private_key_pem = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            ).decode('utf-8')
            
            # Generate public key in OpenSSH format
            public_key_openssh = SSHKeyGenerator._generate_openssh_public_key(
                public_key, username
            )
            
            logger.info(f"Successfully generated SSH key pair for user: {username}")
            
            return {
                'public_key': public_key_openssh,
                'private_key': private_key_pem
            }
            
        except Exception as e:
            logger.error(f"Failed to generate SSH key pair for {username}: {str(e)}")
            raise Exception(f"SSH key generation failed: {str(e)}")
    
    @staticmethod
    def _generate_openssh_public_key(public_key, username: str) -> str:
        """
        Generate OpenSSH format public key from cryptography public key object
        """
        try:
            # Get public key numbers
            public_numbers = public_key.public_numbers()
            
            # Convert to OpenSSH format
            # This creates the ssh-rsa key format that AWS Transfer Family expects
            
            # Encode the key components
            def encode_int(value):
                """Encode integer in SSH wire format"""
                if value == 0:
                    return b'\x00\x00\x00\x00'
                
                # Convert to bytes
                byte_length = (value.bit_length() + 7) // 8
                value_bytes = value.to_bytes(byte_length, 'big')
                
                # Add padding if MSB is set (to keep it positive)
                if value_bytes[0] & 0x80:
                    value_bytes = b'\x00' + value_bytes
                
                # Return length + data
                return len(value_bytes).to_bytes(4, 'big') + value_bytes
            
            def encode_string(s):
                """Encode string in SSH wire format"""
                if isinstance(s, str):
                    s = s.encode('utf-8')
                return len(s).to_bytes(4, 'big') + s
            
            # Build the key data
            key_type = b'ssh-rsa'
            key_data = (
                encode_string(key_type) +
                encode_int(public_numbers.e) +
                encode_int(public_numbers.n)
            )
            
            # Base64 encode the key data
            key_data_b64 = base64.b64encode(key_data).decode('ascii')
            
            # Format as OpenSSH public key
            return f"ssh-rsa {key_data_b64} {username}@sftp-server"
            
        except Exception as e:
            logger.error(f"Failed to generate OpenSSH public key: {str(e)}")
            raise Exception(f"Public key formatting failed: {str(e)}")
    
    @staticmethod
    def validate_ssh_public_key(key_string: str) -> bool:
        """
        Validate if an SSH public key string is properly formatted
        
        Args:
            key_string: SSH public key string to validate
            
        Returns:
            True if valid, False otherwise
        """
        try:
            if not key_string or not key_string.strip():
                return False
            
            parts = key_string.strip().split()
            
            # Must have at least key type and key data
            if len(parts) < 2:
                return False
            
            key_type = parts[0]
            key_data = parts[1]
            
            # Check supported key types
            supported_types = ['ssh-rsa', 'ssh-dss', 'ecdsa-sha2-nistp256', 
                             'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'ssh-ed25519']
            
            if key_type not in supported_types:
                return False
            
            # Validate base64 encoding
            try:
                base64.b64decode(key_data)
            except Exception:
                return False
            
            # Basic length check (should be reasonable length)
            if len(key_data) < 50:  # Too short to be a real key
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"SSH key validation error: {str(e)}")
            return False

# Create a singleton instance
ssh_key_generator = SSHKeyGenerator()
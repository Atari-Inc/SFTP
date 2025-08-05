import requests
import logging
from typing import Optional, Dict, Any
from functools import lru_cache

logger = logging.getLogger(__name__)

class GeolocationService:
    """Service to get location information from IP addresses"""
    
    def __init__(self):
        # Using ip-api.com which provides free geolocation (1000 requests/month free)
        # For production, consider upgrading to paid service or using multiple providers
        self.base_url = "http://ip-api.com/json"
        self.timeout = 5  # seconds
    
    @lru_cache(maxsize=1000)
    def get_location_from_ip(self, ip_address: str) -> Dict[str, Optional[str]]:
        """
        Get location information from IP address using ip-api.com
        
        Args:
            ip_address: IP address to lookup
            
        Returns:
            Dictionary with country, region, city, or empty values if lookup fails
        """
        # Default response
        default_location = {
            'country': None,
            'region': None,
            'city': None
        }
        
        # Skip localhost and private IPs
        if self._is_local_ip(ip_address):
            return {
                'country': 'Local',
                'region': 'Local',
                'city': 'Localhost'
            }
        
        try:
            # Make request to ip-api.com
            url = f"{self.base_url}/{ip_address}"
            params = {
                'fields': 'status,country,regionName,city',  # Only request needed fields
                'lang': 'en'
            }
            
            response = requests.get(url, params=params, timeout=self.timeout)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get('status') == 'success':
                return {
                    'country': data.get('country'),
                    'region': data.get('regionName'),
                    'city': data.get('city')
                }
            else:
                logger.warning(f"Geolocation API returned error for IP {ip_address}: {data.get('message', 'Unknown error')}")
                return default_location
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error during geolocation lookup for IP {ip_address}: {str(e)}")
            return default_location
        except Exception as e:
            logger.error(f"Unexpected error during geolocation lookup for IP {ip_address}: {str(e)}")
            return default_location
    
    def _is_local_ip(self, ip_address: str) -> bool:
        """Check if IP address is localhost or private network"""
        if not ip_address:
            return True
            
        # Common localhost addresses
        if ip_address in ['127.0.0.1', '::1', 'localhost']:
            return True
        
        # Private network ranges
        try:
            parts = ip_address.split('.')
            if len(parts) == 4:
                first = int(parts[0])
                second = int(parts[1])
                
                # 10.0.0.0/8
                if first == 10:
                    return True
                # 172.16.0.0/12
                if first == 172 and 16 <= second <= 31:
                    return True
                # 192.168.0.0/16
                if first == 192 and second == 168:
                    return True
        except (ValueError, IndexError):
            pass
        
        return False
    
    async def get_location_async(self, ip_address: str) -> Dict[str, Optional[str]]:
        """
        Async wrapper for get_location_from_ip
        Can be enhanced to use aiohttp for better async performance
        """
        return self.get_location_from_ip(ip_address)

# Create singleton instance
geolocation_service = GeolocationService()
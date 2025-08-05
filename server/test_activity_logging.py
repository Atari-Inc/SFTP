#!/usr/bin/env python3
"""
Test script for the enhanced activity logging system
"""
import asyncio
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.database import SessionLocal
from app.models.user import User, UserRole
from app.models.activity import ActivityAction, ActivityStatus
from app.services.activity_logger import activity_logger
from app.services.geolocation import geolocation_service

class MockRequest:
    """Mock FastAPI request object for testing"""
    def __init__(self, ip='8.8.8.8', user_agent='Test-Agent/1.0'):
        self.client = type('obj', (object,), {'host': ip})
        self.headers = {
            'User-Agent': user_agent,
            'X-Forwarded-For': None,
            'X-Real-IP': None
        }

async def test_geolocation():
    """Test the geolocation service"""
    print("Testing Geolocation Service...")
    
    # Test with Google DNS IP
    location = await geolocation_service.get_location_async('8.8.8.8')
    print(f"Location for 8.8.8.8: {location}")
    
    # Test with localhost
    local_location = await geolocation_service.get_location_async('127.0.0.1')
    print(f"Location for localhost: {local_location}")
    
    # Test with private IP
    private_location = await geolocation_service.get_location_async('192.168.1.1')
    print(f"Location for private IP: {private_location}")

async def test_activity_logging():
    """Test the enhanced activity logging"""
    print("\nTesting Activity Logging...")
    
    db = SessionLocal()
    try:
        # Create a test user if needed
        test_user = db.query(User).filter(User.username == 'test_activity_user').first()
        if not test_user:
            test_user = User(
                username='test_activity_user',
                email='test@example.com',
                password_hash='dummy_hash',
                role=UserRole.USER
            )
            db.add(test_user)
            db.commit()
            db.refresh(test_user)
        
        # Create mock request
        mock_request = MockRequest(ip='8.8.8.8', user_agent='Test-Browser/1.0')
        
        # Test file activity logging
        print("Logging file upload activity...")
        await activity_logger.log_file_activity(
            db=db,
            user=test_user,
            action=ActivityAction.UPLOAD,
            file_path='/uploads/documents/test_file.pdf',
            request=mock_request,
            status=ActivityStatus.SUCCESS,
            file_size=1024000,
            file_type='application/pdf',
            additional_details={'upload_source': 'web_interface'}
        )
        
        # Test regular activity logging
        print("Logging user management activity...")
        await activity_logger.log_activity(
            db=db,
            user=test_user,
            action=ActivityAction.VIEW,
            resource='User Dashboard',
            request=mock_request,
            status=ActivityStatus.SUCCESS,
            details={'section': 'profile', 'tab': 'settings'}
        )
        
        print("✓ Activity logging test completed successfully!")
        
    except Exception as e:
        print(f"✗ Activity logging test failed: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

async def main():
    """Run all tests"""
    print("=" * 50)
    print("Enhanced Activity Logging System Test")
    print("=" * 50)
    
    try:
        await test_geolocation()
        await test_activity_logging()
        print("\n" + "=" * 50)
        print("All tests completed!")
        print("Check your activity logs in the web interface to see the new fields:")
        print("- File Path: Shows full path for file operations")
        print("- Location: Shows city, region, country from IP")
        print("- Enhanced details with file size, type, etc.")
    except Exception as e:
        print(f"Test failed: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(main())
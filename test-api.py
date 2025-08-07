#!/usr/bin/env python3
"""
API Test Script for SFTP File Transfer System
Run this script to test all API endpoints
"""

import requests
import json
import sys
from urllib.parse import quote

class APITester:
    def __init__(self, base_url="http://localhost:3001/api"):
        self.base_url = base_url
        self.token = None
        self.headers = {"Content-Type": "application/json"}
    
    def login(self, username="admin", password="admin123"):
        """Test login and get access token"""
        print("🔐 Testing Login...")
        
        try:
            response = requests.post(
                f"{self.base_url}/auth/login",
                json={"username": username, "password": password},
                headers=self.headers
            )
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token")
                self.headers["Authorization"] = f"Bearer {self.token}"
                print(f"✅ Login successful! Token: {self.token[:20]}...")
                return True
            else:
                print(f"❌ Login failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Login error: {e}")
            return False
    
    def test_auth_me(self):
        """Test /auth/me endpoint"""
        print("👤 Testing Get Current User...")
        
        try:
            response = requests.get(f"{self.base_url}/auth/me", headers=self.headers)
            
            if response.status_code == 200:
                user = response.json()
                print(f"✅ Current user: {user.get('username')} ({user.get('role')})")
                return True
            else:
                print(f"❌ Get user failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Get user error: {e}")
            return False
    
    def test_health(self):
        """Test health endpoint"""
        print("🏥 Testing Health Check...")
        
        try:
            response = requests.get("http://localhost:3001/health")
            
            if response.status_code == 200:
                health = response.json()
                print(f"✅ Health check: {health.get('status')}")
                return True
            else:
                print(f"❌ Health check failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Health check error: {e}")
            return False
    
    def test_files_list(self):
        """Test files listing"""
        print("📁 Testing Files List...")
        
        try:
            response = requests.get(f"{self.base_url}/files?path=/", headers=self.headers)
            
            if response.status_code == 200:
                data = response.json()
                files = data.get("data", [])
                print(f"✅ Files list: Found {len(files)} items")
                
                # Show first few files
                for file in files[:3]:
                    print(f"   - {file.get('name')} ({file.get('type')}) - ID: {file.get('id')}")
                
                return True, files
            else:
                print(f"❌ Files list failed: {response.status_code} - {response.text}")
                return False, []
                
        except Exception as e:
            print(f"❌ Files list error: {e}")
            return False, []
    
    def test_stats_dashboard(self):
        """Test dashboard stats"""
        print("📈 Testing Dashboard Stats...")
        
        try:
            response = requests.get(f"{self.base_url}/stats/dashboard", headers=self.headers)
            
            if response.status_code == 200:
                stats = response.json()
                print(f"✅ Dashboard stats loaded successfully")
                
                if "users" in stats:
                    print(f"   - Total users: {stats['users'].get('total', 'N/A')}")
                if "files" in stats:
                    print(f"   - Total files: {stats['files'].get('total', 'N/A')}")
                
                return True
            else:
                print(f"❌ Dashboard stats failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Dashboard stats error: {e}")
            return False
    
    def test_activity_logs(self):
        """Test activity logs"""
        print("📋 Testing Activity Logs...")
        
        try:
            response = requests.get(f"{self.base_url}/activity/?page=1&limit=5", headers=self.headers)
            
            if response.status_code == 200:
                data = response.json()
                logs = data.get("data", [])
                print(f"✅ Activity logs: Found {len(logs)} recent entries")
                
                for log in logs[:2]:
                    print(f"   - {log.get('action')} by {log.get('username')} ({log.get('status')})")
                
                return True
            else:
                print(f"❌ Activity logs failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Activity logs error: {e}")
            return False
    
    def test_file_download(self, file_id):
        """Test file download"""
        print(f"⬇️ Testing File Download...")
        
        try:
            # URL encode the file ID
            encoded_file_id = quote(file_id, safe='')
            response = requests.get(
                f"{self.base_url}/files/{encoded_file_id}/download", 
                headers=self.headers
            )
            
            if response.status_code == 200:
                print(f"✅ File download successful: {len(response.content)} bytes")
                return True
            else:
                print(f"❌ File download failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ File download error: {e}")
            return False
    
    def test_users_list(self):
        """Test users list (admin only)"""
        print("👥 Testing Users List...")
        
        try:
            response = requests.get(f"{self.base_url}/users?page=1&limit=5", headers=self.headers)
            
            if response.status_code == 200:
                data = response.json()
                users = data.get("data", [])
                print(f"✅ Users list: Found {len(users)} users")
                
                for user in users[:2]:
                    print(f"   - {user.get('username')} ({user.get('role')}) - SFTP: {user.get('enable_sftp')}")
                
                return True
            else:
                print(f"❌ Users list failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Users list error: {e}")
            return False
    
    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting API Tests for SFTP File Transfer System\n")
        
        results = []
        
        # Test 1: Health Check (no auth)
        results.append(("Health Check", self.test_health()))
        
        # Test 2: Login
        login_success = self.login()
        results.append(("Login", login_success))
        
        if not login_success:
            print("\n❌ Cannot continue without valid authentication")
            return results
        
        # Test 3: Get current user
        results.append(("Get Current User", self.test_auth_me()))
        
        # Test 4: Dashboard stats
        results.append(("Dashboard Stats", self.test_stats_dashboard()))
        
        # Test 5: Activity logs
        results.append(("Activity Logs", self.test_activity_logs()))
        
        # Test 6: Files list
        files_success, files = self.test_files_list()
        results.append(("Files List", files_success))
        
        # Test 7: File download (if files exist)
        if files_success and files:
            file_to_download = None
            for file in files:
                if file.get('type') == 'file':
                    file_to_download = file.get('id')
                    break
            
            if file_to_download:
                results.append(("File Download", self.test_file_download(file_to_download)))
            else:
                print("⚠️ No files available for download test")
                results.append(("File Download", None))
        
        # Test 8: Users list (admin only)
        results.append(("Users List", self.test_users_list()))
        
        # Print summary
        print(f"\n{'='*50}")
        print("📊 TEST RESULTS SUMMARY")
        print(f"{'='*50}")
        
        passed = 0
        failed = 0
        skipped = 0
        
        for test_name, result in results:
            if result is True:
                print(f"✅ {test_name}")
                passed += 1
            elif result is False:
                print(f"❌ {test_name}")
                failed += 1
            else:
                print(f"⚠️ {test_name} (skipped)")
                skipped += 1
        
        print(f"\nTotal: {len(results)} tests")
        print(f"Passed: {passed} ✅")
        print(f"Failed: {failed} ❌") 
        print(f"Skipped: {skipped} ⚠️")
        
        if failed == 0:
            print(f"\n🎉 All tests passed! Your API is working correctly.")
        else:
            print(f"\n⚠️ {failed} test(s) failed. Please check the server and authentication.")
        
        return results

def main():
    """Main function"""
    if len(sys.argv) > 1:
        base_url = sys.argv[1]
    else:
        base_url = "http://localhost:3001/api"
    
    print(f"Testing API at: {base_url}")
    print(f"Make sure your server is running!\n")
    
    tester = APITester(base_url)
    results = tester.run_all_tests()
    
    # Exit with error code if tests failed
    failed_count = sum(1 for _, result in results if result is False)
    sys.exit(1 if failed_count > 0 else 0)

if __name__ == "__main__":
    main()
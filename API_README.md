# SFTP File Transfer System - API Collection

This directory contains a complete API collection for the SFTP File Transfer System with all endpoints, documentation, and testing tools.

## 📁 Files Included

- **`api-collection.json`** - Complete Postman collection with all API endpoints
- **`postman-environment.json`** - Postman environment variables
- **`API_DOCUMENTATION.md`** - Comprehensive API documentation
- **`test-api.py`** - Python script to test all API endpoints
- **`API_README.md`** - This file

## 🚀 Quick Start

### Option 1: Import into Postman

1. **Import Collection:**
   ```
   File → Import → Choose Files → Select api-collection.json
   ```

2. **Import Environment:**
   ```
   File → Import → Choose Files → Select postman-environment.json
   ```

3. **Configure Environment:**
   - Select "SFTP File Transfer Environment" from environment dropdown
   - Update variables if needed:
     - `base_url`: Your API base URL (default: http://localhost:3001/api)
     - `admin_username`: Admin username (default: admin)  
     - `admin_password`: Admin password (update this!)

4. **Authenticate:**
   - Run the "Authentication → Login" request
   - The `access_token` will be automatically set for other requests

5. **Test Endpoints:**
   - All endpoints are organized by category
   - Bearer token authentication is pre-configured
   - Examples include request bodies and expected responses

### Option 2: Use Python Test Script

1. **Install Requirements:**
   ```bash
   pip install requests
   ```

2. **Run Tests:**
   ```bash
   # Test with default settings
   python test-api.py

   # Test with custom base URL
   python test-api.py http://localhost:3001/api
   ```

3. **View Results:**
   - The script tests all major endpoints
   - Shows detailed results and summary
   - Returns exit code 0 on success, 1 on failure

### Option 3: Manual cURL Testing

1. **Login to get token:**
   ```bash
   curl -X POST http://localhost:3001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"your_password"}'
   ```

2. **Use token for authenticated requests:**
   ```bash
   # Replace YOUR_TOKEN with actual token
   curl -X GET http://localhost:3001/api/files?path=/ \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

## 📋 API Categories

### 🔐 Authentication
- Login with username/password
- Get current user information
- Debug token validity

### 👥 User Management
- List, create, update, delete users
- Generate SSH keys
- Manage SFTP access and passwords
- Handle user folder permissions

### 📁 File Operations
- List files and folders
- Upload/download files
- Create/rename/delete items
- Move/copy operations
- Search functionality
- File sharing and previews

### 🔒 SFTP Management
- Test SFTP connections
- List SFTP users
- Remote file operations
- Connection information

### 📊 Statistics & Monitoring
- Dashboard statistics
- Storage usage stats
- User activity metrics
- System health monitoring

### 📋 Activity Logging
- View activity logs
- Filter by user/action/date
- Export logs (CSV/JSON)
- Audit trail functionality

### 📂 Folder Management
- List S3 folders
- Bucket information
- Storage statistics

## 🔧 Configuration

### Environment Variables (Postman)
```json
{
  "base_url": "http://localhost:3001/api",
  "access_token": "auto-populated-on-login",
  "user_id": "set-from-responses",
  "file_id": "s3_file:example.txt",
  "admin_username": "admin",
  "admin_password": "your_password_here"
}
```

### Common File ID Formats
- **File**: `s3_file:path/to/file.txt`
- **Folder**: `s3_folder:path/to/folder`

**Important**: URL-encode file IDs when using in URL paths:
- `s3_file:documents/example.txt` → `s3_file%3Adocuments%2Fexample.txt`

## 🐛 Troubleshooting

### Common Issues

1. **403 Forbidden Errors:**
   - Token expired → Re-run login request
   - User not authorized → Check user role permissions
   - CORS issues → Verify server configuration

2. **404 Not Found:**
   - Wrong base URL → Check server is running on correct port
   - File ID not found → Verify file exists and ID format
   - URL encoding → Ensure special characters are encoded

3. **Connection Refused:**
   - Server not running → Start the server (`python start_server.py`)
   - Wrong port → Check server is on port 3001
   - Firewall blocking → Check network configuration

### Debug Steps

1. **Test Health Endpoint:**
   ```bash
   curl http://localhost:3001/health
   ```

2. **Check Server Logs:**
   - Look for authentication errors
   - Check S3 connection status
   - Review API request logs

3. **Validate Token:**
   - Use `/auth/debug-token` endpoint
   - Check token expiration
   - Verify token format

## 📚 Additional Resources

- **Full Documentation**: See `API_DOCUMENTATION.md`
- **OpenAPI/Swagger**: Visit `http://localhost:3001/docs` when server is running
- **Server Repository**: Check the main project repository
- **Support**: Create an issue in the project repository

## 🎯 Example Workflow

1. **Authenticate:**
   ```bash
   POST /auth/login
   ```

2. **List Files:**
   ```bash
   GET /files?path=/
   ```

3. **Upload File:**
   ```bash
   POST /files/upload (form-data)
   ```

4. **Download File:**
   ```bash
   GET /files/{encoded_file_id}/download
   ```

5. **View Activity:**
   ```bash
   GET /activity/?page=1&limit=20
   ```

## 🔄 Updates

This API collection is based on the current system state. If new endpoints are added or existing ones are modified:

1. Update the collection JSON
2. Refresh the documentation
3. Add new test cases to the Python script
4. Update environment variables as needed

---

**Happy API Testing! 🚀**
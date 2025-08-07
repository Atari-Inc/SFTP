# SFTP File Transfer System API Documentation

## Base URL
```
http://localhost:3001/api
```

## Authentication
All endpoints (except login and health check) require Bearer token authentication.

### Headers
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

---

## 📁 Authentication Endpoints

### POST /auth/login
Login with username and password.

**Request Body:**
```json
{
  "username": "admin",
  "password": "password"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin",
    "is_active": true,
    "enable_sftp": true
  }
}
```

### GET /auth/me
Get current authenticated user information.

**Response:**
```json
{
  "id": "uuid",
  "username": "admin",
  "email": "admin@example.com",
  "role": "admin",
  "is_active": true,
  "enable_sftp": true
}
```

### POST /auth/debug-token
Debug endpoint to validate token (no auth required).

**Request Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## 👥 User Management Endpoints

### GET /users
List all users (admin only).

**Query Parameters:**
- `page` (int): Page number (default: 1)
- `limit` (int): Items per page (default: 10, max: 100)
- `search` (string): Search by username or email

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "username": "user1",
      "email": "user1@example.com",
      "role": "user",
      "is_active": true,
      "enable_sftp": false,
      "last_login": "2025-01-07T10:30:00Z",
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-07T10:30:00Z",
      "folder_assignments": []
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### POST /users
Create a new user (admin only).

**Request Body:**
```json
{
  "username": "newuser",
  "email": "newuser@example.com",
  "password": "password123",
  "role": "user",
  "enable_sftp": true,
  "home_directory": "/home/newuser",
  "ssh_public_key": "ssh-rsa AAAAB3NzaC1yc2E...",
  "private_key": "-----BEGIN OPENSSH PRIVATE KEY-----...",
  "folder_assignments": [
    {
      "folder_path": "/shared",
      "permission": "read"
    }
  ]
}
```

### PUT /users/{user_id}
Update user information (admin only).

### DELETE /users/{user_id}
Delete a user (admin only).

### POST /users/generate-ssh-key
Generate SSH key pair for a user.

**Request Body:**
```json
{
  "username": "testuser"
}
```

**Response:**
```json
{
  "username": "testuser",
  "public_key": "ssh-rsa AAAAB3NzaC1yc2E...",
  "private_key": "-----BEGIN OPENSSH PRIVATE KEY-----...",
  "message": "SSH key pair generated successfully"
}
```

### POST /users/{user_id}/sftp-password
Reset SFTP password for a user (admin only).

**Request Body:**
```json
{
  "password": "newpassword123"
}
```

### POST /users/{user_id}/sftp-ssh-key
Update SFTP SSH key for a user (admin only).

**Request Body:**
```json
{
  "ssh_public_key": "ssh-rsa AAAAB3NzaC1yc2E..."
}
```

---

## 📁 File Management Endpoints

### GET /files/test
Test endpoint to verify files API is working.

### GET /files
List files and folders.

**Query Parameters:**
- `path` (string): Directory path (default: "/")

**Response:**
```json
{
  "data": [
    {
      "id": "s3_file:documents/example.txt",
      "name": "example.txt",
      "size": 1024,
      "type": "file",
      "path": "/documents/example.txt",
      "mime_type": "text/plain",
      "permissions": "644",
      "owner": "user1",
      "group": "users",
      "created_at": "2025-01-07T10:00:00Z",
      "modified_at": "2025-01-07T10:30:00Z",
      "accessed_at": null
    },
    {
      "id": "s3_folder:documents",
      "name": "documents",
      "size": 0,
      "type": "folder",
      "path": "/documents",
      "permissions": "755"
    }
  ],
  "total": 2,
  "path": "/"
}
```

### POST /files/upload
Upload a file.

**Form Data:**
- `file`: File to upload
- `path`: Target directory path

### GET /files/{file_id}/download
Download a file or folder (as ZIP).

**Note:** `file_id` should be URL-encoded (e.g., `s3_file%3Adocuments/example.txt`)

### DELETE /files
Delete multiple files.

**Request Body:**
```json
{
  "file_ids": ["s3_file:example.txt", "s3_folder:old-folder"]
}
```

### POST /files/folder
Create a new folder.

**Request Body:**
```json
{
  "name": "New Folder",
  "path": "/"
}
```

### PUT /files/{file_id}/rename
Rename a file or folder.

**Request Body:**
```json
{
  "name": "new-filename.txt"
}
```

### PUT /files/move
Move files to a different location.

**Request Body:**
```json
{
  "file_ids": ["s3_file:example.txt"],
  "target_path": "/moved"
}
```

### POST /files/copy
Copy files to a different location.

**Request Body:**
```json
{
  "file_ids": ["s3_file:example.txt"],
  "target_path": "/copied"
}
```

### POST /files/share
Share a file with other users.

**Request Body:**
```json
{
  "file_id": "s3_file:example.txt",
  "share_with": ["user@example.com"],
  "permission": "read",
  "expires_in": 3600
}
```

### GET /files/search
Search for files.

**Query Parameters:**
- `query` (string): Search term
- `path` (string): Directory to search in

### GET /files/storage-stats
Get storage statistics.

**Query Parameters:**
- `path` (string): Directory path

### GET /files/preview/{file_id}
Get file preview (for supported file types).

### POST /files/bulk-operation
Perform bulk operations on multiple files.

**Request Body:**
```json
{
  "operation": "delete",
  "file_ids": ["s3_file:file1.txt", "s3_file:file2.txt"],
  "target_path": "/target"
}
```

---

## 🔒 SFTP Endpoints

### GET /sftp/connection-info
Get SFTP connection information for current user.

### POST /sftp/test-connection
Test SFTP connection with provided credentials.

**Request Body:**
```json
{
  "host": "localhost",
  "port": 22,
  "username": "testuser",
  "private_key": "-----BEGIN OPENSSH PRIVATE KEY-----..."
}
```

### POST /sftp/list-files
List files on SFTP server.

**Request Body:**
```json
{
  "path": "/",
  "host": "localhost",
  "port": 22,
  "username": "testuser",
  "private_key": "-----BEGIN OPENSSH PRIVATE KEY-----..."
}
```

### POST /sftp/download
Download file from SFTP server.

**Request Body:**
```json
{
  "remote_path": "/remote/file.txt",
  "host": "localhost",
  "port": 22,
  "username": "testuser",
  "private_key": "-----BEGIN OPENSSH PRIVATE KEY-----..."
}
```

### POST /sftp/upload
Upload file to SFTP server.

**Form Data:**
- `file`: File to upload
- `remote_path`: Target path on SFTP server
- `host`: SFTP server hostname
- `port`: SFTP server port
- `username`: SFTP username
- `private_key`: SSH private key

### GET /sftp/users
List SFTP users (admin only).

---

## 📊 Activity Log Endpoints

### GET /activity/
Get activity logs.

**Query Parameters:**
- `page` (int): Page number
- `limit` (int): Items per page
- `search` (string): Search term
- `action` (string): Filter by action type
- `status` (string): Filter by status
- `start_date` (date): Filter from date (YYYY-MM-DD)
- `end_date` (date): Filter to date (YYYY-MM-DD)
- `user_id` (string): Filter by user ID

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "username": "user1",
      "action": "DOWNLOAD",
      "resource": "file",
      "resource_id": "s3_file:example.txt",
      "status": "SUCCESS",
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0...",
      "details": {
        "filename": "example.txt",
        "size": 1024
      },
      "created_at": "2025-01-07T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### GET /activity/{log_id}
Get specific activity log by ID.

### GET /activity/export
Export activity logs.

**Query Parameters:**
- `format` (string): Export format ("csv" or "json")
- `start_date` (date): Filter from date
- `end_date` (date): Filter to date

---

## 📈 Statistics Endpoints

### GET /stats/dashboard
Get dashboard statistics.

**Response:**
```json
{
  "users": {
    "total": 50,
    "active": 35,
    "new_this_month": 5
  },
  "files": {
    "total": 1250,
    "size": 5368709120,
    "uploads_today": 15
  },
  "activity": {
    "total_today": 128,
    "downloads": 45,
    "uploads": 23,
    "logins": 18
  },
  "storage": {
    "used": 5368709120,
    "total": 10737418240,
    "percentage": 50.0
  }
}
```

### GET /stats/storage
Get storage statistics.

### GET /stats/users
Get user statistics.

### GET /stats/activity
Get activity statistics.

**Query Parameters:**
- `period` (string): Time period ("24h", "7d", "30d")

---

## 📂 Folder Endpoints

### GET /folders
List S3 folders.

### GET /folders/bucket-info
Get S3 bucket information.

---

## 🏥 Health Check Endpoints

### GET /health
Health check endpoint (no auth required).

**Response:**
```json
{
  "status": "healthy",
  "environment": "development"
}
```

### GET /
Root endpoint (no auth required).

**Response:**
```json
{
  "message": "Atari Files Transfer API",
  "version": "1.0.0",
  "docs": "/docs"
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "detail": "Invalid request data"
}
```

### 401 Unauthorized
```json
{
  "detail": "Could not validate credentials"
}
```

### 403 Forbidden
```json
{
  "detail": "Not enough permissions"
}
```

### 404 Not Found
```json
{
  "detail": "Resource not found"
}
```

### 422 Validation Error
```json
{
  "detail": [
    {
      "loc": ["body", "username"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

### 500 Internal Server Error
```json
{
  "detail": "Internal server error",
  "message": "Detailed error message (development only)"
}
```

---

## Common File ID Formats

- **File**: `s3_file:path/to/file.txt`
- **Folder**: `s3_folder:path/to/folder`

Remember to URL-encode file IDs when using them in URL paths:
- `s3_file:documents/example.txt` → `s3_file%3Adocuments%2Fexample.txt`

---

## Import Instructions

### Postman
1. Import `api-collection.json` as a collection
2. Import `postman-environment.json` as an environment
3. Set the environment as active
4. Update the `admin_username` and `admin_password` variables
5. Run the "Login" request to populate the `access_token`

### Thunder Client (VS Code)
1. Copy the collection JSON and import it
2. Set the base URL to `http://localhost:3001/api`
3. Use Bearer token authentication with your access token

### cURL Examples
```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# List files (replace TOKEN with actual token)
curl -X GET http://localhost:3001/api/files?path=/ \
  -H "Authorization: Bearer TOKEN"

# Download file (URL encode the file ID)
curl -X GET "http://localhost:3001/api/files/s3_file%3Aexample.txt/download" \
  -H "Authorization: Bearer TOKEN" \
  --output example.txt
```
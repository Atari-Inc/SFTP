# Atari Files Transfer - Backend Server

A Python FastAPI backend server for the Atari Files Transfer application, providing REST APIs for user management, file operations, activity logging, and system monitoring.

## 🚀 Features

- **FastAPI Framework**: Modern, fast Python web framework
- **JWT Authentication**: Secure token-based authentication
- **PostgreSQL Database**: Robust relational database with SQLAlchemy ORM
- **AWS S3 Integration**: Scalable file storage solution
- **Activity Logging**: Comprehensive audit trail system
- **Role-based Access Control**: Admin and user roles with appropriate permissions
- **RESTful APIs**: Clean, consistent API design
- **Automatic Documentation**: Interactive API docs with Swagger/OpenAPI

## 🛠️ Tech Stack

- **Framework**: FastAPI 0.104+
- **Database**: PostgreSQL with SQLAlchemy 2.0
- **Authentication**: JWT with python-jose
- **File Storage**: AWS S3 with boto3
- **Validation**: Pydantic 2.0
- **Migration**: Alembic
- **Server**: Uvicorn ASGI server

## 📁 Project Structure

```
server/
├── app/
│   ├── api/                # API route handlers
│   │   ├── auth.py         # Authentication endpoints
│   │   ├── users.py        # User management endpoints
│   │   ├── files.py        # File operations endpoints
│   │   ├── activity.py     # Activity logs endpoints
│   │   └── stats.py        # Statistics endpoints
│   ├── core/               # Core functionality
│   │   ├── security.py     # Password hashing, JWT handling
│   │   └── dependencies.py # FastAPI dependencies
│   ├── db/                 # Database utilities
│   │   └── init_db.py      # Database initialization
│   ├── middleware/         # Custom middleware
│   │   ├── cors.py         # CORS configuration
│   │   └── logging.py      # Request logging
│   ├── models/             # SQLAlchemy models
│   │   ├── user.py         # User model
│   │   ├── file.py         # File model
│   │   └── activity.py     # Activity log model
│   ├── schemas/            # Pydantic schemas
│   │   ├── user.py         # User schemas
│   │   ├── file.py         # File schemas
│   │   └── activity.py     # Activity schemas
│   ├── services/           # Business logic services
│   │   ├── s3_service.py   # AWS S3 operations
│   │   └── activity_logger.py # Activity logging
│   ├── config.py           # Configuration management
│   └── database.py         # Database connection
├── alembic/                # Database migrations
├── logs/                   # Application logs
├── main.py                 # FastAPI application
├── run.py                  # Server startup script
├── requirements.txt        # Python dependencies
├── alembic.ini             # Alembic configuration
└── .env                    # Environment variables
```

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- PostgreSQL database
- AWS account with S3 access

### Installation

1. **Navigate to server directory**
```bash
cd server
```

2. **Create virtual environment**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Configure environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

5. **Initialize database**
```bash
python -c "from app.db.init_db import init_db; init_db()"
```

6. **Start the server**
```bash
python run.py
```

The server will start on http://localhost:3001

### Alternative: Direct run
```bash
python main.py
```

## 📋 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user info

### Users (Admin only)
- `GET /api/users/` - List users
- `GET /api/users/{user_id}` - Get user by ID
- `POST /api/users/` - Create user
- `PUT /api/users/{user_id}` - Update user
- `DELETE /api/users/{user_id}` - Delete user
- `PUT /api/users/profile` - Update own profile

### Files
- `GET /api/files/` - List files in directory
- `POST /api/files/upload` - Upload file
- `GET /api/files/{file_id}/download` - Download file
- `DELETE /api/files/` - Delete files
- `POST /api/files/folder` - Create folder
- `PUT /api/files/{file_id}/rename` - Rename file/folder

### Activity Logs
- `GET /api/activity/` - Get activity logs
- `GET /api/activity/{log_id}` - Get specific log
- `GET /api/activity/export` - Export logs (CSV/JSON)

### Statistics
- `GET /api/stats/dashboard` - Dashboard statistics
- `GET /api/stats/storage` - Storage statistics
- `GET /api/stats/users` - User statistics (admin only)
- `GET /api/stats/activity` - Activity statistics

## 🔧 Configuration

### Environment Variables

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database Configuration
DATABASE_URL=postgresql://user:pass@host:port/database

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# AWS Configuration
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-2
AWS_S3_BUCKET=your_bucket_name

# File Upload Configuration
MAX_FILE_SIZE=100MB
UPLOAD_DIR=uploads/

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=logs/app.log
```

## 🗄️ Database

The application uses PostgreSQL with SQLAlchemy ORM. Database migrations are handled by Alembic.

### Default Users

The system creates two default users:
- **Admin**: `admin` / `admin123`
- **User**: `user` / `user123`

### Models

- **User**: User accounts with roles and authentication
- **File**: File and folder metadata with S3 integration
- **ActivityLog**: Comprehensive audit trail of user actions

## 🔒 Security Features

- **JWT Authentication**: Secure token-based auth with refresh tokens
- **Password Hashing**: bcrypt for secure password storage
- **Role-based Access**: Admin and user roles with appropriate permissions
- **Input Validation**: Pydantic schemas for request/response validation
- **CORS Protection**: Configurable CORS for frontend integration
- **Activity Logging**: Complete audit trail of user actions

## 📊 API Documentation

Interactive API documentation is available at:
- **Swagger UI**: http://localhost:3001/docs
- **ReDoc**: http://localhost:3001/redoc

## 🧪 Development

### Running in Development Mode
```bash
python run.py
# or
python main.py
```

### Database Migrations
```bash
# Generate migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head
```

### Testing
```bash
pytest
```

## 🚀 Production Deployment

### Using Docker
```dockerfile
FROM python:3.9

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 3001

CMD ["python", "run.py"]
```

### Using systemd
```ini
[Unit]
Description=SFTP Admin Dashboard API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/server
ExecStart=/path/to/venv/bin/python run.py
Restart=always

[Install]
WantedBy=multi-user.target
```

## 📝 Logging

Logs are written to both console and file (`logs/app.log` by default). Log levels can be configured via `LOG_LEVEL` environment variable.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run linting and tests
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License.
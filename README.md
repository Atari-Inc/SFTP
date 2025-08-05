# Atari Files Transfer

A comprehensive SFTP server management system built with React and FastAPI, featuring file management, user administration, activity logging, and real-time monitoring capabilities for Atari file operations.

![Atari Files Transfer](https://img.shields.io/badge/React-18.2.0-blue?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0.2-blue?style=flat-square&logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-16+-green?style=flat-square&logo=node.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue?style=flat-square&logo=postgresql)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

## 🚀 Features

### Frontend (React + TypeScript)
- **Modern UI/UX**: Built with React 18, TypeScript, and Tailwind CSS
- **Authentication**: Secure login with JWT tokens and role-based access control
- **File Management**: Complete file browser with upload/download, drag & drop, and file operations
- **User Management**: Admin panel for user creation, editing, and role management
- **Activity Logs**: Comprehensive logging with filtering and export capabilities
- **Dashboard Analytics**: Real-time system statistics and monitoring
- **Responsive Design**: Mobile-friendly interface with adaptive layouts

### Backend (FastAPI + Python)
- **RESTful API**: Well-structured API with proper error handling
- **Database Integration**: PostgreSQL with SQLAlchemy ORM
- **File Storage**: AWS S3 integration for scalable file storage
- **Authentication**: JWT-based authentication with refresh tokens
- **Activity Logging**: Comprehensive audit trail with IP geolocation tracking
- **Security**: Rate limiting, input validation, and security headers
- **SFTP Integration**: AWS Transfer Family integration for secure file transfers

## 🏗️ Architecture

```
Atari-Files-Transfer/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── contexts/       # React Context providers
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   ├── types/          # TypeScript definitions
│   │   └── utils/          # Utility functions
│   ├── public/            # Static assets
│   └── package.json       # Frontend dependencies
├── server/                # FastAPI backend
│   ├── app/
│   │   ├── api/           # API route handlers
│   │   ├── core/          # Core functionality (auth, deps)
│   │   ├── models/        # SQLAlchemy database models
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── services/      # Business logic services
│   │   └── utils/         # Utility functions
│   ├── alembic/          # Database migrations
│   └── requirements.txt  # Python dependencies
└── README.md
```

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Context API + useReducer
- **Routing**: React Router DOM
- **Forms**: React Hook Form
- **HTTP Client**: Axios
- **UI Icons**: Lucide React
- **Notifications**: React Hot Toast

### Backend
- **Runtime**: Python 3.11+
- **Framework**: FastAPI
- **Database**: PostgreSQL
- **ORM**: SQLAlchemy
- **Authentication**: JWT with OAuth2
- **File Storage**: AWS S3
- **SFTP Integration**: AWS Transfer Family
- **Validation**: Pydantic
- **Logging**: Python logging with activity tracking

### Infrastructure
- **Database**: PostgreSQL (AWS RDS)
- **File Storage**: AWS S3
- **Authentication**: JWT tokens
- **Security**: bcrypt, helmet, rate limiting

## 🚀 Quick Start

### Prerequisites
- Python 3.11+ and pip
- Node.js 16+ and npm/yarn
- PostgreSQL database
- AWS account (for S3 storage and Transfer Family)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd Atari-Files-Transfer
```

2. **Set up the backend**
```bash
cd server
pip install -r requirements.txt
cp .env.example .env
# Configure your environment variables in .env
alembic upgrade head
python main.py
```

3. **Set up the frontend**
```bash
cd ../client
npm install
cp .env.example .env
# Configure your environment variables in .env
npm run dev
```

4. **Access the application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

### Default Credentials
- **Admin**: admin / admin123
- **User**: user / user123

## 📁 Key Features

### File Management
- Browse files and folders with breadcrumb navigation
- Upload files via drag & drop or file picker
- Download individual files or multiple selections
- Create, rename, and delete folders
- Real-time upload/download progress tracking
- Grid and list view modes

### User Administration
- Create and manage user accounts
- Role-based permissions (Admin/User)
- User status management (Active/Inactive)
- Password policies and validation
- User activity monitoring

### Activity Monitoring
- Comprehensive audit logs for all actions
- Advanced filtering by user, action, date range
- Export logs in CSV or JSON format
- Real-time activity tracking
- Search and pagination

### Dashboard Analytics
- System overview with key metrics
- Storage usage monitoring
- User activity statistics
- System health indicators
- Real-time data updates

## 🔧 Configuration

### Environment Variables

#### Client (.env)
```env
VITE_API_BASE_URL=http://localhost:3001/api
VITE_AWS_ACCESS_KEY=your_access_key
VITE_AWS_SECRET_KEY=your_secret_key
VITE_AWS_REGION=us-east-2
VITE_AWS_BUCKET=your_bucket_name
```

#### Server (.env)
```env
DATABASE_URL=postgresql://user:pass@host:port/db
JWT_SECRET=your_jwt_secret
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=your_bucket_name
```

## 🔒 Security Features

- JWT-based authentication with refresh tokens
- Role-based access control (RBAC)
- Password hashing with bcrypt
- Input validation and sanitization
- Rate limiting and CORS protection
- Secure HTTP headers with Helmet
- SQL injection prevention with Prisma ORM

## 📱 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- React team for the amazing framework
- Tailwind CSS for the utility-first CSS framework
- Prisma for the excellent ORM
- All open-source contributors who made this project possible
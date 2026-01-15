# 🌩️ THE BACKDRIVE - Cloud Storage System

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-v11-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/React-v19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Google%20Drive-API-4285F4?style=for-the-badge&logo=googledrive&logoColor=white" alt="Google Drive" />
</p>

A full-stack cloud storage system using **Google Drive** as the storage backend. Features JWT authentication, resumable uploads, secure signed URLs for file preview, and a Neo-Brutalist UI design.

## 🏗️ Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   React + Vite   │────▶│   NestJS API     │────▶│  Google Drive    │
│   (Frontend)     │     │   (Backend)      │     │  (Storage)       │
└──────────────────┘     └────────┬─────────┘     └──────────────────┘
                                  │
                         ┌────────▼─────────┐
                         │  MongoDB Atlas   │
                         │  (Metadata)      │
                         └──────────────────┘
```

## ✨ Features

- **🔐 Authentication**: JWT with refresh tokens, bcrypt password hashing
- **📤 Resumable Upload**: Direct upload to Google Drive from browser
- **🔗 Signed URLs**: Secure, time-limited URLs (5 min) for file preview
- **📁 Folder Management**: Create, navigate, and organize folders
- **🔄 File Operations**: Upload, download, move, delete
- **📊 Storage Quota**: Per-user storage limits with usage tracking
- **🌐 i18n**: Vietnamese and English language support
- **🛡️ Admin Panel**: User management, feedback system, shared access control
- **🎨 Neo-Brutalist UI**: Bold, modern design with TailwindCSS

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18
- MongoDB Atlas account
- Google Cloud project with Drive API enabled

### 1. Clone and Install

```bash
git clone <repository-url>
cd cloud-storage-system

# Install backend dependencies
cd backend && yarn install

# Install frontend dependencies
cd ../frontend && yarn install
```

### 2. Configure Environment

**Backend** (`backend/.env`):
```env
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/<db>
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-refresh-token-secret
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
GOOGLE_DRIVE_FOLDER_ID=root-folder-id-in-drive
DEFAULT_USER_QUOTA=1073741824
PORT=4000
```

**Frontend** (`frontend/.env`):
```env
VITE_API_URL=http://localhost:4000/api
```

### 3. Run Development Servers

```bash
# Terminal 1 - Backend
cd backend
yarn start:dev

# Terminal 2 - Frontend
cd frontend
yarn dev
```

- Backend: http://localhost:4000/api
- Frontend: http://localhost:5173
- Swagger Docs: http://localhost:4000/api/docs

## 📁 Project Structure

```
cloud-storage-system/
├── backend/
│   └── src/
│       ├── auth/           # JWT auth, strategies, guards
│       ├── users/          # User management, quotas
│       ├── files/          # File operations, signed URLs
│       ├── google-drive/   # Google Drive API integration
│       ├── admin/          # Admin endpoints
│       └── feedback/       # Feedback system
├── frontend/
│   └── src/
│       ├── pages/          # Dashboard, Login, Register, Admin
│       ├── components/     # Reusable UI components
│       ├── services/       # API service layer
│       ├── contexts/       # Auth context
│       └── locales/        # i18n translations
```

## 🔒 Security Features

| Feature | Description |
|---------|-------------|
| JWT Tokens | Short-lived access (1h) + long-lived refresh (7d) |
| Signed URLs | HMAC-SHA256 signed, 5-minute expiry for file preview |
| Password Hashing | bcrypt with salt rounds |
| Rate Limiting | 100 requests per minute per IP |
| CORS | Configurable allowed origins |
| Helmet | Security headers enabled |

## 📝 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get tokens
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout

### Files
- `GET /api/files` - List user files
- `POST /api/files/upload/session` - Create resumable upload
- `POST /api/files/upload/complete` - Complete upload
- `GET /api/files/:id/signed-url` - Get signed URL for preview
- `GET /api/files/:id/signed-view` - View with signed URL (public)
- `GET /api/files/:id/download` - Download file
- `DELETE /api/files/:id` - Delete file

### Admin
- `GET /api/users` - List all users
- `PATCH /api/users/:id/status` - Update user status
- `PATCH /api/users/:id/quota` - Update user quota

## 🛠️ Tech Stack

**Backend:**
- NestJS 11, TypeScript
- MongoDB + Mongoose
- Passport + JWT
- Google APIs (googleapis)
- Swagger/OpenAPI

**Frontend:**
- React 19, TypeScript
- Vite 7
- TailwindCSS 4
- Zustand (state)
- React Router 7
- i18next

## 📄 License

MIT License

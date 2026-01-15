# CLAUDE.md - AI Assistant Guidelines

This file provides context for AI assistants (Claude, Copilot, etc.) working on this codebase.

## Project Overview

**THE BACKDRIVE** is a cloud storage system with:
- **Backend**: NestJS + MongoDB + Google Drive API
- **Frontend**: React + Vite + TailwindCSS
- **Storage**: Files stored in Google Drive, metadata in MongoDB

## Architecture

```
Frontend (React) → Backend (NestJS) → Google Drive API
                         ↓
                    MongoDB (metadata)
```

## Key Concepts

### Authentication Flow
1. User logs in → receives `accessToken` (1h) + `refreshToken` (7d)
2. Access token sent via `Authorization: Bearer` header
3. JWT strategy also extracts token from cookies and query params (`?token=`)

### File Upload (Resumable)
1. Frontend calls `POST /files/upload/session` → gets resumable URL
2. Frontend uploads directly to Google Drive
3. Frontend calls `POST /files/upload/complete` → saves metadata

### Signed URLs (Security)
- Used for file preview to avoid exposing JWT in URL
- Flow: `GET /files/:id/signed-url` → returns URL with HMAC signature
- Public endpoint `GET /files/:id/signed-view` validates signature
- Expires in 5 minutes

## Commands

```bash
# Backend
cd backend
yarn install
yarn start:dev      # Development with hot reload
yarn build          # Production build

# Frontend
cd frontend
yarn install
yarn dev            # Development server
yarn build          # Production build
```

## Important Files

| Path | Purpose |
|------|---------|
| `backend/src/auth/strategies/jwt.strategy.ts` | JWT validation, extracts token from header/cookie/query |
| `backend/src/files/signed-url.service.ts` | HMAC-SHA256 signed URL generation |
| `backend/src/files/signed-files.controller.ts` | Public signed file access endpoints |
| `backend/src/google-drive/google-drive.service.ts` | All Google Drive API interactions |
| `frontend/src/contexts/AuthContext.tsx` | Auth state management |
| `frontend/src/services/file.service.ts` | File API calls |
| `frontend/src/pages/Dashboard.tsx` | Main file management UI |

## Environment Variables

### Backend (.env)
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret for signing access tokens
- `JWT_REFRESH_SECRET` - Secret for refresh tokens
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` - Service account email
- `GOOGLE_SERVICE_ACCOUNT_KEY` - Private key (with \n for newlines)
- `GOOGLE_DRIVE_FOLDER_ID` - Root folder ID in Drive

### Frontend (.env)
- `VITE_API_URL` - Backend API URL (e.g., `http://localhost:4000/api`)

## Code Patterns

### Backend
- **Modules**: Each feature has module/controller/service
- **Guards**: `JwtAuthGuard` protects endpoints
- **DTOs**: Use `class-validator` for input validation
- **Swagger**: All endpoints documented with decorators

### Frontend
- **Services**: API calls centralized in `src/services/`
- **State**: Zustand for upload queue, React Context for auth
- **i18n**: Translations in `src/locales/{en,vi}.json`
- **Styling**: TailwindCSS with Neo-Brutalist design (thick borders, shadows)

## Common Tasks

### Adding a new API endpoint
1. Add method to controller with decorators
2. Add service method for business logic
3. Add frontend service function
4. Update component to use new endpoint

### Modifying auth behavior
- JWT extraction: `jwt.strategy.ts`
- Token generation: `auth.service.ts`
- Guards: `auth/guards/`

### Adding new file operations
- Backend: `files.service.ts` + `files.controller.ts`
- Google Drive: `google-drive.service.ts`
- Frontend: `file.service.ts` + `Dashboard.tsx`

## Debugging Tips

- Check browser DevTools Network tab for API errors
- Backend logs show in terminal (NestJS Logger)
- Google Drive errors often relate to permissions or quota
- JWT issues: verify token expiry, check `JWT_SECRET` matches

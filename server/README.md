# Talkio Server

## Setup

1. Copy `.env.example` to `.env` and fill in your MongoDB Atlas URI and JWT secret.
2. Run `npm install` in this folder.
3. Start the server: `npm run dev` (for development with nodemon) or `npm start`.

## API Endpoints

### Auth
- `POST /api/auth/register` `{ email, password }`
- `POST /api/auth/login` `{ email, password }` → `{ token, uuid, email }`

### Rooms
- `POST /api/rooms` `{ name, isPublic }` (auth required)
- `GET /api/rooms` (auth required)
- `POST /api/rooms/:roomUuid/add` `{ userUuid }` (auth required)

All room endpoints require `Authorization: Bearer <token>` header.

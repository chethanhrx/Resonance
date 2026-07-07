# PRD — Resonance (Hi-Res Music Streaming + Listening Parties)

## Original Problem Statement
Spotify-like app for high-resolution music. Admin-only song uploads. Email/mobile login & signup. Per-user data: listening history, liked songs, saved songs. Premium/calm/modern/sleek UI. Profiles with unique usernames. Friend system. Core feature: song parties — anyone can create a party, invite friends, listen together in sync; members can add/remove/reorder the queue.

## User Choices
- Admin panel + pre-seeded admin account; admin uploads real audio files
- JWT custom auth (email OR mobile + password, no OTP)
- Real-time party sync via WebSocket
- Design: designer's choice → dark luxury theme (#0A0A0E, lavender #C4B5FD, Outfit/Manrope, glassmorphism)

## Architecture
- Backend: FastAPI + Motor (MongoDB), JWT (PyJWT + bcrypt), file storage on disk (/app/backend/uploads), audio streaming with HTTP Range support, WebSocket at /api/ws/party/{id}?token=
- Frontend: React 19, react-router, axios, lucide-react, sonner; AuthContext + PlayerContext (singleton Audio element); PartyRoom has its own audio + WS
- Admin seeded on startup: admin@resonance.app / Admin@1234 (see /app/memory/test_credentials.md)

## Implemented (2026-06 / first release)
- [x] Auth: register (username, name, email or mobile, password), login by email/mobile/username, logout, /auth/me
- [x] Songs: admin upload (audio + cover, mutagen duration), delete, list/search, range streaming
- [x] Like / Save toggles, listening history (last 100), Library page (Liked/Saved/History tabs)
- [x] Profiles by username: liked/saved songs, counts, add-friend button
- [x] Friends: search users, send/accept/decline requests, friends list
- [x] Parties: create (6-char code), join by code, invite by username, list parties/invites
- [x] Real-time party sync (WS): play/pause/seek/track, queue add/remove/reorder, live chat, online members
- [x] Persistent bottom player (seek, volume, like/save, prev/next)
- [x] 3 demo tracks seeded with cover art
- Testing: iteration_1 — 100% backend + frontend pass

## Backlog
- P1: Playlists (user-created), artist/album pages, party host controls (kick, host-only playback)
- P1: Brute-force login lockout, password reset flow
- P2: Avatars/profile picture upload (object storage), drag-and-drop queue reorder, mobile PWA polish
- P2: Split server.py into routers; explicit CORS origins for production

## Next Tasks
- User feedback on first release; then playlists or party host controls

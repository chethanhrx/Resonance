# Resonance

Resonance is a full-stack music streaming and social listening platform.

## Features
- **Music Streaming**: Upload and stream Hi-Res audio.
- **Social**: Add friends, like/save songs.
- **Parties**: Create or join listening parties with real-time synchronized playback and chat (WebSockets).

## Tech Stack
- **Frontend**: React, TailwindCSS, React Router, Radix UI.
- **Backend**: FastAPI, MongoDB (Motor), WebSockets.

## Getting Started

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- MongoDB (running locally on port 27017 or update `.env`)

### Backend Setup
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file in the `backend` directory:
   ```env
   MONGO_URL=mongodb://localhost:27017
   DB_NAME=resonance_db
   JWT_SECRET=supersecret123
   CORS_ORIGINS=http://localhost:3000
   ```
5. Start the backend server:
   ```bash
   uvicorn server:app --reload --port 8000
   ```

### Frontend Setup
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm start
   ```

The app will be available at [http://localhost:3000](http://localhost:3000).

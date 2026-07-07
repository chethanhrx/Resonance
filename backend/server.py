from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import re
import jwt
import json
import time
import uuid
import bcrypt
import secrets
import string
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Annotated

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from pydantic import BaseModel, Field, BeforeValidator
from mutagen import File as MutagenFile

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

UPLOAD_DIR = ROOT_DIR / "uploads"
(UPLOAD_DIR / "songs").mkdir(parents=True, exist_ok=True)
(UPLOAD_DIR / "covers").mkdir(parents=True, exist_ok=True)

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]

PyObjectId = Annotated[str, BeforeValidator(str)]

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------- helpers ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def user_public(u: dict) -> dict:
    return {
        "id": str(u["_id"]),
        "username": u["username"],
        "name": u.get("name", ""),
        "email": u.get("email"),
        "mobile": u.get("mobile"),
        "role": u.get("role", "user"),
        "avatar_url": u.get("avatar_url"),
        "liked_song_ids": [str(x) for x in u.get("liked_song_ids", [])],
        "saved_song_ids": [str(x) for x in u.get("saved_song_ids", [])],
        "friend_ids": [str(x) for x in u.get("friend_ids", [])],
        "created_at": u.get("created_at"),
    }

def song_public(s: dict) -> dict:
    return {
        "id": str(s["_id"]),
        "title": s["title"],
        "artist": s["artist"],
        "album": s.get("album", ""),
        "genre": s.get("genre", ""),
        "duration": s.get("duration", 0),
        "cover_url": s.get("cover_url"),
        "quality": s.get("quality", "Hi-Res"),
        "created_at": s.get("created_at"),
    }

def decode_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload["sub"]
    except jwt.InvalidTokenError:
        return None

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = decode_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def get_admin_user(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

def set_auth_cookie(response: Response, token: str):
    response.set_cookie(key="access_token", value=token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")


# ---------- schemas ----------
class RegisterInput(BaseModel):
    username: str
    name: str
    password: str
    email: Optional[str] = None
    mobile: Optional[str] = None

class LoginInput(BaseModel):
    identifier: str
    password: str

class PartyCreate(BaseModel):
    name: str

class PartyJoin(BaseModel):
    code: str

class InviteInput(BaseModel):
    username: str

class FriendRequestInput(BaseModel):
    username: str


# ---------- auth ----------
@api_router.post("/auth/register")
async def register(data: RegisterInput, response: Response):
    username = data.username.strip().lower()
    if not re.match(r"^[a-z0-9_\.]{3,20}$", username):
        raise HTTPException(status_code=400, detail="Username must be 3-20 chars: letters, numbers, _ or .")
    if not data.email and not data.mobile:
        raise HTTPException(status_code=400, detail="Provide an email or mobile number")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if await db.users.find_one({"username": username}):
        raise HTTPException(status_code=400, detail="Username already taken")
    email = data.email.strip().lower() if data.email else None
    mobile = re.sub(r"[^\d+]", "", data.mobile) if data.mobile else None
    if email and await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    if mobile and await db.users.find_one({"mobile": mobile}):
        raise HTTPException(status_code=400, detail="Mobile number already registered")
    doc = {
        "username": username, "name": data.name.strip(), "email": email, "mobile": mobile,
        "password_hash": hash_password(data.password), "role": "user",
        "liked_song_ids": [], "saved_song_ids": [], "friend_ids": [], "history": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    token = create_access_token(str(result.inserted_id))
    set_auth_cookie(response, token)
    return {"user": user_public(doc), "token": token}

@api_router.post("/auth/login")
async def login(data: LoginInput, response: Response):
    ident = data.identifier.strip().lower()
    mobile = re.sub(r"[^\d+]", "", data.identifier)
    user = await db.users.find_one({"$or": [{"email": ident}, {"username": ident}, {"mobile": mobile if mobile else "___"}]})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(str(user["_id"]))
    set_auth_cookie(response, token)
    return {"user": user_public(user), "token": token}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user_public(user)


# ---------- songs ----------
@api_router.get("/songs")
async def list_songs(search: Optional[str] = None):
    query = {}
    if search:
        rx = {"$regex": re.escape(search), "$options": "i"}
        query = {"$or": [{"title": rx}, {"artist": rx}, {"album": rx}, {"genre": rx}]}
    songs = await db.songs.find(query).sort("created_at", -1).to_list(500)
    return [song_public(s) for s in songs]

@api_router.post("/songs")
async def upload_song(
    title: str = Form(...), artist: str = Form(...), album: str = Form(""),
    genre: str = Form(""), quality: str = Form("Hi-Res"),
    audio: UploadFile = File(...), cover: Optional[UploadFile] = File(None),
    admin: dict = Depends(get_admin_user),
):
    ext = Path(audio.filename or "track.mp3").suffix or ".mp3"
    fname = f"{uuid.uuid4().hex}{ext}"
    fpath = UPLOAD_DIR / "songs" / fname
    content = await audio.read()
    fpath.write_bytes(content)
    duration = 0
    try:
        mf = MutagenFile(str(fpath))
        if mf is not None and mf.info and mf.info.length:
            duration = round(mf.info.length)
    except Exception:
        pass
    cover_url = None
    if cover:
        cext = Path(cover.filename or "cover.jpg").suffix or ".jpg"
        cname = f"{uuid.uuid4().hex}{cext}"
        (UPLOAD_DIR / "covers" / cname).write_bytes(await cover.read())
        cover_url = f"/api/uploads/covers/{cname}"
    doc = {
        "title": title.strip(), "artist": artist.strip(), "album": album.strip(), "genre": genre.strip(),
        "quality": quality, "file_name": fname, "duration": duration, "cover_url": cover_url,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.songs.insert_one(doc)
    doc["_id"] = result.inserted_id
    return song_public(doc)

@api_router.delete("/songs/{song_id}")
async def delete_song(song_id: str, admin: dict = Depends(get_admin_user)):
    song = await db.songs.find_one({"_id": ObjectId(song_id)})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    try:
        (UPLOAD_DIR / "songs" / song["file_name"]).unlink(missing_ok=True)
    except Exception:
        pass
    await db.songs.delete_one({"_id": ObjectId(song_id)})
    return {"ok": True}

@api_router.get("/songs/{song_id}/stream")
async def stream_song(song_id: str, request: Request):
    song = await db.songs.find_one({"_id": ObjectId(song_id)})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    fpath = UPLOAD_DIR / "songs" / song["file_name"]
    if not fpath.exists():
        raise HTTPException(status_code=404, detail="Audio file missing")
    file_size = fpath.stat().st_size
    ctype = {"mp3": "audio/mpeg", "flac": "audio/flac", "wav": "audio/wav", "m4a": "audio/mp4", "ogg": "audio/ogg", "aac": "audio/aac"}.get(fpath.suffix.lstrip(".").lower(), "audio/mpeg")
    range_header = request.headers.get("range")
    start, end = 0, file_size - 1
    status_code = 200
    if range_header:
        m = re.match(r"bytes=(\d+)-(\d*)", range_header)
        if m:
            start = int(m.group(1))
            if m.group(2):
                end = int(m.group(2))
            status_code = 206

    def iter_file(s, e):
        with open(fpath, "rb") as f:
            f.seek(s)
            remaining = e - s + 1
            while remaining > 0:
                chunk = f.read(min(65536, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

    headers = {"Accept-Ranges": "bytes", "Content-Length": str(end - start + 1)}
    if status_code == 206:
        headers["Content-Range"] = f"bytes {start}-{end}/{file_size}"
    return StreamingResponse(iter_file(start, end), status_code=status_code, media_type=ctype, headers=headers)

@api_router.post("/songs/{song_id}/like")
async def toggle_like(song_id: str, user: dict = Depends(get_current_user)):
    liked = song_id in [str(x) for x in user.get("liked_song_ids", [])]
    op = "$pull" if liked else "$addToSet"
    await db.users.update_one({"_id": user["_id"]}, {op: {"liked_song_ids": song_id}})
    return {"liked": not liked}

@api_router.post("/songs/{song_id}/save")
async def toggle_save(song_id: str, user: dict = Depends(get_current_user)):
    saved = song_id in [str(x) for x in user.get("saved_song_ids", [])]
    op = "$pull" if saved else "$addToSet"
    await db.users.update_one({"_id": user["_id"]}, {op: {"saved_song_ids": song_id}})
    return {"saved": not saved}

@api_router.post("/songs/{song_id}/play")
async def record_play(song_id: str, user: dict = Depends(get_current_user)):
    entry = {"song_id": song_id, "played_at": datetime.now(timezone.utc).isoformat()}
    await db.users.update_one({"_id": user["_id"]}, {"$push": {"history": {"$each": [entry], "$position": 0, "$slice": 100}}})
    return {"ok": True}


async def songs_by_ids(ids: List[str]) -> List[dict]:
    oids = [ObjectId(i) for i in ids if ObjectId.is_valid(i)]
    songs = await db.songs.find({"_id": {"$in": oids}}).to_list(500)
    smap = {str(s["_id"]): song_public(s) for s in songs}
    return [smap[i] for i in ids if i in smap]

@api_router.get("/me/liked")
async def my_liked(user: dict = Depends(get_current_user)):
    return await songs_by_ids([str(x) for x in user.get("liked_song_ids", [])])

@api_router.get("/me/saved")
async def my_saved(user: dict = Depends(get_current_user)):
    return await songs_by_ids([str(x) for x in user.get("saved_song_ids", [])])

@api_router.get("/me/history")
async def my_history(user: dict = Depends(get_current_user)):
    hist = user.get("history", [])
    songs = await songs_by_ids([h["song_id"] for h in hist])
    smap = {s["id"]: s for s in songs}
    return [{**smap[h["song_id"]], "played_at": h["played_at"]} for h in hist if h["song_id"] in smap]


# ---------- users & friends ----------
@api_router.get("/users/search")
async def search_users(q: str, user: dict = Depends(get_current_user)):
    rx = {"$regex": re.escape(q), "$options": "i"}
    users = await db.users.find({"$or": [{"username": rx}, {"name": rx}], "_id": {"$ne": user["_id"]}}).to_list(20)
    return [user_public(u) for u in users]

@api_router.get("/users/{username}")
async def get_profile(username: str, user: dict = Depends(get_current_user)):
    target = await db.users.find_one({"username": username.lower()})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    profile = user_public(target)
    profile["liked_songs"] = await songs_by_ids(profile["liked_song_ids"])
    profile["saved_songs"] = await songs_by_ids(profile["saved_song_ids"])
    pending = await db.friend_requests.find_one({
        "status": "pending",
        "$or": [
            {"from_id": str(user["_id"]), "to_id": profile["id"]},
            {"from_id": profile["id"], "to_id": str(user["_id"])},
        ]})
    profile["is_friend"] = profile["id"] in [str(x) for x in user.get("friend_ids", [])]
    profile["request_pending"] = bool(pending)
    return profile

@api_router.post("/friends/request")
async def send_friend_request(data: FriendRequestInput, user: dict = Depends(get_current_user)):
    target = await db.users.find_one({"username": data.username.lower()})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    tid = str(target["_id"])
    uid = str(user["_id"])
    if tid == uid:
        raise HTTPException(status_code=400, detail="Cannot add yourself")
    if tid in [str(x) for x in user.get("friend_ids", [])]:
        raise HTTPException(status_code=400, detail="Already friends")
    existing = await db.friend_requests.find_one({"status": "pending", "$or": [{"from_id": uid, "to_id": tid}, {"from_id": tid, "to_id": uid}]})
    if existing:
        raise HTTPException(status_code=400, detail="Request already pending")
    await db.friend_requests.insert_one({"from_id": uid, "to_id": tid, "status": "pending", "created_at": datetime.now(timezone.utc).isoformat()})
    return {"ok": True}

@api_router.get("/friends/requests")
async def list_requests(user: dict = Depends(get_current_user)):
    reqs = await db.friend_requests.find({"to_id": str(user["_id"]), "status": "pending"}).to_list(100)
    out = []
    for r in reqs:
        sender = await db.users.find_one({"_id": ObjectId(r["from_id"])})
        if sender:
            out.append({"id": str(r["_id"]), "from": user_public(sender), "created_at": r["created_at"]})
    return out

@api_router.post("/friends/requests/{req_id}/{action}")
async def respond_request(req_id: str, action: str, user: dict = Depends(get_current_user)):
    if action not in ("accept", "decline"):
        raise HTTPException(status_code=400, detail="Invalid action")
    req = await db.friend_requests.find_one({"_id": ObjectId(req_id), "to_id": str(user["_id"]), "status": "pending"})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    await db.friend_requests.update_one({"_id": req["_id"]}, {"$set": {"status": action + "ed"}})
    if action == "accept":
        await db.users.update_one({"_id": user["_id"]}, {"$addToSet": {"friend_ids": req["from_id"]}})
        await db.users.update_one({"_id": ObjectId(req["from_id"])}, {"$addToSet": {"friend_ids": str(user["_id"])}})
    return {"ok": True}

@api_router.get("/friends")
async def list_friends(user: dict = Depends(get_current_user)):
    ids = [ObjectId(x) for x in user.get("friend_ids", []) if ObjectId.is_valid(x)]
    friends = await db.users.find({"_id": {"$in": ids}}).to_list(200)
    return [user_public(f) for f in friends]


# ---------- parties ----------
def party_public(p: dict) -> dict:
    return {
        "id": str(p["_id"]), "name": p["name"], "code": p["code"], "host_id": p["host_id"],
        "member_ids": p.get("member_ids", []), "invited_ids": p.get("invited_ids", []),
        "queue": p.get("queue", []), "current_index": p.get("current_index", 0),
        "is_playing": p.get("is_playing", False), "position": p.get("position", 0.0),
        "position_updated_at": p.get("position_updated_at", 0.0),
        "created_at": p.get("created_at"),
    }

def effective_position(p: dict) -> float:
    pos = p.get("position", 0.0)
    if p.get("is_playing"):
        pos += time.time() - p.get("position_updated_at", time.time())
    return pos

@api_router.post("/parties")
async def create_party(data: PartyCreate, user: dict = Depends(get_current_user)):
    code = "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
    doc = {
        "name": data.name.strip(), "code": code, "host_id": str(user["_id"]),
        "member_ids": [str(user["_id"])], "invited_ids": [], "queue": [],
        "current_index": 0, "is_playing": False, "position": 0.0, "position_updated_at": time.time(),
        "active": True, "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.parties.insert_one(doc)
    doc["_id"] = result.inserted_id
    return party_public(doc)

@api_router.get("/parties")
async def list_parties(user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    parties = await db.parties.find({"active": True, "$or": [{"member_ids": uid}, {"invited_ids": uid}]}).sort("created_at", -1).to_list(50)
    out = []
    for p in parties:
        pub = party_public(p)
        host = await db.users.find_one({"_id": ObjectId(p["host_id"])})
        pub["host_username"] = host["username"] if host else "?"
        pub["is_invited"] = uid in p.get("invited_ids", []) and uid not in p.get("member_ids", [])
        out.append(pub)
    return out

@api_router.post("/parties/join")
async def join_party(data: PartyJoin, user: dict = Depends(get_current_user)):
    party = await db.parties.find_one({"code": data.code.strip().upper(), "active": True})
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")
    uid = str(user["_id"])
    await db.parties.update_one({"_id": party["_id"]}, {"$addToSet": {"member_ids": uid}, "$pull": {"invited_ids": uid}})
    return {"id": str(party["_id"])}

@api_router.get("/parties/{party_id}")
async def get_party(party_id: str, user: dict = Depends(get_current_user)):
    party = await db.parties.find_one({"_id": ObjectId(party_id)})
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")
    uid = str(user["_id"])
    if uid not in party.get("member_ids", []):
        await db.parties.update_one({"_id": party["_id"]}, {"$addToSet": {"member_ids": uid}, "$pull": {"invited_ids": uid}})
        party["member_ids"] = party.get("member_ids", []) + [uid]
    pub = party_public(party)
    pub["position"] = effective_position(party)
    members = await db.users.find({"_id": {"$in": [ObjectId(m) for m in pub["member_ids"] if ObjectId.is_valid(m)]}}).to_list(100)
    pub["members"] = [user_public(m) for m in members]
    return pub

@api_router.post("/parties/{party_id}/invite")
async def invite_to_party(party_id: str, data: InviteInput, user: dict = Depends(get_current_user)):
    party = await db.parties.find_one({"_id": ObjectId(party_id)})
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")
    target = await db.users.find_one({"username": data.username.lower()})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    tid = str(target["_id"])
    if tid in party.get("member_ids", []):
        raise HTTPException(status_code=400, detail="Already in party")
    await db.parties.update_one({"_id": party["_id"]}, {"$addToSet": {"invited_ids": tid}})
    return {"ok": True}

@api_router.post("/parties/{party_id}/leave")
async def leave_party(party_id: str, user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    await db.parties.update_one({"_id": ObjectId(party_id)}, {"$pull": {"member_ids": uid}})
    party = await db.parties.find_one({"_id": ObjectId(party_id)})
    if party and not party.get("member_ids"):
        await db.parties.update_one({"_id": party["_id"]}, {"$set": {"active": False}})
    return {"ok": True}


# ---------- party websocket ----------
class PartyConnections:
    def __init__(self):
        self.rooms: dict = {}

    async def connect(self, party_id: str, ws: WebSocket, user: dict):
        await ws.accept()
        self.rooms.setdefault(party_id, []).append((ws, user))

    def disconnect(self, party_id: str, ws: WebSocket):
        room = self.rooms.get(party_id, [])
        self.rooms[party_id] = [(w, u) for (w, u) in room if w is not ws]

    async def broadcast(self, party_id: str, message: dict):
        for (w, _) in list(self.rooms.get(party_id, [])):
            try:
                await w.send_text(json.dumps(message))
            except Exception:
                pass

    def online_users(self, party_id: str):
        seen, out = set(), []
        for (_, u) in self.rooms.get(party_id, []):
            uid = str(u["_id"])
            if uid not in seen:
                seen.add(uid)
                out.append({"id": uid, "username": u["username"], "name": u.get("name", "")})
        return out

manager = PartyConnections()

async def party_state_message(party_id: str) -> dict:
    party = await db.parties.find_one({"_id": ObjectId(party_id)})
    pub = party_public(party)
    pub["position"] = effective_position(party)
    return {"type": "state", "party": pub, "online": manager.online_users(party_id)}

@app.websocket("/api/ws/party/{party_id}")
async def party_ws(websocket: WebSocket, party_id: str, token: str = ""):
    user_id = decode_token(token)
    if not user_id:
        await websocket.close(code=4001)
        return
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    party = await db.parties.find_one({"_id": ObjectId(party_id)})
    if not user or not party:
        await websocket.close(code=4004)
        return
    await manager.connect(party_id, websocket, user)
    await manager.broadcast(party_id, await party_state_message(party_id))
    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            mtype = msg.get("type")
            now = time.time()
            oid = ObjectId(party_id)
            if mtype == "play":
                await db.parties.update_one({"_id": oid}, {"$set": {"is_playing": True, "position": float(msg.get("position", 0)), "position_updated_at": now}})
            elif mtype == "pause":
                await db.parties.update_one({"_id": oid}, {"$set": {"is_playing": False, "position": float(msg.get("position", 0)), "position_updated_at": now}})
            elif mtype == "seek":
                await db.parties.update_one({"_id": oid}, {"$set": {"position": float(msg.get("position", 0)), "position_updated_at": now}})
            elif mtype == "track":
                await db.parties.update_one({"_id": oid}, {"$set": {"current_index": int(msg.get("index", 0)), "position": 0.0, "is_playing": True, "position_updated_at": now}})
            elif mtype == "queue_add":
                song = await db.songs.find_one({"_id": ObjectId(msg["song_id"])})
                if song:
                    await db.parties.update_one({"_id": oid}, {"$push": {"queue": song_public(song)}})
            elif mtype == "queue_remove":
                p = await db.parties.find_one({"_id": oid})
                q = p.get("queue", [])
                idx = int(msg.get("index", -1))
                if 0 <= idx < len(q):
                    q.pop(idx)
                    ci = p.get("current_index", 0)
                    if idx < ci:
                        ci -= 1
                    ci = max(0, min(ci, max(len(q) - 1, 0)))
                    await db.parties.update_one({"_id": oid}, {"$set": {"queue": q, "current_index": ci}})
            elif mtype == "queue_move":
                p = await db.parties.find_one({"_id": oid})
                q = p.get("queue", [])
                f, t = int(msg.get("from", -1)), int(msg.get("to", -1))
                if 0 <= f < len(q) and 0 <= t < len(q):
                    item = q.pop(f)
                    q.insert(t, item)
                    ci = p.get("current_index", 0)
                    if f == ci:
                        ci = t
                    elif f < ci <= t:
                        ci -= 1
                    elif t <= ci < f:
                        ci += 1
                    await db.parties.update_one({"_id": oid}, {"$set": {"queue": q, "current_index": ci}})
            elif mtype == "chat":
                await manager.broadcast(party_id, {"type": "chat", "from": user["username"], "text": str(msg.get("text", ""))[:500], "at": datetime.now(timezone.utc).isoformat()})
                continue
            await manager.broadcast(party_id, await party_state_message(party_id))
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(party_id, websocket)
        await manager.broadcast(party_id, await party_state_message(party_id))


# ---------- startup ----------
@app.on_event("startup")
async def startup():
    await db.users.create_index("username", unique=True)
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@resonance.app")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@1234")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "username": "admin", "name": "Admin", "email": admin_email, "mobile": None,
            "password_hash": hash_password(admin_password), "role": "admin",
            "liked_song_ids": [], "saved_song_ids": [], "friend_ids": [], "history": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

app.include_router(api_router)
app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

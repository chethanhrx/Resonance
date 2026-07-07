"""Backend API tests for Resonance music streaming app."""
import os
import io
import re
import time
import wave
import struct
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://audio-lounge-59.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_ID = "admin@resonance.app"
ADMIN_PW = "Admin@1234"

# Unique test users
STAMP = uuid.uuid4().hex[:6]
USER_A = {"username": f"tuser_a_{STAMP}", "name": "Test A", "email": f"tuser_a_{STAMP}@example.com", "password": "TestPass1"}
USER_B = {"username": f"tuser_b_{STAMP}", "name": "Test B", "mobile": f"+1555000{STAMP[:4]}", "password": "TestPass1"}


def _client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token():
    r = _client().post(f"{API}/auth/login", json={"identifier": ADMIN_ID, "password": ADMIN_PW})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def user_a_token():
    r = _client().post(f"{API}/auth/register", json=USER_A)
    if r.status_code == 400 and "taken" in r.text.lower():
        r = _client().post(f"{API}/auth/login", json={"identifier": USER_A["email"], "password": USER_A["password"]})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def user_b_token():
    r = _client().post(f"{API}/auth/register", json=USER_B)
    if r.status_code == 400 and "taken" in r.text.lower():
        r = _client().post(f"{API}/auth/login", json={"identifier": USER_B["mobile"], "password": USER_B["password"]})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _auth(token):
    s = _client()
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# ---------- Auth ----------
class TestAuth:
    def test_me_unauth_401(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_register_and_me(self, user_a_token):
        r = _auth(user_a_token).get(f"{API}/auth/me")
        assert r.status_code == 200
        data = r.json()
        assert data["username"] == USER_A["username"]
        assert data["email"] == USER_A["email"].lower()

    def test_duplicate_username_400(self, user_a_token):
        payload = {**USER_A, "email": f"other_{STAMP}@example.com"}
        r = _client().post(f"{API}/auth/register", json=payload)
        assert r.status_code == 400
        assert "taken" in r.json()["detail"].lower() or "already" in r.json()["detail"].lower()

    def test_login_by_mobile(self, user_b_token):
        r = _client().post(f"{API}/auth/login", json={"identifier": USER_B["mobile"], "password": USER_B["password"]})
        assert r.status_code == 200
        assert r.json()["user"]["username"] == USER_B["username"]

    def test_login_by_username(self):
        r = _client().post(f"{API}/auth/login", json={"identifier": USER_A["username"], "password": USER_A["password"]})
        assert r.status_code == 200

    def test_admin_login(self, admin_token):
        r = _auth(admin_token).get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_login_invalid_credentials(self):
        r = _client().post(f"{API}/auth/login", json={"identifier": ADMIN_ID, "password": "wrongwrong"})
        assert r.status_code == 401


# ---------- Songs ----------
class TestSongs:
    def test_list_seeded_songs(self):
        r = requests.get(f"{API}/songs")
        assert r.status_code == 200
        titles = {s["title"] for s in r.json()}
        assert {"Midnight Bloom", "Velvet Horizon", "Glass Gardens"}.issubset(titles)

    def test_search_songs(self):
        r = requests.get(f"{API}/songs", params={"search": "Midnight"})
        assert r.status_code == 200
        assert any("Midnight" in s["title"] for s in r.json())

    def test_stream_full_and_range(self):
        songs = requests.get(f"{API}/songs").json()
        sid = songs[0]["id"]
        r = requests.get(f"{API}/songs/{sid}/stream", stream=True)
        assert r.status_code == 200
        assert r.headers.get("Accept-Ranges") == "bytes"
        r2 = requests.get(f"{API}/songs/{sid}/stream", headers={"Range": "bytes=0-1023"})
        assert r2.status_code == 206
        assert "Content-Range" in r2.headers

    def test_like_save_toggle(self, user_a_token):
        songs = requests.get(f"{API}/songs").json()
        sid = songs[0]["id"]
        c = _auth(user_a_token)
        r1 = c.post(f"{API}/songs/{sid}/like")
        assert r1.status_code == 200
        assert r1.json()["liked"] is True
        # Verify persistence via /me/liked
        liked = c.get(f"{API}/me/liked").json()
        assert any(s["id"] == sid for s in liked)
        # Save
        r2 = c.post(f"{API}/songs/{sid}/save")
        assert r2.json()["saved"] is True
        saved = c.get(f"{API}/me/saved").json()
        assert any(s["id"] == sid for s in saved)
        # Play - history
        rp = c.post(f"{API}/songs/{sid}/play")
        assert rp.status_code == 200
        hist = c.get(f"{API}/me/history").json()
        assert any(s["id"] == sid for s in hist)

    def test_non_admin_upload_403(self, user_a_token):
        files = {"audio": ("t.mp3", b"fake", "audio/mpeg")}
        data = {"title": "x", "artist": "x"}
        r = requests.post(f"{API}/songs", data=data, files=files,
                          headers={"Authorization": f"Bearer {user_a_token}"})
        assert r.status_code == 403


# ---------- Admin upload & delete ----------
def _tiny_wav_bytes():
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(8000)
        w.writeframes(b"".join(struct.pack("<h", 0) for _ in range(800)))
    return buf.getvalue()


class TestAdmin:
    def test_admin_upload_and_delete(self, admin_token):
        wav = _tiny_wav_bytes()
        files = {"audio": (f"test_{STAMP}.wav", wav, "audio/wav")}
        data = {"title": f"TEST_Song_{STAMP}", "artist": "TestArtist", "album": "TA", "genre": "Test"}
        r = requests.post(f"{API}/songs", data=data, files=files,
                          headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, r.text
        song = r.json()
        assert song["title"] == data["title"]
        sid = song["id"]

        # Verify appears in listing
        listing = requests.get(f"{API}/songs").json()
        assert any(s["id"] == sid for s in listing)

        # Stream new song
        rs = requests.get(f"{API}/songs/{sid}/stream")
        assert rs.status_code == 200

        # Delete
        rd = requests.delete(f"{API}/songs/{sid}",
                             headers={"Authorization": f"Bearer {admin_token}"})
        assert rd.status_code == 200

        # Verify gone
        after = requests.get(f"{API}/songs").json()
        assert not any(s["id"] == sid for s in after)


# ---------- Friends ----------
class TestFriends:
    def test_friend_flow(self, user_a_token, user_b_token):
        ca = _auth(user_a_token)
        cb = _auth(user_b_token)
        # A searches for B
        res = ca.get(f"{API}/users/search", params={"q": USER_B["username"][:8]}).json()
        assert any(u["username"] == USER_B["username"] for u in res)
        # A sends friend request to B
        r = ca.post(f"{API}/friends/request", json={"username": USER_B["username"]})
        assert r.status_code in (200, 400)  # 400 if already friends from prior run
        # B lists requests
        reqs = cb.get(f"{API}/friends/requests").json()
        # find request from A
        target = next((x for x in reqs if x["from"]["username"] == USER_A["username"]), None)
        if target:
            ra = cb.post(f"{API}/friends/requests/{target['id']}/accept")
            assert ra.status_code == 200
        # Both should list each other as friends
        fa = ca.get(f"{API}/friends").json()
        fb = cb.get(f"{API}/friends").json()
        assert any(u["username"] == USER_B["username"] for u in fa)
        assert any(u["username"] == USER_A["username"] for u in fb)
        # Profile page shows is_friend
        prof = ca.get(f"{API}/users/{USER_B['username']}").json()
        assert prof["is_friend"] is True
        assert "liked_songs" in prof and "saved_songs" in prof


# ---------- Parties ----------
class TestParties:
    def test_party_create_join(self, user_a_token, user_b_token):
        ca = _auth(user_a_token)
        cb = _auth(user_b_token)
        # A creates party
        r = ca.post(f"{API}/parties", json={"name": f"TEST_Party_{STAMP}"})
        assert r.status_code == 200, r.text
        party = r.json()
        assert len(party["code"]) == 6
        pid = party["id"]
        code = party["code"]
        # B joins by code
        rj = cb.post(f"{API}/parties/join", json={"code": code})
        assert rj.status_code == 200
        assert rj.json()["id"] == pid
        # Get party as B - should include both members
        rp = cb.get(f"{API}/parties/{pid}").json()
        member_usernames = {m["username"] for m in rp["members"]}
        assert USER_A["username"] in member_usernames
        assert USER_B["username"] in member_usernames
        # Invite by username
        # Re-invite A (already member) should fail
        ri = ca.post(f"{API}/parties/{pid}/invite", json={"username": USER_B["username"]})
        assert ri.status_code == 400  # B already in party


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

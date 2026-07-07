"""WebSocket sync test for parties."""
import asyncio
import json
import os
import uuid
import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://audio-lounge-59.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws/party"


def login(identifier, password):
    r = requests.post(f"{API}/auth/login", json={"identifier": identifier, "password": password})
    r.raise_for_status()
    return r.json()["token"]


def register_or_login(payload):
    r = requests.post(f"{API}/auth/register", json=payload)
    if r.status_code == 200:
        return r.json()["token"]
    ident = payload.get("email") or payload.get("mobile")
    return login(ident, payload["password"])


async def test_ws_sync():
    stamp = uuid.uuid4().hex[:6]
    ua = register_or_login({"username": f"wsua_{stamp}", "name": "WSA", "email": f"wsa_{stamp}@x.com", "password": "TestPass1"})
    ub = register_or_login({"username": f"wsub_{stamp}", "name": "WSB", "email": f"wsb_{stamp}@x.com", "password": "TestPass1"})

    # A creates party
    r = requests.post(f"{API}/parties", json={"name": f"WS_{stamp}"},
                      headers={"Authorization": f"Bearer {ua}"})
    party = r.json()
    pid = party["id"]
    code = party["code"]
    # B joins via code
    requests.post(f"{API}/parties/join", json={"code": code},
                  headers={"Authorization": f"Bearer {ub}"}).raise_for_status()

    # get a song id
    songs = requests.get(f"{API}/songs").json()
    sid = songs[0]["id"]

    url_a = f"{WS_BASE}/{pid}?token={ua}"
    url_b = f"{WS_BASE}/{pid}?token={ub}"

    results = {"initial_state_a": False, "initial_state_b": False,
               "b_saw_queue_add": False, "b_saw_play": False, "b_saw_chat": False}

    async with websockets.connect(url_a) as wa, websockets.connect(url_b) as wb:
        # both receive initial state broadcasts
        m1 = json.loads(await asyncio.wait_for(wa.recv(), timeout=5))
        m2 = json.loads(await asyncio.wait_for(wb.recv(), timeout=5))
        results["initial_state_a"] = m1.get("type") == "state"
        results["initial_state_b"] = m2.get("type") == "state"

        # drain a extra states
        async def drain(ws, timeout=1.0):
            msgs = []
            try:
                while True:
                    msgs.append(json.loads(await asyncio.wait_for(ws.recv(), timeout=timeout)))
            except asyncio.TimeoutError:
                pass
            return msgs

        await drain(wa, 0.5)
        await drain(wb, 0.5)

        # A adds song
        await wa.send(json.dumps({"type": "queue_add", "song_id": sid}))
        msgs_b = await drain(wb, 2.0)
        for m in msgs_b:
            if m.get("type") == "state" and len(m.get("party", {}).get("queue", [])) >= 1:
                results["b_saw_queue_add"] = True

        # A sends play
        await drain(wa, 0.3)
        await wa.send(json.dumps({"type": "play", "position": 0.0}))
        msgs_b = await drain(wb, 2.0)
        for m in msgs_b:
            if m.get("type") == "state" and m.get("party", {}).get("is_playing"):
                results["b_saw_play"] = True

        # Chat
        await drain(wa, 0.3)
        await wa.send(json.dumps({"type": "chat", "text": "hello B"}))
        msgs_b = await drain(wb, 2.0)
        for m in msgs_b:
            if m.get("type") == "chat" and m.get("text") == "hello B":
                results["b_saw_chat"] = True

    print("Results:", results)
    assert all(results.values()), f"Some WS syncs failed: {results}"


if __name__ == "__main__":
    asyncio.run(test_ws_sync())
    print("WS sync test PASSED")

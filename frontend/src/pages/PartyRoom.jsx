import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Play, Pause, SkipForward, SkipBack, Plus, Trash2, ChevronUp, ChevronDown, Send, UserPlus, ArrowLeft, Copy, X } from "lucide-react";
import { toast } from "sonner";
import api, { API, BACKEND_URL, errText, fmtTime } from "../lib/api";
import { usePlayer } from "../context/PlayerContext";
import SongCover from "../components/SongCover";

export default function PartyRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { suspend, resume } = usePlayer();
  const [party, setParty] = useState(null);
  const [online, setOnline] = useState([]);
  const [chat, setChat] = useState([]);
  const [chatText, setChatText] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [allSongs, setAllSongs] = useState([]);
  const [songSearch, setSongSearch] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [time, setTime] = useState(0);
  const audioRef = useRef(new Audio());
  const wsRef = useRef(null);
  const partyRef = useRef(null);
  partyRef.current = party;

  const send = useCallback((msg) => {
    if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify(msg));
  }, []);

  const applyState = useCallback((p) => {
    setParty(p);
    const a = audioRef.current;
    const song = p.queue[p.current_index];
    if (!song) { a.pause(); a.removeAttribute("src"); return; }
    const src = `${API}/songs/${song.id}/stream`;
    if (!a.src || !a.src.includes(song.id)) {
      a.src = src;
      a.currentTime = p.position || 0;
    } else if (Math.abs(a.currentTime - p.position) > 2) {
      a.currentTime = p.position;
    }
    if (p.is_playing) a.play().catch(() => {});
    else a.pause();
  }, []);

  useEffect(() => {
    suspend();
    api.get(`/parties/${id}`).then(({ data }) => applyState(data)).catch((e) => { toast.error(errText(e)); navigate("/parties"); });

    const token = localStorage.getItem("token");
    const wsUrl = `${BACKEND_URL.replace(/^http/, "ws")}/api/ws/party/${id}?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === "state") { applyState(msg.party); setOnline(msg.online); }
      if (msg.type === "chat") setChat((c) => [...c.slice(-100), msg]);
    };

    const a = audioRef.current;
    const onTime = () => setTime(a.currentTime);
    const onEnd = () => {
      const p = partyRef.current;
      if (p && p.current_index + 1 < p.queue.length) send({ type: "track", index: p.current_index + 1 });
      else send({ type: "pause", position: 0 });
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);

    return () => {
      ws.close();
      a.pause();
      a.removeAttribute("src");
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
      resume();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!showAdd) return;
    const t = setTimeout(() => api.get("/songs", { params: songSearch ? { search: songSearch } : {} }).then(({ data }) => setAllSongs(data)), 200);
    return () => clearTimeout(t);
  }, [showAdd, songSearch]);

  if (!party) return <div className="p-10 text-slate-400 text-sm">Joining party...</div>;

  const current = party.queue[party.current_index];
  const playing = party.is_playing;

  const togglePlay = () => {
    if (!current) return;
    send({ type: playing ? "pause" : "play", position: audioRef.current.currentTime });
  };

  const invite = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/parties/${id}/invite`, { username: inviteName });
      toast.success(`Invited @${inviteName}`);
      setInviteName("");
    } catch (e2) { toast.error(errText(e2)); }
  };

  const sendChat = (e) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    send({ type: "chat", text: chatText });
    setChatText("");
  };

  return (
    <div className="px-6 md:px-10 py-8 max-w-7xl">
      <div className="flex items-center gap-4 flex-wrap">
        <button data-testid="party-back-btn" onClick={() => navigate("/parties")} className="p-2 rounded-full hover:bg-white/10 transition-colors"><ArrowLeft size={18} /></button>
        <h1 className="font-heading text-2xl font-medium tracking-tight flex-1">{party.name}</h1>
        <button data-testid="party-copy-code" onClick={() => { navigator.clipboard.writeText(party.code); toast("Code copied"); }}
          className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 text-sm text-slate-300 hover:bg-white/5 transition-colors">
          <Copy size={13} /> {party.code}
        </button>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-8 mt-8">
        {/* Main stage */}
        <div>
          <div className="glass rounded-3xl p-8 flex flex-col items-center glow-active">
            <div className={`w-56 h-56 rounded-full overflow-hidden border-4 border-white/10 ${playing ? "animate-spin-slow" : ""}`}>
              <SongCover song={current || {}} className="w-full h-full" />
            </div>
            <h2 data-testid="party-current-title" className="font-heading text-2xl font-medium mt-6 text-center">{current ? current.title : "Queue is empty"}</h2>
            <p className="text-slate-400 text-sm mt-1">{current ? current.artist : "Add a song to get the party started"}</p>
            {current && (
              <div className="w-full max-w-md mt-5">
                <input data-testid="party-seek" type="range" min={0} max={current.duration || 0} value={time}
                  onChange={(e) => { audioRef.current.currentTime = +e.target.value; send({ type: "seek", position: +e.target.value }); }}
                  className="w-full h-1 accent-[#C4B5FD]" />
                <div className="flex justify-between text-xs text-slate-500 mt-1"><span>{fmtTime(time)}</span><span>{fmtTime(current.duration)}</span></div>
              </div>
            )}
            <div className="flex items-center gap-5 mt-5">
              <button data-testid="party-prev" onClick={() => party.current_index > 0 && send({ type: "track", index: party.current_index - 1 })}
                className="text-slate-300 hover:text-white transition-colors"><SkipBack size={22} /></button>
              <button data-testid="party-toggle" onClick={togglePlay}
                className="w-14 h-14 rounded-full bg-[#C4B5FD] text-[#0A0A0E] flex items-center justify-center hover:bg-[#d4c9fe] transition-colors">
                {playing ? <Pause size={22} /> : <Play size={22} className="ml-1" />}
              </button>
              <button data-testid="party-next" onClick={() => party.current_index + 1 < party.queue.length && send({ type: "track", index: party.current_index + 1 })}
                className="text-slate-300 hover:text-white transition-colors"><SkipForward size={22} /></button>
            </div>
          </div>

          {/* Queue */}
          <div className="glass rounded-3xl p-6 mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-medium">Shared queue</h3>
              <button data-testid="party-add-song-btn" onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-sm transition-colors">
                <Plus size={14} /> Add song
              </button>
            </div>
            {party.queue.length === 0 && <p data-testid="party-queue-empty" className="text-sm text-slate-400 py-6 text-center">Queue is empty.</p>}
            <div className="space-y-1">
              {party.queue.map((s, i) => (
                <div key={`${s.id}-${i}`} data-testid={`party-queue-item-${i}`}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${i === party.current_index ? "bg-white/10" : "hover:bg-white/5"}`}>
                  <button className="flex-1 min-w-0 flex items-center gap-3 text-left" onClick={() => send({ type: "track", index: i })} data-testid={`party-queue-play-${i}`}>
                    <SongCover song={s} className="w-9 h-9 rounded-lg" />
                    <span className={`text-sm truncate ${i === party.current_index ? "text-[#C4B5FD]" : ""}`}>{s.title} <span className="text-slate-500">· {s.artist}</span></span>
                  </button>
                  <button data-testid={`party-queue-up-${i}`} disabled={i === 0} onClick={() => send({ type: "queue_move", from: i, to: i - 1 })}
                    className="text-slate-500 hover:text-white disabled:opacity-20"><ChevronUp size={16} /></button>
                  <button data-testid={`party-queue-down-${i}`} disabled={i === party.queue.length - 1} onClick={() => send({ type: "queue_move", from: i, to: i + 1 })}
                    className="text-slate-500 hover:text-white disabled:opacity-20"><ChevronDown size={16} /></button>
                  <button data-testid={`party-queue-remove-${i}`} onClick={() => send({ type: "queue_remove", index: i })}
                    className="text-slate-500 hover:text-red-400"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="glass rounded-3xl p-6">
            <h3 className="font-heading font-medium mb-3">In the room <span className="text-[#C4B5FD]">({online.length})</span></h3>
            <div className="space-y-2">
              {online.map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#C4B5FD]/20 flex items-center justify-center text-xs text-[#C4B5FD]">{m.username[0].toUpperCase()}</div>
                  <span className="text-sm">@{m.username}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-auto" />
                </div>
              ))}
            </div>
            <form onSubmit={invite} className="mt-4 flex gap-2">
              <input data-testid="party-invite-input" value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Invite by username"
                className="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-slate-500 focus:outline-none focus:border-[#C4B5FD]/50" />
              <button data-testid="party-invite-btn" type="submit" className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 transition-colors"><UserPlus size={16} /></button>
            </form>
          </div>

          <div className="glass rounded-3xl p-6 flex flex-col h-96">
            <h3 className="font-heading font-medium mb-3">Party chat</h3>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {chat.length === 0 && <p className="text-xs text-slate-500">Say something...</p>}
              {chat.map((c, i) => (
                <div key={i} className="text-sm"><span className="text-[#C4B5FD]">@{c.from}</span> <span className="text-slate-300">{c.text}</span></div>
              ))}
            </div>
            <form onSubmit={sendChat} className="mt-3 flex gap-2">
              <input data-testid="party-chat-input" value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="Message"
                className="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-slate-500 focus:outline-none focus:border-[#C4B5FD]/50" />
              <button data-testid="party-chat-send" type="submit" className="p-2.5 rounded-xl bg-[#C4B5FD] text-[#0A0A0E] hover:bg-[#d4c9fe] transition-colors"><Send size={16} /></button>
            </form>
          </div>
        </div>
      </div>

      {/* Add song modal */}
      {showAdd && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="glass rounded-3xl w-full max-w-lg max-h-[70vh] flex flex-col bg-[#12121A]" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-white/5 flex items-center gap-3">
              <input data-testid="party-song-search" autoFocus value={songSearch} onChange={(e) => setSongSearch(e.target.value)} placeholder="Search songs..."
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-slate-500 focus:outline-none focus:border-[#C4B5FD]/50" />
              <button data-testid="party-add-close" onClick={() => setShowAdd(false)} className="p-2 rounded-full hover:bg-white/10"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto p-3 space-y-1">
              {allSongs.map((s) => (
                <button key={s.id} data-testid={`party-add-song-${s.id}`}
                  onClick={() => { send({ type: "queue_add", song_id: s.id }); toast(`Added "${s.title}" to the queue`); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-left transition-colors">
                  <SongCover song={s} className="w-9 h-9 rounded-lg" />
                  <span className="text-sm flex-1 truncate">{s.title} <span className="text-slate-500">· {s.artist}</span></span>
                  <Plus size={15} className="text-[#C4B5FD]" />
                </button>
              ))}
              {allSongs.length === 0 && <p className="text-sm text-slate-500 p-4 text-center">No songs found.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, UserPlus, Check, X } from "lucide-react";
import { toast } from "sonner";
import api, { errText } from "../lib/api";

function UserCard({ u, action, onClick }) {
  const navigate = useNavigate();
  return (
    <div className="glass rounded-2xl p-4 flex items-center gap-3">
      <div className="w-11 h-11 rounded-full bg-[#C4B5FD]/20 border border-[#C4B5FD]/30 flex items-center justify-center text-[#C4B5FD] font-medium cursor-pointer"
        onClick={() => navigate(`/profile/${u.username}`)}>
        {u.username[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/profile/${u.username}`)}>
        <p className="text-sm font-medium truncate">{u.name}</p>
        <p className="text-xs text-slate-400 truncate">@{u.username}</p>
      </div>
      {action}
    </div>
  );
}

export default function Friends() {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  const load = useCallback(() => {
    api.get("/friends").then(({ data }) => setFriends(data));
    api.get("/friends/requests").then(({ data }) => setRequests(data));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(() => api.get("/users/search", { params: { q: query } }).then(({ data }) => setResults(data)), 250);
    return () => clearTimeout(t);
  }, [query]);

  const sendRequest = async (username) => {
    try {
      await api.post("/friends/request", { username });
      toast.success(`Friend request sent to @${username}`);
    } catch (e) {
      toast.error(errText(e));
    }
  };

  const respond = async (id, action) => {
    await api.post(`/friends/requests/${id}/${action}`);
    toast(action === "accept" ? "Friend added" : "Request declined");
    load();
  };

  return (
    <div className="px-6 md:px-10 py-8 max-w-4xl">
      <h1 className="font-heading text-4xl font-light tracking-tight fade-up">Friends</h1>

      <div className="relative mt-8 max-w-lg">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
        <input data-testid="friends-search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Find people by username or name..."
          className="w-full pl-11 pr-4 py-3.5 rounded-full bg-white/5 border border-white/10 text-sm placeholder:text-slate-500 focus:outline-none focus:border-[#C4B5FD]/50 transition-colors" />
      </div>

      {results.length > 0 && (
        <section className="mt-6 space-y-2">
          <h2 className="font-heading text-lg font-medium">People</h2>
          {results.map((u) => (
            <UserCard key={u.id} u={u} action={
              <button data-testid={`add-friend-${u.username}`} onClick={() => sendRequest(u.username)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-sm transition-colors">
                <UserPlus size={14} /> Add
              </button>
            } />
          ))}
        </section>
      )}

      {requests.length > 0 && (
        <section className="mt-8 space-y-2">
          <h2 className="font-heading text-lg font-medium">Requests <span className="text-[#C4B5FD]">({requests.length})</span></h2>
          {requests.map((r) => (
            <UserCard key={r.id} u={r.from} action={
              <div className="flex gap-2">
                <button data-testid={`accept-request-${r.from.username}`} onClick={() => respond(r.id, "accept")}
                  className="p-2.5 rounded-full bg-[#C4B5FD]/20 text-[#C4B5FD] hover:bg-[#C4B5FD]/30 transition-colors"><Check size={16} /></button>
                <button data-testid={`decline-request-${r.from.username}`} onClick={() => respond(r.id, "decline")}
                  className="p-2.5 rounded-full bg-white/5 text-slate-400 hover:bg-white/10 transition-colors"><X size={16} /></button>
              </div>
            } />
          ))}
        </section>
      )}

      <section className="mt-8 space-y-2">
        <h2 className="font-heading text-lg font-medium">Your friends <span className="text-slate-500">({friends.length})</span></h2>
        {friends.length === 0 && (
          <div data-testid="friends-empty" className="glass rounded-2xl p-10 text-center text-slate-400 text-sm">
            No friends yet. Search above and send a request.
          </div>
        )}
        {friends.map((u) => <UserCard key={u.id} u={u} />)}
      </section>
    </div>
  );
}

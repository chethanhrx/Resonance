import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PartyPopper, Plus, LogIn, Radio } from "lucide-react";
import { toast } from "sonner";
import api, { errText } from "../lib/api";

export default function Parties() {
  const navigate = useNavigate();
  const [parties, setParties] = useState([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => { api.get("/parties").then(({ data }) => setParties(data)); }, []);

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const { data } = await api.post("/parties", { name });
    navigate(`/party/${data.id}`);
  };

  const join = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/parties/join", { code });
      navigate(`/party/${data.id}`);
    } catch (e2) { toast.error(errText(e2)); }
  };

  return (
    <div className="px-6 md:px-10 py-8 max-w-4xl">
      <h1 className="font-heading text-4xl font-light tracking-tight fade-up">Listening <span className="text-[#C4B5FD]">Parties</span></h1>
      <p className="text-slate-400 mt-2 text-sm">Listen to the same song, at the same moment, with friends.</p>

      <div className="grid sm:grid-cols-2 gap-5 mt-8">
        <form onSubmit={create} className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4 text-[#C4B5FD]"><PartyPopper size={18} /><h2 className="font-heading font-medium">Start a party</h2></div>
          <input data-testid="party-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Party name"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-slate-500 focus:outline-none focus:border-[#C4B5FD]/50" />
          <button data-testid="create-party-btn" type="submit"
            className="mt-3 w-full py-3 rounded-xl bg-[#C4B5FD] text-[#0A0A0E] font-medium text-sm hover:bg-[#d4c9fe] transition-colors flex items-center justify-center gap-2">
            <Plus size={15} /> Create party
          </button>
        </form>
        <form onSubmit={join} className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4 text-[#93C5FD]"><LogIn size={18} /><h2 className="font-heading font-medium">Join with code</h2></div>
          <input data-testid="party-code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="6-digit code" maxLength={6}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm tracking-[0.3em] placeholder:tracking-normal placeholder:text-slate-500 focus:outline-none focus:border-[#93C5FD]/50" />
          <button data-testid="join-party-btn" type="submit"
            className="mt-3 w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 font-medium text-sm transition-colors">
            Join party
          </button>
        </form>
      </div>

      <section className="mt-10">
        <h2 className="font-heading text-lg font-medium mb-3">Your parties & invites</h2>
        {parties.length === 0 && (
          <div data-testid="parties-empty" className="glass rounded-2xl p-10 text-center text-slate-400 text-sm">No active parties. Start one above.</div>
        )}
        <div className="space-y-2">
          {parties.map((p) => (
            <div key={p.id} data-testid={`party-item-${p.id}`} onClick={() => navigate(`/party/${p.id}`)}
              className="glass rounded-2xl p-5 flex items-center gap-4 cursor-pointer hover:bg-white/[0.06] transition-colors">
              <div className="w-11 h-11 rounded-full bg-[#C4B5FD]/15 flex items-center justify-center text-[#C4B5FD]"><Radio size={18} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.name} {p.is_invited && <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-[#93C5FD]/20 text-[#93C5FD]">Invited</span>}</p>
                <p className="text-xs text-slate-400">Host @{p.host_username} · {p.member_ids.length} member{p.member_ids.length !== 1 ? "s" : ""} · Code {p.code}</p>
              </div>
              {p.is_playing && <div className="flex items-end gap-0.5 h-4"><div className="eq-bar" /><div className="eq-bar" /><div className="eq-bar" /></div>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

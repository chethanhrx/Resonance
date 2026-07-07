import { useState, useEffect } from "react";
import { Heart, Bookmark, History } from "lucide-react";
import api from "../lib/api";
import SongRow from "../components/SongRow";
import { useAuth } from "../context/AuthContext";

const tabs = [
  { key: "liked", label: "Liked", icon: Heart, endpoint: "/me/liked" },
  { key: "saved", label: "Saved", icon: Bookmark, endpoint: "/me/saved" },
  { key: "history", label: "History", icon: History, endpoint: "/me/history" },
];

export default function Library() {
  const [tab, setTab] = useState("liked");
  const [songs, setSongs] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    const t = tabs.find((x) => x.key === tab);
    api.get(t.endpoint).then(({ data }) => setSongs(data));
  }, [tab, user]);

  return (
    <div className="px-6 md:px-10 py-8 max-w-5xl">
      <h1 className="font-heading text-4xl font-light tracking-tight fade-up">Your Library</h1>
      <div className="flex gap-2 mt-8">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} data-testid={`library-tab-${key}`} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm border transition-colors ${tab === key ? "bg-white/10 border-[#C4B5FD]/40 text-white" : "border-white/10 text-slate-400 hover:text-white hover:bg-white/5"}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      <div className="mt-6 space-y-1">
        {songs.length === 0 && (
          <div data-testid="library-empty" className="glass rounded-2xl p-10 text-center text-slate-400 text-sm">
            {tab === "liked" ? "Songs you like will appear here." : tab === "saved" ? "Songs you save will appear here." : "Your listening history will appear here."}
          </div>
        )}
        {songs.map((s, i) => <SongRow key={`${s.id}-${i}`} song={s} songs={songs} index={i} />)}
      </div>
    </div>
  );
}

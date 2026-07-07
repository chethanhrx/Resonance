import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import SongRow from "../components/SongRow";
import SongCover from "../components/SongCover";
import { usePlayer } from "../context/PlayerContext";
import { Play } from "lucide-react";

export default function Home() {
  const { user } = useAuth();
  const { playAt } = usePlayer();
  const [songs, setSongs] = useState([]);
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      api.get("/songs", { params: search ? { search } : {} }).then(({ data }) => { setSongs(data); setLoaded(true); });
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const featured = songs.slice(0, 6);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="px-6 md:px-10 py-8 max-w-6xl">
      <div className="fade-up">
        <h1 className="font-heading text-4xl sm:text-5xl font-light tracking-tight">{greeting}, <span className="text-[#C4B5FD]">{user.name.split(" ")[0]}</span></h1>
        <p className="text-slate-400 mt-2 text-sm">Lossless, high resolution listening.</p>
      </div>

      <div className="relative mt-8 max-w-lg">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
        <input data-testid="home-search" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search songs, artists, albums..."
          className="w-full pl-11 pr-4 py-3.5 rounded-full bg-white/5 border border-white/10 text-sm placeholder:text-slate-500 focus:outline-none focus:border-[#C4B5FD]/50 transition-colors" />
      </div>

      {!search && featured.length > 0 && (
        <section className="mt-10">
          <h2 className="font-heading text-lg font-medium mb-4">Fresh uploads</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
            {featured.map((s, i) => (
              <div key={s.id} data-testid={`featured-card-${s.id}`} onClick={() => playAt(songs, songs.indexOf(s))}
                className="group cursor-pointer fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="relative overflow-hidden rounded-2xl aspect-square">
                  <SongCover song={s} className="w-full h-full rounded-2xl transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-[#C4B5FD] flex items-center justify-center"><Play size={18} className="text-[#0A0A0E] ml-0.5" /></div>
                  </div>
                </div>
                <p className="text-sm font-medium mt-3 truncate">{s.title}</p>
                <p className="text-xs text-slate-400 truncate">{s.artist}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-heading text-lg font-medium mb-3">{search ? "Results" : "All songs"}</h2>
        {loaded && songs.length === 0 && (
          <div data-testid="empty-songs" className="glass rounded-2xl p-10 text-center text-slate-400 text-sm">
            {search ? "Nothing matches your search." : "No songs yet. The admin hasn't uploaded any tracks."}
          </div>
        )}
        <div className="space-y-1">
          {songs.map((s, i) => <SongRow key={s.id} song={s} songs={songs} index={i} />)}
        </div>
      </section>
    </div>
  );
}

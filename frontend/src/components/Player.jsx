import { Play, Pause, SkipBack, SkipForward, Volume2, Heart, Bookmark } from "lucide-react";
import { usePlayer } from "../context/PlayerContext";
import { useAuth } from "../context/AuthContext";
import api, { fmtTime } from "../lib/api";
import { toast } from "sonner";
import SongCover from "./SongCover";

export default function Player() {
  const { current, playing, time, duration, volume, toggle, next, prev, seek, setVolume, suspended } = usePlayer();
  const { user, refresh } = useAuth();

  if (!current || suspended) return null;
  const liked = user?.liked_song_ids?.includes(current.id);
  const saved = user?.saved_song_ids?.includes(current.id);

  const toggleLike = async () => {
    const { data } = await api.post(`/songs/${current.id}/like`);
    toast(data.liked ? "Added to Liked Songs" : "Removed from Liked Songs");
    refresh();
  };
  const toggleSave = async () => {
    const { data } = await api.post(`/songs/${current.id}/save`);
    toast(data.saved ? "Saved to your library" : "Removed from saved");
    refresh();
  };

  return (
    <div data-testid="bottom-player" className="fixed bottom-0 inset-x-0 z-50 border-t border-white/5 bg-[#0A0A0E]/85 backdrop-blur-2xl">
      <input data-testid="player-seek" type="range" min={0} max={duration || 0} value={time} onChange={(e) => seek(+e.target.value)}
        className="absolute -top-1.5 left-0 w-full h-1 accent-[#C4B5FD] cursor-pointer" />
      <div className="flex items-center gap-4 px-4 md:px-6 py-3">
        <div className="flex items-center gap-3 w-1/3 min-w-0">
          <SongCover song={current} className="w-12 h-12 rounded-lg" />
          <div className="min-w-0">
            <p data-testid="player-song-title" className="text-sm font-medium truncate">{current.title}</p>
            <p className="text-xs text-slate-400 truncate">{current.artist}</p>
          </div>
          <span className="hidden lg:inline text-[10px] px-2 py-0.5 rounded-full border border-[#C4B5FD]/30 text-[#C4B5FD] shrink-0">{current.quality}</span>
        </div>
        <div className="flex-1 flex items-center justify-center gap-4">
          <button data-testid="player-prev" onClick={prev} className="text-slate-300 hover:text-white transition-colors"><SkipBack size={20} /></button>
          <button data-testid="player-toggle" onClick={toggle}
            className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md flex items-center justify-center transition-colors">
            {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
          </button>
          <button data-testid="player-next" onClick={next} className="text-slate-300 hover:text-white transition-colors"><SkipForward size={20} /></button>
        </div>
        <div className="w-1/3 flex items-center justify-end gap-3">
          <span className="text-xs text-slate-500 hidden sm:inline">{fmtTime(time)} / {fmtTime(duration)}</span>
          <button data-testid="player-like" onClick={toggleLike} className={liked ? "text-[#C4B5FD]" : "text-slate-400 hover:text-white"}>
            <Heart size={18} fill={liked ? "currentColor" : "none"} />
          </button>
          <button data-testid="player-save" onClick={toggleSave} className={saved ? "text-[#93C5FD]" : "text-slate-400 hover:text-white"}>
            <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
          </button>
          <div className="hidden md:flex items-center gap-2">
            <Volume2 size={16} className="text-slate-400" />
            <input data-testid="player-volume" type="range" min={0} max={1} step={0.02} value={volume} onChange={(e) => setVolume(+e.target.value)}
              className="w-20 h-1 accent-[#C4B5FD]" />
          </div>
        </div>
      </div>
    </div>
  );
}

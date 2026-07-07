import { Play, Pause, Heart, Bookmark } from "lucide-react";
import { usePlayer } from "../context/PlayerContext";
import { useAuth } from "../context/AuthContext";
import api, { fmtTime } from "../lib/api";
import SongCover from "./SongCover";

export default function SongRow({ song, songs, index, showActions = true }) {
  const { current, playing, playAt, toggle } = usePlayer();
  const { user, refresh } = useAuth();
  const isCurrent = current?.id === song.id;
  const liked = user?.liked_song_ids?.includes(song.id);
  const saved = user?.saved_song_ids?.includes(song.id);

  return (
    <div data-testid={`song-row-${song.id}`}
      className={`group flex items-center gap-4 px-4 py-3 rounded-xl transition-colors cursor-pointer ${isCurrent ? "bg-white/10 glow-active" : "hover:bg-white/5"}`}
      onClick={() => (isCurrent ? toggle() : playAt(songs, index))}>
      <div className="relative">
        <SongCover song={song} className="w-11 h-11 rounded-lg" />
        <div className={`absolute inset-0 rounded-lg bg-black/50 flex items-center justify-center transition-opacity ${isCurrent ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
          {isCurrent && playing ? (
            <div className="flex items-end gap-0.5 h-4"><div className="eq-bar" /><div className="eq-bar" /><div className="eq-bar" /></div>
          ) : (
            <Play size={16} className="text-white ml-0.5" />
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isCurrent ? "text-[#C4B5FD]" : ""}`}>{song.title}</p>
        <p className="text-xs text-slate-400 truncate">{song.artist}{song.album ? ` · ${song.album}` : ""}</p>
      </div>
      <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-slate-400 hidden sm:inline">{song.quality}</span>
      <span className="text-xs text-slate-500 w-10 text-right">{fmtTime(song.duration)}</span>
      {showActions && (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button data-testid={`like-btn-${song.id}`} onClick={async () => { await api.post(`/songs/${song.id}/like`); refresh(); }}
            className={`${liked ? "text-[#C4B5FD]" : "text-slate-500 hover:text-white"} transition-colors`}>
            <Heart size={16} fill={liked ? "currentColor" : "none"} />
          </button>
          <button data-testid={`save-btn-${song.id}`} onClick={async () => { await api.post(`/songs/${song.id}/save`); refresh(); }}
            className={`${saved ? "text-[#93C5FD]" : "text-slate-500 hover:text-white"} transition-colors`}>
            <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
          </button>
        </div>
      )}
    </div>
  );
}

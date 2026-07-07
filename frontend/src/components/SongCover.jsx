import { BACKEND_URL } from "../lib/api";
import { Music } from "lucide-react";

export default function SongCover({ song, className = "" }) {
  const url = song?.cover_url ? (song.cover_url.startsWith("http") ? song.cover_url : `${BACKEND_URL}${song.cover_url}`) : null;
  if (url) return <img src={url} alt={song.title} className={`object-cover shrink-0 ${className}`} />;
  return (
    <div className={`bg-gradient-to-br from-[#1a1a26] to-[#12121A] border border-white/5 flex items-center justify-center shrink-0 ${className}`}>
      <Music className="text-slate-600 w-1/3 h-1/3" />
    </div>
  );
}

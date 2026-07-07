import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { UserPlus, Clock, Heart, Bookmark, Users } from "lucide-react";
import { toast } from "sonner";
import api, { errText } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import SongRow from "../components/SongRow";

export default function Profile() {
  const { username } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("liked");

  const load = () => api.get(`/users/${username}`).then(({ data }) => setProfile(data)).catch(() => setProfile(false));
  useEffect(() => { load(); }, [username]); // eslint-disable-line

  if (profile === null) return <div className="p-10 text-slate-400 text-sm">Loading...</div>;
  if (profile === false) return <div className="p-10 text-slate-400">User not found.</div>;

  const isMe = user.username === profile.username;
  const songs = tab === "liked" ? profile.liked_songs : profile.saved_songs;

  const addFriend = async () => {
    try {
      await api.post("/friends/request", { username: profile.username });
      toast.success("Friend request sent");
      load();
    } catch (e) { toast.error(errText(e)); }
  };

  return (
    <div className="px-6 md:px-10 py-8 max-w-5xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 fade-up">
        <div className="w-24 h-24 rounded-full bg-[#C4B5FD]/20 border border-[#C4B5FD]/30 flex items-center justify-center text-4xl font-heading font-light text-[#C4B5FD]">
          {profile.username[0].toUpperCase()}
        </div>
        <div className="flex-1">
          <h1 data-testid="profile-name" className="font-heading text-4xl font-light tracking-tight">{profile.name}</h1>
          <p data-testid="profile-username" className="text-slate-400 mt-1">@{profile.username}</p>
          <div className="flex gap-5 mt-3 text-sm text-slate-400">
            <span className="flex items-center gap-1.5"><Heart size={14} className="text-[#C4B5FD]" /> {profile.liked_song_ids.length} liked</span>
            <span className="flex items-center gap-1.5"><Bookmark size={14} className="text-[#93C5FD]" /> {profile.saved_song_ids.length} saved</span>
            <span className="flex items-center gap-1.5"><Users size={14} /> {profile.friend_ids.length} friends</span>
          </div>
        </div>
        {!isMe && (
          profile.is_friend ? (
            <span data-testid="profile-friend-badge" className="px-4 py-2 rounded-full border border-[#C4B5FD]/40 text-[#C4B5FD] text-sm">Friends</span>
          ) : profile.request_pending ? (
            <span data-testid="profile-pending-badge" className="px-4 py-2 rounded-full border border-white/10 text-slate-400 text-sm flex items-center gap-2"><Clock size={14} /> Pending</span>
          ) : (
            <button data-testid="profile-add-friend" onClick={addFriend}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-sm transition-colors">
              <UserPlus size={15} /> Add friend
            </button>
          )
        )}
      </div>

      <div className="flex gap-2 mt-10">
        {["liked", "saved"].map((k) => (
          <button key={k} data-testid={`profile-tab-${k}`} onClick={() => setTab(k)}
            className={`px-5 py-2.5 rounded-full text-sm border capitalize transition-colors ${tab === k ? "bg-white/10 border-[#C4B5FD]/40 text-white" : "border-white/10 text-slate-400 hover:text-white"}`}>
            {k} songs
          </button>
        ))}
      </div>
      <div className="mt-5 space-y-1">
        {songs.length === 0 && <div className="glass rounded-2xl p-8 text-center text-slate-400 text-sm">Nothing here yet.</div>}
        {songs.map((s, i) => <SongRow key={s.id} song={s} songs={songs} index={i} />)}
      </div>
    </div>
  );
}

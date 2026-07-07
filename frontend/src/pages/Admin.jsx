import { useState, useEffect } from "react";
import { Upload, Trash2, Music } from "lucide-react";
import { toast } from "sonner";
import api, { errText, fmtTime } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import SongCover from "../components/SongCover";

export default function Admin() {
  const { user } = useAuth();
  const [songs, setSongs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: "", artist: "", album: "", genre: "", quality: "Hi-Res" });
  const [audioFile, setAudioFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);

  const load = () => api.get("/songs").then(({ data }) => setSongs(data));
  useEffect(() => { load(); }, []);

  if (user.role !== "admin") return <div className="p-10 text-slate-400">Admin access required.</div>;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!audioFile) { toast.error("Select an audio file"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append("audio", audioFile);
      if (coverFile) fd.append("cover", coverFile);
      await api.post("/songs", fd);
      toast.success("Song uploaded");
      setForm({ title: "", artist: "", album: "", genre: "", quality: "Hi-Res" });
      setAudioFile(null);
      setCoverFile(null);
      e.target.reset();
      load();
    } catch (e2) { toast.error(errText(e2)); }
    finally { setBusy(false); }
  };

  const remove = async (id) => {
    await api.delete(`/songs/${id}`);
    toast("Song deleted");
    load();
  };

  const inputCls = "w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-slate-500 focus:outline-none focus:border-[#C4B5FD]/50";

  return (
    <div className="px-6 md:px-10 py-8 max-w-4xl">
      <h1 className="font-heading text-4xl font-light tracking-tight fade-up">Admin <span className="text-[#C4B5FD]">Studio</span></h1>

      <form onSubmit={submit} className="glass rounded-3xl p-6 mt-8 space-y-3">
        <div className="flex items-center gap-2 text-[#C4B5FD] mb-2"><Upload size={18} /><h2 className="font-heading font-medium">Upload a track</h2></div>
        <div className="grid sm:grid-cols-2 gap-3">
          <input data-testid="admin-title" className={inputCls} placeholder="Title *" value={form.title} onChange={set("title")} required />
          <input data-testid="admin-artist" className={inputCls} placeholder="Artist *" value={form.artist} onChange={set("artist")} required />
          <input data-testid="admin-album" className={inputCls} placeholder="Album" value={form.album} onChange={set("album")} />
          <input data-testid="admin-genre" className={inputCls} placeholder="Genre" value={form.genre} onChange={set("genre")} />
        </div>
        <select data-testid="admin-quality" className={inputCls} value={form.quality} onChange={set("quality")}>
          <option value="Hi-Res">Hi-Res (24-bit)</option>
          <option value="Lossless">Lossless (16-bit)</option>
          <option value="High">High (320kbps)</option>
        </select>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-slate-400">Audio file * (mp3, flac, wav, m4a)</span>
            <input data-testid="admin-audio-file" type="file" accept="audio/*,.flac,.m4a" onChange={(e) => setAudioFile(e.target.files[0])}
              className="mt-1 block w-full text-sm text-slate-400 file:mr-3 file:px-4 file:py-2 file:rounded-full file:border-0 file:bg-white/10 file:text-white file:text-xs hover:file:bg-white/20 file:cursor-pointer" />
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">Cover art (jpg, png)</span>
            <input data-testid="admin-cover-file" type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files[0])}
              className="mt-1 block w-full text-sm text-slate-400 file:mr-3 file:px-4 file:py-2 file:rounded-full file:border-0 file:bg-white/10 file:text-white file:text-xs hover:file:bg-white/20 file:cursor-pointer" />
          </label>
        </div>
        <button data-testid="admin-upload-btn" type="submit" disabled={busy}
          className="w-full py-3.5 rounded-xl bg-[#C4B5FD] text-[#0A0A0E] font-medium text-sm hover:bg-[#d4c9fe] transition-colors disabled:opacity-50">
          {busy ? "Uploading..." : "Upload song"}
        </button>
      </form>

      <section className="mt-10">
        <h2 className="font-heading text-lg font-medium mb-3">Catalog <span className="text-slate-500">({songs.length})</span></h2>
        {songs.length === 0 && <div className="glass rounded-2xl p-8 text-center text-slate-400 text-sm flex flex-col items-center gap-2"><Music size={22} /> No songs uploaded yet.</div>}
        <div className="space-y-1">
          {songs.map((s) => (
            <div key={s.id} data-testid={`admin-song-${s.id}`} className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-white/5">
              <SongCover song={s} className="w-10 h-10 rounded-lg" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{s.title}</p>
                <p className="text-xs text-slate-400 truncate">{s.artist} · {s.quality} · {fmtTime(s.duration)}</p>
              </div>
              <button data-testid={`admin-delete-${s.id}`} onClick={() => remove(s.id)} className="text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

import { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";
import api, { API } from "../lib/api";

const PlayerContext = createContext(null);
export const usePlayer = () => useContext(PlayerContext);

export function PlayerProvider({ children }) {
  const audioRef = useRef(new Audio());
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [suspended, setSuspended] = useState(false);

  const current = index >= 0 ? queue[index] : null;

  useEffect(() => {
    const a = audioRef.current;
    a.volume = volume;
    const onTime = () => setTime(a.currentTime);
    const onDur = () => setDuration(a.duration || 0);
    const onEnd = () => nextRef.current();
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onDur);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onDur);
      a.removeEventListener("ended", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playAt = useCallback((songs, i) => {
    const song = songs[i];
    if (!song) return;
    setQueue(songs);
    setIndex(i);
    const a = audioRef.current;
    a.src = `${API}/songs/${song.id}/stream`;
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    api.post(`/songs/${song.id}/play`).catch(() => {});
  }, []);

  const nextRef = useRef(() => {});
  const next = useCallback(() => {
    setIndex((i) => {
      if (i + 1 < queue.length) {
        playAt(queue, i + 1);
        return i + 1;
      }
      setPlaying(false);
      return i;
    });
  }, [queue, playAt]);
  nextRef.current = next;

  const prev = useCallback(() => {
    if (audioRef.current.currentTime > 3 || index <= 0) {
      audioRef.current.currentTime = 0;
    } else {
      playAt(queue, index - 1);
    }
  }, [queue, index, playAt]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (a.paused) { a.play(); setPlaying(true); } else { a.pause(); setPlaying(false); }
  }, []);

  const seek = useCallback((t) => { audioRef.current.currentTime = t; setTime(t); }, []);
  const setVolume = useCallback((v) => { audioRef.current.volume = v; setVolumeState(v); }, []);

  const suspend = useCallback(() => {
    audioRef.current.pause();
    setPlaying(false);
    setSuspended(true);
  }, []);
  const resume = useCallback(() => setSuspended(false), []);

  return (
    <PlayerContext.Provider value={{ queue, index, current, playing, time, duration, volume, suspended, playAt, next, prev, toggle, seek, setVolume, suspend, resume }}>
      {children}
    </PlayerContext.Provider>
  );
}

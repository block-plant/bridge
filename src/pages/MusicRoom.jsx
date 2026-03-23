import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection, addDoc, onSnapshot, query, orderBy,
  doc, updateDoc, deleteDoc, serverTimestamp, limit, setDoc, getDoc
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import YouTube from "react-youtube";

const extractVideoId = (url) => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

const formatTime = (seconds) => {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const MOODS = [
  {
    id: "missing", label: "Missing You 🥺",
    songs: [
      { id: "RgKAFK5djSk", title: "See You Again", artist: "Wiz Khalifa" },
      { id: "450p7goxZqg", title: "All of Me", artist: "John Legend" },
      { id: "OPf0YbXqDm0", title: "Make You Feel My Love", artist: "Adele" },
    ],
  },
  {
    id: "happy", label: "Happy Together 😊",
    songs: [
      { id: "60ItHLz5WEA", title: "Happy", artist: "Pharrell Williams" },
      { id: "ru0K8uYEZWw", title: "Can't Stop the Feeling", artist: "Justin Timberlake" },
      { id: "hT_nvWreIhg", title: "Counting Stars", artist: "OneRepublic" },
    ],
  },
  {
    id: "latenight", label: "Late Night 🌙",
    songs: [
      { id: "pB-5XG-DbAA", title: "Starboy", artist: "The Weeknd" },
      { id: "YkgkThdzX-8", title: "Bad Guy", artist: "Billie Eilish" },
      { id: "JGwWNGJdvx8", title: "Shape of You", artist: "Ed Sheeran" },
    ],
  },
  {
    id: "romantic", label: "Romantic 🥰",
    songs: [
      { id: "09R8_2nJtjg", title: "Perfect", artist: "Ed Sheeran" },
      { id: "rtOvBOTyX00", title: "A Thousand Years", artist: "Christina Perri" },
      { id: "GxBSyx85Kp8", title: "Thinking Out Loud", artist: "Ed Sheeran" },
    ],
  },
  {
    id: "roadtrip", label: "Road Trip 🚗",
    songs: [
      { id: "fKopy74weus", title: "Road Trippin", artist: "Red Hot Chili Peppers" },
      { id: "pXRviuL6vMY", title: "Life is a Highway", artist: "Tom Cochrane" },
      { id: "uelHwf8o7_U", title: "Take It Easy", artist: "Eagles" },
    ],
  },
];

const REACTIONS = ["❤️", "🔥", "😭", "😂", "✨", "🎵"];

const SongCard = ({ song, isPlaying, onPlay, onAddToQueue }) => (
  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
    className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
      isPlaying ? "bg-plum/10 border-plum/30" : "bg-white/60 border-white/80 hover:bg-white/80"
    }`}>
    <button onClick={() => onPlay(song)}
      className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 transition-all ${
        isPlaying ? "bg-plum text-white shadow-plum" : "bg-rose/20 text-plum hover:bg-plum hover:text-white"
      }`}>
      {isPlaying ? "⏸" : "▶"}
    </button>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-softdark truncate">{song.title}</p>
      <p className="text-xs text-softdark/40 truncate">{song.artist}</p>
    </div>
    {onAddToQueue && (
      <button onClick={() => onAddToQueue(song)}
        className="text-xs text-plum/50 hover:text-plum transition-colors px-2 py-1 rounded-xl hover:bg-rose/10">
        + Queue
      </button>
    )}
  </motion.div>
);

export default function MusicRoom() {
  const { user, userData, coupleData } = useAuth();
  const [tab, setTab] = useState("player");
  const [urlInput, setUrlInput] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [artistInput, setArtistInput] = useState("");
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [playbackState, setPlaybackState] = useState(null);
  const [songOfDay, setSongOfDay] = useState(null);
  const [dedication, setDedication] = useState("");
  const [showDedicate, setShowDedicate] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [songReactions, setSongReactions] = useState({});
  const playerRef = useRef(null);
  const isSyncing = useRef(false);
  const hasMounted = useRef(false);
  const isPlayerReady = useRef(false);

  const coupleId = coupleData?.id;
  const playbackRef = doc(db, "couples", coupleId, "musicRoom", "playback");
  const songOfDayRef = doc(db, "couples", coupleId, "musicRoom", "songOfDay");
  const reactionRef = doc(db, "couples", coupleId, "musicRoom", "reactions");

  useEffect(() => {
    if (!coupleId) return;
    const unsub = onSnapshot(playbackRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setPlaybackState(data);
        setCurrentSong(data.currentSong || null);
      }
    });
    return () => unsub();
  }, [coupleId]);

  useEffect(() => {
    if (!coupleId) return;
    const q = query(collection(db, "couples", coupleId, "musicQueue"), orderBy("addedAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setQueue(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [coupleId]);

  useEffect(() => {
    if (!coupleId) return;
    const q = query(
      collection(db, "couples", coupleId, "musicHistory"),
      orderBy("playedAt", "desc"),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [coupleId]);

  useEffect(() => {
    if (!coupleId) return;
    const unsub = onSnapshot(songOfDayRef, (snap) => {
      if (snap.exists()) setSongOfDay(snap.data());
    });
    return () => unsub();
  }, [coupleId]);

  // Listen to reactions in real time
  useEffect(() => {
    if (!coupleId) return;
    const unsub = onSnapshot(reactionRef, (snap) => {
      if (snap.exists()) setSongReactions(snap.data());
      else setSongReactions({});
    });
    return () => unsub();
  }, [coupleId]);

  // Track current time always
  useEffect(() => {
    const interval = setInterval(async () => {
      if (playerRef.current && isPlayerReady.current) {
        try {
          const time = await playerRef.current.getCurrentTime();
          const dur = await playerRef.current.getDuration();
          setCurrentTime(Math.floor(time));
          if (dur) setDuration(Math.floor(dur));
        } catch { }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync playback — skip first mount so existing state doesn't auto-play
  useEffect(() => {
    if (!playbackState || !playerRef.current || !isPlayerReady.current || isSyncing.current) return;
    if (!hasMounted.current) {
      hasMounted.current = true;
      try {
        playerRef.current.seekTo(playbackState.currentTime || 0, true);
        playerRef.current.pauseVideo();
      } catch { }
      return;
    }
    const player = playerRef.current;
    try {
      if (playbackState.isPlaying) {
        player.playVideo();
        const serverTime = playbackState.updatedAt?.toDate?.() || new Date();
        const elapsed = (Date.now() - serverTime.getTime()) / 1000;
        const targetTime = (playbackState.currentTime || 0) + elapsed;
        player.seekTo(targetTime, true);
      } else {
        player.pauseVideo();
        player.seekTo(playbackState.currentTime || 0, true);
      }
    } catch { }
  }, [playbackState?.isPlaying, playbackState?.videoId]);

  const playSong = async (song) => {
    isSyncing.current = true;
    setCurrentTime(0);
    setDuration(0);
    hasMounted.current = false;
    const payload = {
      currentSong: song,
      videoId: song.videoId,
      isPlaying: true,
      currentTime: 0,
      updatedAt: serverTimestamp(),
      startedBy: userData.displayName,
    };
    try {
      await updateDoc(playbackRef, payload);
    } catch {
      await setDoc(playbackRef, payload);
    }
    await addDoc(collection(db, "couples", coupleId, "musicHistory"), {
      ...song, playedAt: serverTimestamp(), playedBy: userData.displayName,
    });
    setTimeout(() => { isSyncing.current = false; }, 1000);
  };

  const togglePlay = async () => {
    if (!playbackState?.videoId) return;
    const player = playerRef.current;
    const time = player ? await player.getCurrentTime() : 0;
    await updateDoc(playbackRef, {
      isPlaying: !playbackState.isPlaying,
      currentTime: time,
      updatedAt: serverTimestamp(),
    });
  };

  const addToQueue = async (song) => {
    await addDoc(collection(db, "couples", coupleId, "musicQueue"), {
      ...song, addedBy: userData.displayName, addedAt: serverTimestamp(),
    });
  };

  const addFromUrl = async () => {
    if (!urlInput.trim()) return;
    const videoId = extractVideoId(urlInput.trim());
    if (!videoId) return alert("Invalid YouTube URL or video ID");
    await addToQueue({
      videoId,
      title: titleInput.trim() || "Unknown Song",
      artist: artistInput.trim() || "Unknown Artist",
    });
    setUrlInput(""); setTitleInput(""); setArtistInput("");
  };

  const skipNext = async () => {
    if (queue.length === 0) return;
    const next = queue[0];
    await playSong(next);
    await deleteDoc(doc(db, "couples", coupleId, "musicQueue", next.id));
  };

  const removeFromQueue = async (id) => {
    await deleteDoc(doc(db, "couples", coupleId, "musicQueue", id));
  };

  const dedicateSong = async () => {
    if (!currentSong) return;
    await setDoc(songOfDayRef, {
      ...currentSong, dedication,
      dedicatedBy: userData.displayName,
      dedicatedAt: serverTimestamp(),
    });
    setDedication(""); setShowDedicate(false);
  };

  const reactToSong = async (songId, emoji) => {
    const snap = await getDoc(reactionRef);
    const current = snap.exists() ? snap.data() : {};
    const key = `${songId}_${emoji}`;
    await setDoc(reactionRef, { ...current, [key]: (current[key] || 0) + 1 });
  };

  const TABS = [
    { id: "player",  label: "🎵 Player" },
    { id: "queue",   label: "📋 Queue" },
    { id: "moods",   label: "🎭 Moods" },
    { id: "history", label: "🕐 History" },
  ];

  return (
    <div className="page-enter min-h-screen bg-petal flex flex-col">
      <div className="bg-white/60 backdrop-blur-md border-b border-rose/20 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard"
              className="text-plum/50 hover:text-plum bg-white/50 rounded-2xl px-3 py-2 border border-rose/20 transition-colors text-sm">
              ← Back
            </Link>
            <div>
              <h1 className="font-serif text-2xl text-softdark">Music Room 🎵</h1>
              <p className="text-xs text-softdark/40">Listening together ♥</p>
            </div>
          </div>
        </div>
        <div className="max-w-2xl mx-auto mt-3 flex bg-rose/10 rounded-2xl p-1 gap-1 overflow-x-auto">
        {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap min-w-[70px] ${
                tab === t.id ? "bg-white text-plum shadow-soft" : "text-softdark/50 hover:text-plum"
            }`}>
            {t.label}
            </button>
        ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto w-full p-4 flex-1 space-y-4">

        {/* YouTube Player — toggleable */}
        <div style={{
          position: showVideo ? "relative" : "absolute",
          width: showVideo ? "100%" : 1,
          height: showVideo ? "auto" : 1,
          overflow: "hidden",
          borderRadius: showVideo ? "1.5rem" : 0,
        }}>
          {playbackState?.videoId && (
            <YouTube
              videoId={playbackState.videoId}
              onReady={(e) => {
                playerRef.current = e.target;
                isPlayerReady.current = true;
                e.target.pauseVideo();
                try { setDuration(e.target.getDuration()); } catch { }
              }}
              onStateChange={(e) => {
                if (e.data === 1) {
                  try { setDuration(e.target.getDuration()); } catch { }
                }
              }}
              onEnd={skipNext}
              opts={{
                height: showVideo ? "360" : "1",
                width: showVideo ? "100%" : "1",
                playerVars: {
                  autoplay: 0,
                  controls: showVideo ? 1 : 0,
                  disablekb: 1,
                },
              }}
            />
          )}
        </div>

        {/* Now Playing */}
        <div className="bg-white/70 backdrop-blur-sm rounded-3xl border border-white/80 shadow-soft p-6">
          {currentSong ? (
            <div className="space-y-4">
              {!showVideo && (
                <div className="w-full h-40 rounded-2xl flex items-center justify-center relative overflow-hidden"
                  style={{ background: "linear-gradient(135deg, #8b3a5a22, #e8a0a044)" }}>
                  <motion.div className="text-7xl"
                    animate={{ scale: playbackState?.isPlaying ? [1, 1.05, 1] : 1 }}
                    transition={{ duration: 2, repeat: Infinity }}>
                    🎵
                  </motion.div>
                  {playbackState?.isPlaying && (
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1">
                      {[1,2,3,4,5].map(i => (
                        <motion.div key={i} className="w-1 bg-plum rounded-full"
                          animate={{ height: ["8px", `${12 + i * 4}px`, "8px"] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="text-center">
                <p className="font-serif text-xl text-softdark">{currentSong.title}</p>
                <p className="text-sm text-softdark/50 mt-1">{currentSong.artist}</p>
                {playbackState?.startedBy && (
                  <p className="text-xs text-plum/50 mt-1">▶ Started by {playbackState.startedBy}</p>
                )}
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <input type="range" min={0} max={duration || 100} value={currentTime}
                  onChange={async (e) => {
                    const time = Number(e.target.value);
                    setCurrentTime(time);
                    if (playerRef.current) playerRef.current.seekTo(time, true);
                    await updateDoc(playbackRef, { currentTime: time, updatedAt: serverTimestamp() });
                  }}
                  className="w-full accent-plum cursor-pointer"
                />
                <div className="flex justify-between text-xs text-softdark/30">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Video toggle */}
              <button onClick={() => setShowVideo(v => !v)}
                className="w-full text-xs border border-rose/20 rounded-2xl py-2 transition-colors text-plum/50 hover:text-plum hover:border-plum/30">
                {showVideo ? "🎵 Audio only" : "📺 Show video"}
              </button>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4">
                <button onClick={skipNext} disabled={queue.length === 0}
                  className="text-softdark/30 hover:text-plum transition-colors disabled:opacity-20 text-lg">⏮</button>
                <button onClick={togglePlay}
                  className="w-14 h-14 rounded-full bg-gradient-to-r from-plum to-plum-light text-white text-2xl flex items-center justify-center shadow-plum hover:shadow-glow transition-all hover:scale-105">
                  {playbackState?.isPlaying ? "⏸" : "▶"}
                </button>
                <button onClick={skipNext} disabled={queue.length === 0}
                  className="text-softdark/30 hover:text-plum transition-colors disabled:opacity-20 text-lg">⏭</button>
              </div>

              <button onClick={() => setShowDedicate(!showDedicate)}
                className="w-full text-xs text-plum/50 hover:text-plum border border-rose/20 rounded-2xl py-2 transition-colors">
                💌 Dedicate this song
              </button>

              <AnimatePresence>
                {showDedicate && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }} className="space-y-2">
                    <input value={dedication} onChange={e => setDedication(e.target.value)}
                      placeholder="Write a dedication message..."
                      className="w-full bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark" />
                    <button onClick={dedicateSong}
                      className="w-full bg-gradient-to-r from-plum to-plum-light text-white rounded-2xl py-2 text-sm font-medium">
                      Send Dedication 💌
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-5xl mb-3">🎵</p>
              <p className="font-serif text-xl text-softdark">Nothing playing yet</p>
              <p className="text-sm text-softdark/40 mt-1">Add a song to the queue or pick a mood ♥</p>
            </div>
          )}
        </div>

        {/* Song of the Day */}
        {songOfDay && (
          <div className="bg-gradient-to-r from-rose/20 to-blush/30 rounded-3xl p-4 border border-rose/20">
            <p className="text-xs uppercase tracking-widest text-plum/50 mb-2">💌 Song of the Day</p>
            <p className="font-serif text-lg text-softdark">{songOfDay.title}</p>
            <p className="text-sm text-softdark/50">{songOfDay.artist}</p>
            {songOfDay.dedication && (
              <p className="text-xs text-plum/60 italic mt-2">"{songOfDay.dedication}" — {songOfDay.dedicatedBy}</p>
            )}
            <button onClick={() => playSong(songOfDay)}
              className="mt-3 text-xs bg-plum text-white rounded-xl px-3 py-1.5 hover:bg-plum-light transition-colors">
              ▶ Play
            </button>
          </div>
        )}

        {/* Add from URL */}
        {tab === "player" && (
          <div className="bg-white/70 backdrop-blur-sm rounded-3xl border border-white/80 shadow-soft p-5 space-y-3">
            <p className="text-xs uppercase tracking-widest text-plum/40 font-medium">Add a song</p>
            <input value={urlInput} onChange={e => setUrlInput(e.target.value)}
              placeholder="Paste YouTube URL or video ID"
              className="w-full bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark" />
            <div className="flex flex-col sm:flex-row gap-2">
            <input value={titleInput} onChange={e => setTitleInput(e.target.value)}
                placeholder="Song title"
                className="flex-1 bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark" />
            <input value={artistInput} onChange={e => setArtistInput(e.target.value)}
                placeholder="Artist"
                className="flex-1 bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark" />
            </div>
            <button onClick={addFromUrl} disabled={!urlInput.trim()}
              className="w-full bg-gradient-to-r from-plum to-plum-light text-white rounded-2xl py-3 text-sm font-medium disabled:opacity-40 hover:-translate-y-0.5 transition-all shadow-plum">
              + Add to Queue
            </button>
          </div>
        )}

        {/* Queue Tab */}
        {tab === "queue" && (
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-widest text-plum/40 font-medium">{queue.length} songs in queue</p>
            {queue.length === 0 ? (
              <div className="text-center py-12 bg-white/40 rounded-3xl border border-white/60">
                <p className="text-3xl mb-2">📋</p>
                <p className="text-sm text-softdark/40">Queue is empty — add some songs!</p>
              </div>
            ) : queue.map((song, i) => (
              <motion.div key={song.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 bg-white/70 rounded-2xl p-3 border border-white/80 shadow-soft">
                <span className="text-xs text-softdark/30 w-5">{i + 1}</span>
                <button onClick={() => playSong(song)}
                  className="w-9 h-9 rounded-xl bg-rose/20 text-plum flex items-center justify-center text-sm hover:bg-plum hover:text-white transition-all">▶</button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-softdark truncate">{song.title}</p>
                  <p className="text-xs text-softdark/40">{song.artist} · added by {song.addedBy}</p>
                </div>
                <button onClick={() => removeFromQueue(song.id)}
                  className="text-softdark/30 hover:text-red-400 transition-colors">✕</button>
              </motion.div>
            ))}
          </div>
        )}

        {/* Moods Tab */}
        {tab === "moods" && (
          <div className="space-y-4">
            {MOODS.map(mood => (
              <div key={mood.id} className="bg-white/70 backdrop-blur-sm rounded-3xl border border-white/80 shadow-soft p-5 space-y-3">
                <p className="font-serif text-lg text-softdark">{mood.label}</p>
                {mood.songs.map(song => (
                  <SongCard key={song.id} song={{ ...song, videoId: song.id }}
                    isPlaying={currentSong?.videoId === song.id && playbackState?.isPlaying}
                    onPlay={playSong} onAddToQueue={addToQueue} />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* History Tab */}
        {tab === "history" && (
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-widest text-plum/40 font-medium">Recently played</p>
            {history.length === 0 ? (
              <div className="text-center py-12 bg-white/40 rounded-3xl border border-white/60">
                <p className="text-3xl mb-2">🕐</p>
                <p className="text-sm text-softdark/40">No listening history yet</p>
              </div>
            ) : history.map(song => (
              <motion.div key={song.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-center gap-3 bg-white/70 rounded-2xl p-3 border border-white/80 shadow-soft">
                <button onClick={() => playSong(song)}
                  className="w-9 h-9 rounded-xl bg-rose/20 text-plum flex items-center justify-center text-sm hover:bg-plum hover:text-white transition-all">▶</button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-softdark truncate">{song.title}</p>
                  <p className="text-xs text-softdark/40">{song.artist} · by {song.playedBy}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
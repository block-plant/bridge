import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  doc, setDoc, onSnapshot, deleteDoc,
  updateDoc, serverTimestamp, getDoc,
  collection, addDoc, query, orderBy, limit
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

const FILTERS = [
  { id: "none",      label: "Normal",    css: "none" },
  { id: "warm",      label: "Warm 🌅",   css: "saturate(150%) sepia(20%) brightness(1.1)" },
  { id: "cool",      label: "Cool 🧊",   css: "saturate(80%) hue-rotate(20deg) brightness(1.05)" },
  { id: "bw",        label: "B&W 🎞️",   css: "grayscale(100%)" },
  { id: "vintage",   label: "Vintage 📷",css: "sepia(60%) contrast(90%) brightness(1.05)" },
  { id: "dramatic",  label: "Drama 🎭",  css: "contrast(120%) saturate(130%) brightness(0.95)" },
  { id: "dreamy",    label: "Dreamy ✨", css: "brightness(1.1) saturate(120%) blur(0.5px)" },
  { id: "rosy",      label: "Rosy 🌸",  css: "saturate(140%) hue-rotate(-15deg) brightness(1.05)" },
];

const REACTIONS = ["❤️", "😂", "😮", "👏", "🔥", "😭"];
const QUALITY = [
  { id: "low",  label: "360p",  width: 640,  height: 360,  frameRate: 15 },
  { id: "med",  label: "720p",  width: 1280, height: 720,  frameRate: 30 },
  { id: "high", label: "1080p", width: 1920, height: 1080, frameRate: 30 },
];

const formatDuration = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${m.toString().padStart(2,"0")}:${sec.toString().padStart(2,"0")}`
    : `${m}:${sec.toString().padStart(2,"0")}`;
};

export default function VideoCall() {
  const { user, userData, coupleData } = useAuth();
  const [callStatus, setCallStatus] = useState("idle");
  const [mirrored, setMirrored] = useState(true); // mirror by default
  const [partner, setPartner] = useState(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("none");
  const [quality, setQuality] = useState("med");
  const [pip, setPip] = useState(false);
  const [duration, setDuration] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [reactions, setReactions] = useState([]);
  const [handRaised, setHandRaised] = useState(false);
  const [partnerHandRaised, setPartnerHandRaised] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  const [callData, setCallData] = useState(null);
  const [error, setError] = useState("");
  const [watchUrl, setWatchUrl] = useState("");
  const [showWatchTogether, setShowWatchTogether] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
const remoteStreamRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const callTimerRef = useRef(null);
  const isCaller = useRef(false);
  const canvasRef = useRef(null);
  const filterRef = useRef("none");

  const coupleId = coupleData?.id;
  const callRef = coupleId ? doc(db, "couples", coupleId, "videoCall", "current") : null;
  const offerRef = coupleId ? doc(db, "couples", coupleId, "videoSignals", "offer") : null;
  const answerRef = coupleId ? doc(db, "couples", coupleId, "videoSignals", "answer") : null;
  const callerCandRef = coupleId ? doc(db, "couples", coupleId, "videoSignals", "callerCandidates") : null;
  const calleeCandRef = coupleId ? doc(db, "couples", coupleId, "videoSignals", "calleeCandidates") : null;

  // Get partner
  useEffect(() => {
    if (!coupleData?.members || coupleData.members.length < 2) return;
    const partnerUid = coupleData.members.find(id => id !== user.uid);
    if (!partnerUid) return;
    getDoc(doc(db, "users", partnerUid)).then(snap => {
      if (snap.exists()) setPartner({ uid: partnerUid, ...snap.data() });
    });
  }, [coupleData, user]);

  // Listen to call state
  useEffect(() => {
    if (!callRef) return;
    const unsub = onSnapshot(callRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setCallData(data);
      if (data.status === "calling" && data.callerId !== user.uid && callStatus === "idle") {
        setCallStatus("ringing");
      }
      if (data.status === "ended" && callStatus === "connected") {
        endCall(false);
      }
      if (data.status === "declined" && isCaller.current) {
        endCall(false);
        setError("Call declined 💔");
        setTimeout(() => setError(""), 3000);
      }
      if (data.handRaised && data.handRaisedBy !== user.uid) {
        setPartnerHandRaised(true);
        setTimeout(() => setPartnerHandRaised(false), 5000);
      }
    });
    return () => unsub();
  }, [callStatus, coupleId, user.uid]);

  // Listen to chat
  useEffect(() => {
    if (!coupleId || callStatus !== "connected") return;
    const q = query(
      collection(db, "couples", coupleId, "videoChat"),
      orderBy("createdAt", "asc"),
      limit(50)
    );
    return onSnapshot(q, snap => {
      setChatMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [coupleId, callStatus]);

  // Apply filter to video using canvas
  useEffect(() => {
    filterRef.current = selectedFilter;
    if (localVideoRef.current) {
      const filter = FILTERS.find(f => f.id === selectedFilter)?.css || "none";
      localVideoRef.current.style.filter = filter;
    }
  }, [selectedFilter]);

  useEffect(() => {
    if ((callStatus === "connected" || callStatus === "connecting") && remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }
  }, [callStatus]);

  // Local stream effect
  useEffect(() => {
    if ((callStatus === "connected" || callStatus === "connecting") && localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [callStatus]);

  // Cleanup
  const cleanup = useCallback(async () => {
    clearInterval(callTimerRef.current);
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current = null;
    screenStreamRef.current = null;
    setScreenSharing(false);
    try {
      await deleteDoc(offerRef);
      await deleteDoc(answerRef);
      await deleteDoc(callerCandRef);
      await deleteDoc(calleeCandRef);
    } catch { }
  }, [coupleId]);

  const endCall = useCallback(async (notify = true) => {
    if (notify && callRef) {
      try { await updateDoc(callRef, { status: "ended" }); } catch { }
    }
    await cleanup();
    setCallStatus("idle");
    setDuration(0);
    setMuted(false);
    setCameraOff(false);
    setHandRaised(false);
    setPartnerHandRaised(false);
    setChatMessages([]);
    isCaller.current = false;
  }, [cleanup]);

  // Get media stream
  const getStream = async () => {
    const q = QUALITY.find(q => q.id === quality);
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: q.width, height: q.height, frameRate: q.frameRate },
      audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
    });
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.style.filter = FILTERS.find(f => f.id === selectedFilter)?.css || "none";
    }
    return stream;
  };

  // Create peer connection
  const createPC = (stream) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    pc.ontrack = (e) => {
      remoteStreamRef.current = e.streams[0];
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setCallStatus("connected");
        callTimerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      }
      if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        endCall(false);
        setError("Connection lost. Please try again.");
        setTimeout(() => setError(""), 3000);
      }
    };
    return pc;
  };

  // Start call
  const startCall = async () => {
    setError("");
    setCallStatus("calling");
    isCaller.current = true;
    try {
      await setDoc(callRef, {
        status: "calling",
        callerId: user.uid,
        callerName: userData.displayName,
        startedAt: serverTimestamp(),
      });
      const stream = await getStream();
      const pc = createPC(stream);
      const callerCandidates = [];
      pc.onicecandidate = async (e) => {
        if (e.candidate) {
          callerCandidates.push(e.candidate.toJSON());
          await setDoc(callerCandRef, { candidates: callerCandidates });
        }
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await setDoc(offerRef, { sdp: offer.sdp, type: offer.type });

      onSnapshot(answerRef, async (snap) => {
        if (!snap.exists() || pc.currentRemoteDescription) return;
        await pc.setRemoteDescription(new RTCSessionDescription(snap.data()));
      });
      onSnapshot(calleeCandRef, async (snap) => {
        if (!snap.exists()) return;
        for (const c of snap.data().candidates || []) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { }
        }
      });

      // Auto cancel after 45s
      setTimeout(() => {
        if (callStatus === "calling") {
          endCall(true);
          setError("No answer 💔");
          setTimeout(() => setError(""), 3000);
        }
      }, 45000);
    } catch (err) {
      setError(err.message);
      setCallStatus("idle");
      await cleanup();
    }
  };

  // Answer call
  const answerCall = async () => {
    setError("");
    setCallStatus("connecting");
    isCaller.current = false;
    try {
      await updateDoc(callRef, { status: "connected" });
      const stream = await getStream();
      const pc = createPC(stream);
      const calleeCandidates = [];
      pc.onicecandidate = async (e) => {
        if (e.candidate) {
          calleeCandidates.push(e.candidate.toJSON());
          await setDoc(calleeCandRef, { candidates: calleeCandidates });
        }
      };
      const offerSnap = await getDoc(offerRef);
      if (!offerSnap.exists()) throw new Error("Call offer not found.");
      await pc.setRemoteDescription(new RTCSessionDescription(offerSnap.data()));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await setDoc(answerRef, { sdp: answer.sdp, type: answer.type });
      onSnapshot(callerCandRef, async (snap) => {
        if (!snap.exists()) return;
        for (const c of snap.data().candidates || []) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { }
        }
      });
    } catch (err) {
      setError(err.message);
      setCallStatus("idle");
      await cleanup();
    }
  };

  // Screen share
  const toggleScreenShare = async () => {
    if (screenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      setScreenSharing(false);
      // Switch back to camera
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (videoTrack && pcRef.current) {
        const sender = pcRef.current.getSenders().find(s => s.track?.kind === "video");
        if (sender) await sender.replaceTrack(videoTrack);
      }
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: "always" },
          audio: true,
        });
        screenStreamRef.current = screenStream;
        setScreenSharing(true);
        const screenTrack = screenStream.getVideoTracks()[0];
        if (pcRef.current) {
          const sender = pcRef.current.getSenders().find(s => s.track?.kind === "video");
          if (sender) await sender.replaceTrack(screenTrack);
        }
        if (screenVideoRef.current) screenVideoRef.current.srcObject = screenStream;
        screenTrack.onended = () => toggleScreenShare();
      } catch (err) {
        if (!err.message.includes("cancelled")) setError("Screen share failed.");
      }
    }
  };

  // Screenshot
  const takeScreenshot = async () => {
    const canvas = document.createElement("canvas");
    const video = remoteVideoRef.current;
    if (!video) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
      const formData = new FormData();
      formData.append("file", blob);
      formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.secure_url && coupleId) {
        await addDoc(collection(db, "couples", coupleId, "memories"), {
          imageUrl: data.secure_url,
          caption: "📹 Video call screenshot",
          tag: "Special moment ✨",
          layout: "normal",
          filter: "none",
          senderId: user.uid,
          senderName: userData.displayName,
          createdAt: new Date(),
          reactions: {},
        });
        showReaction("📸");
      }
    }, "image/jpeg", 0.9);
  };

  // Toggle mute / camera
  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = muted; });
    setMuted(m => !m);
  };

  const toggleCamera = () => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = cameraOff; });
    setCameraOff(c => !c);
  };

  // React
  const showReaction = (emoji) => {
    const id = Date.now();
    setReactions(r => [...r, { id, emoji }]);
    setTimeout(() => setReactions(r => r.filter(x => x.id !== id)), 3000);
  };

  const sendReaction = async (emoji) => {
    showReaction(emoji);
    if (callRef) await updateDoc(callRef, { reaction: emoji, reactionBy: user.uid, reactionAt: serverTimestamp() }).catch(() => {});
  };

  // Raise hand
  const toggleHand = async () => {
    const newVal = !handRaised;
    setHandRaised(newVal);
    if (callRef) await updateDoc(callRef, { handRaised: newVal, handRaisedBy: user.uid }).catch(() => {});
  };

  // Send chat
  const sendChat = async () => {
    if (!chatInput.trim() || !coupleId) return;
    await addDoc(collection(db, "couples", coupleId, "videoChat"), {
      text: chatInput.trim(),
      senderName: userData.displayName,
      senderId: user.uid,
      createdAt: serverTimestamp(),
    });
    setChatInput("");
  };

  if (!coupleData?.partnerJoined) {
    return (
      <div className="min-h-screen bg-petal flex items-center justify-center p-4">
        <div className="bg-white/70 backdrop-blur-xl rounded-4xl shadow-soft border border-white/80 p-10 max-w-md w-full text-center space-y-4">
          <p className="text-5xl">📹</p>
          <h1 className="font-serif text-2xl text-softdark">Video Call</h1>
          <p className="text-sm text-softdark/50">Video calls are available once your partner joins.</p>
          <p className="font-mono text-xl font-bold text-plum tracking-widest">{coupleData?.inviteCode}</p>
          <Link to="/dashboard" className="block text-sm text-plum/50 hover:text-plum transition-colors">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-softdark flex flex-col">
      {/* ── Ringing ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {callStatus === "ringing" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-softdark/95 z-50 flex items-center justify-center">
            <div className="text-center space-y-6">
              <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.8, repeat: Infinity }}
                className="text-8xl">📹</motion.div>
              <p className="font-serif text-3xl text-white">Incoming Video Call</p>
              <p className="text-white/50">{callData?.callerName || "Your partner"} is calling ♥</p>
              <div className="flex gap-4 justify-center">
                <button onClick={() => { updateDoc(callRef, { status: "declined" }); setCallStatus("idle"); }}
                  className="w-16 h-16 rounded-full bg-red-500 text-white text-2xl flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg">✕</button>
                <button onClick={answerCall}
                  className="w-16 h-16 rounded-full bg-green-500 text-white text-2xl flex items-center justify-center hover:bg-green-600 transition-colors shadow-lg">📹</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Idle / pre-call screen ───────────────────────────────────────────── */}
     {callStatus === "idle" && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8 relative">
          <div className="absolute top-4 left-4">
            <Link to="/dashboard"
                className="flex items-center gap-2 text-white/50 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-2xl px-4 py-2 text-sm transition-all">
                ← Back
            </Link>
            </div>

          <div className="text-center space-y-4">
            <p className="text-7xl">📹</p>
            <h1 className="font-serif text-4xl text-white">Video Call</h1>
            <p className="text-white/50">HD call with {partner?.displayName || "your partner"}</p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-2xl px-5 py-3 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {/* Quality selector */}
          <div className="space-y-2 w-full max-w-xs">
            <p className="text-xs uppercase tracking-widest text-white/30 text-center">Video Quality</p>
            <div className="flex gap-2">
              {QUALITY.map(q => (
                <button key={q.id} onClick={() => setQuality(q.id)}
                  className={`flex-1 py-2 rounded-2xl text-xs font-medium transition-all border ${quality === q.id ? "bg-plum text-white border-plum" : "bg-white/10 text-white/60 border-white/10 hover:bg-white/20"}`}>
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={startCall}
            className="w-full max-w-xs py-4 rounded-2xl bg-gradient-to-r from-plum to-plum-light text-white font-medium shadow-plum hover:-translate-y-0.5 transition-all text-lg">
            📹 Start Call
          </button>
        </div>
      )}

      {/* ── Calling screen ───────────────────────────────────────────────────── */}
      {callStatus === "calling" && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-8">
          <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
            className="text-8xl">📹</motion.div>
          <p className="font-serif text-3xl text-white">Calling {partner?.displayName}...</p>
          <p className="text-white/40">Waiting for them to answer ♥</p>
          <div className="flex gap-2">
            {[0,1,2].map(i => (
              <motion.div key={i} className="w-3 h-3 rounded-full bg-white/30"
                animate={{ opacity: [0.3, 1, 0.3], y: [0, -6, 0] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
            ))}
          </div>
          <button onClick={() => endCall(true)}
            className="py-3 px-8 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors">
            Cancel Call
          </button>
        </div>
      )}

      {/* ── Active call ──────────────────────────────────────────────────────── */}
      {(callStatus === "connected" || callStatus === "connecting") && (
        <div className="flex-1 flex flex-col relative overflow-hidden">

          {/* Main video — remote */}
          <div className="flex-1 relative bg-black">
            <video ref={remoteVideoRef} autoPlay playsInline
              className="w-full h-full object-contain" />

            {/* Screen share overlay */}
            {screenSharing && (
              <video ref={screenVideoRef} autoPlay playsInline muted
                className="absolute inset-0 w-full h-full object-contain bg-black" />
            )}

            {/* Connecting overlay */}
            {callStatus === "connecting" && (
              <div className="absolute inset-0 flex items-center justify-center bg-softdark">
                <div className="text-center space-y-3">
                  <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-6xl">📹</motion.div>
                  <p className="text-white/60">Connecting...</p>
                </div>
              </div>
            )}

            {/* Local video PiP */}
            <div className={`absolute transition-all duration-300 ${pip ? "bottom-20 left-4 w-48 h-36" : "bottom-20 right-4 w-32 h-24"} rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl cursor-pointer`}
              onClick={() => setPip(p => !p)}>
              <video ref={localVideoRef} autoPlay playsInline muted
                className="w-full h-full object-contain"
                style={{ transform: mirrored ? "scaleX(-1)" : "scaleX(1)" }} />
              {cameraOff && (
                <div className="absolute inset-0 bg-softdark flex items-center justify-center">
                  <p className="text-white/50 text-xs">Camera off</p>
                </div>
              )}
              {/* Mirror toggle button */}
              <button
                onClick={(e) => { e.stopPropagation(); setMirrored(m => !m); }}
                className="absolute top-1 left-1 bg-black/40 rounded-full w-6 h-6 flex items-center justify-center text-xs text-white/70 hover:text-white transition-colors">
                ↔
              </button>
            </div>

            {/* Duration */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-sm rounded-full px-4 py-1.5 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-white text-sm font-mono">{formatDuration(duration)}</span>
            </div>

            {/* Partner hand raised */}
            <AnimatePresence>
              {partnerHandRaised && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="absolute top-16 left-1/2 -translate-x-1/2 bg-amber-500/80 backdrop-blur-sm rounded-2xl px-4 py-2 text-white text-sm">
                  ✋ {partner?.displayName} raised their hand
                </motion.div>
              )}
            </AnimatePresence>

            {/* Floating reactions */}
            <div className="absolute bottom-32 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none">
              <AnimatePresence>
                {reactions.map(r => (
                  <motion.div key={r.id}
                    initial={{ opacity: 0, scale: 0.5, y: 0 }}
                    animate={{ opacity: 1, scale: 1.5, y: -60 }}
                    exit={{ opacity: 0, y: -120 }}
                    transition={{ duration: 1.5 }}
                    className="text-3xl">
                    {r.emoji}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Filter indicator */}
            {selectedFilter !== "none" && (
              <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1 text-white text-xs">
                {FILTERS.find(f => f.id === selectedFilter)?.label}
              </div>
            )}

            {/* Hand raised indicator */}
            {handRaised && (
              <div className="absolute top-4 left-4 bg-amber-500/80 backdrop-blur-sm rounded-full px-3 py-1 text-white text-xs">
                ✋ Hand raised
              </div>
            )}
          </div>

          {/* Chat sidebar */}
          <AnimatePresence>
            {chatOpen && (
              <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                className="absolute right-0 top-0 bottom-0 w-64 md:w-72 bg-softdark/95 backdrop-blur-xl border-l border-white/10 flex flex-col z-20">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <p className="text-white font-medium text-sm">💬 Chat</p>
                  <button onClick={() => setChatOpen(false)} className="text-white/40 hover:text-white transition-colors">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {chatMessages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.senderId === user.uid ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs ${msg.senderId === user.uid ? "bg-plum text-white" : "bg-white/10 text-white"}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-white/10 flex gap-2">
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && sendChat()}
                    placeholder="Message..."
                    className="flex-1 bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-white text-xs placeholder-white/30" />
                  <button onClick={sendChat} className="bg-plum text-white rounded-xl px-3 py-2 text-xs">Send</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Controls */}
          <div className="bg-softdark/90 backdrop-blur-sm border-t border-white/10 px-4 py-4">

            {/* Reactions row */}
            <div className="flex justify-center gap-3 mb-4">
              {REACTIONS.map(r => (
                <button key={r} onClick={() => sendReaction(r)}
                  className="text-xl hover:scale-125 transition-transform">{r}</button>
              ))}
            </div>

            {/* Main controls */}
            <div className="flex items-center justify-center gap-2 md:gap-3 flex-wrap">
              {/* Mute */}
              <button onClick={toggleMute}
                className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-base md:text-lg transition-all ${muted ? "bg-red-500/30 text-red-400" : "bg-white/10 text-white hover:bg-white/20"}`}>
                {muted ? "🔇" : "🎤"}
              </button>

              {/* Camera */}
              <button onClick={toggleCamera}
                className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-base md:text-lg transition-all ${cameraOff ? "bg-red-500/30 text-red-400" : "bg-white/10 text-white hover:bg-white/20"}`}>
                {cameraOff ? "🚫" : "📹"}
              </button>

              {/* Screen share */}
              <button onClick={toggleScreenShare}
                className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-base md:text-lg transition-all ${screenSharing ? "bg-green-500/30 text-green-400" : "bg-white/10 text-white hover:bg-white/20"}`}>
                🖥️
              </button>

              {/* Filters */}
              <div className="relative">
                <button onClick={() => setShowFilters(f => !f)}
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-lg transition-all ${selectedFilter !== "none" ? "bg-plum/50 text-white" : "bg-white/10 text-white hover:bg-white/20"}`}>
                  🎨
                </button>
                <AnimatePresence>
                  {showFilters && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-softdark/95 backdrop-blur-xl rounded-2xl p-3 border border-white/10 w-64 grid grid-cols-4 gap-2 z-30">
                      {FILTERS.map(f => (
                        <button key={f.id} onClick={() => { setSelectedFilter(f.id); setShowFilters(false); }}
                          className={`py-2 px-1 rounded-xl text-xs transition-all ${selectedFilter === f.id ? "bg-plum text-white" : "bg-white/10 text-white/60 hover:bg-white/20"}`}>
                          {f.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Raise hand */}
              <button onClick={toggleHand}
                className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-base md:text-lg transition-all ${handRaised ? "bg-amber-500/30 text-amber-400" : "bg-white/10 text-white hover:bg-white/20"}`}>
                ✋
              </button>

              {/* Screenshot */}
              <button onClick={takeScreenshot}
                className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-base md:text-lg bg-white/10 text-white hover:bg-white/20 transition-all">
                📸
              </button>

              {/* Chat */}
              <button onClick={() => setChatOpen(c => !c)}
                className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-base md:text-lg transition-all ${chatOpen ? "bg-plum/50 text-white" : "bg-white/10 text-white hover:bg-white/20"}`}>
                💬
              </button>

              {/* End call */}
              <button onClick={() => endCall(true)}
                className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-red-500 text-white text-lg md:text-xl flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg hover:scale-105">
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
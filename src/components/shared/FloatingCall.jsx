import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  doc, setDoc, onSnapshot, deleteDoc,
  updateDoc, serverTimestamp, getDoc
} from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";

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

const formatDuration = (s) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

export default function FloatingCall() {
  const { user, userData, coupleData } = useAuth();
  const [callStatus, setCallStatus] = useState("idle");
  const [audioOnly, setAudioOnly] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callerName, setCallerName] = useState("");
  const [error, setError] = useState("");
  const [showButtons, setShowButtons] = useState(false);
  const [noAnswer, setNoAnswer] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const callTimerRef = useRef(null);
  const noAnswerTimerRef = useRef(null);
  const isCaller = useRef(false);
  const unsubAnswerRef = useRef(null);
  const unsubCandidatesRef = useRef(null);

  const coupleId = coupleData?.id;

  const refs = coupleId ? {
    callState:        doc(db, "couples", coupleId, "callState", "current"),
    offer:            doc(db, "couples", coupleId, "callSignals", "offer"),
    answer:           doc(db, "couples", coupleId, "callSignals", "answer"),
    callerCandidates: doc(db, "couples", coupleId, "callSignals", "callerCandidates"),
    calleeCandidates: doc(db, "couples", coupleId, "callSignals", "calleeCandidates"),
  } : null;

  // ── Cleanup everything ────────────────────────────────────────────────────
  const cleanup = useCallback(async () => {
    clearInterval(callTimerRef.current);
    clearTimeout(noAnswerTimerRef.current);
    unsubAnswerRef.current?.();
    unsubCandidatesRef.current?.();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current = null;
    if (refs) {
      try { await deleteDoc(refs.offer); } catch { }
      try { await deleteDoc(refs.answer); } catch { }
      try { await deleteDoc(refs.callerCandidates); } catch { }
      try { await deleteDoc(refs.calleeCandidates); } catch { }
    }
  }, [coupleId]);

  // ── End call ──────────────────────────────────────────────────────────────
  const endCall = useCallback(async (notify = true) => {
    if (notify && refs) {
      try { await updateDoc(refs.callState, { status: "ended" }); } catch { }
    }
    await cleanup();
    setCallStatus("idle");
    setCallDuration(0);
    setMinimized(false);
    setMuted(false);
    setCameraOff(false);
    setNoAnswer(false);
    setError("");
    isCaller.current = false;
  }, [cleanup]);

  // ── Listen to call state from Firebase ───────────────────────────────────
  useEffect(() => {
    if (!refs) return;
    const unsub = onSnapshot(refs.callState, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      if (data.status === "calling" && data.callerId !== user?.uid && callStatus === "idle") {
        setCallStatus("ringing");
        setCallerName(data.callerName || "Your partner");
        setAudioOnly(data.audioOnly || false);
      }
      if (data.status === "ended" && callStatus === "connected") {
        endCall(false);
      }
      if (data.status === "declined" && isCaller.current) {
        endCall(false);
        setError("Call was declined 💔");
        setTimeout(() => setError(""), 3000);
      }
    });
    return () => unsub();
  }, [callStatus, coupleId, user?.uid]);

  // ── Get media stream ──────────────────────────────────────────────────────
  const getStream = async (isAudioOnly) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: !isAudioOnly,
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch (err) {
      throw new Error("Camera/microphone access denied. Please allow permissions and try again.");
    }
  };

  // ── Create peer connection ────────────────────────────────────────────────
  const createPC = (stream) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    pc.ontrack = (e) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setCallStatus("connected");
        clearTimeout(noAnswerTimerRef.current);
        callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
      }
      if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        endCall(false);
        setError("Connection lost. Please try again.");
        setTimeout(() => setError(""), 3000);
      }
    };
    return pc;
  };

  // ── Start call ────────────────────────────────────────────────────────────
  const startCall = async (isAudioOnly) => {
    if (!refs) return;
    setError("");
    setAudioOnly(isAudioOnly);
    setCallStatus("calling");
    setShowButtons(false);
    isCaller.current = true;

    try {
      await setDoc(refs.callState, {
        status: "calling",
        callerId: user.uid,
        callerName: userData.displayName,
        audioOnly: isAudioOnly,
        startedAt: serverTimestamp(),
      });

      const stream = await getStream(isAudioOnly);
      const pc = createPC(stream);

      const callerCandidates = [];
      pc.onicecandidate = async (e) => {
        if (e.candidate) {
          callerCandidates.push(e.candidate.toJSON());
          await setDoc(refs.callerCandidates, { candidates: callerCandidates });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await setDoc(refs.offer, { sdp: offer.sdp, type: offer.type });

      unsubAnswerRef.current = onSnapshot(refs.answer, async (snap) => {
        if (!snap.exists() || pc.currentRemoteDescription) return;
        await pc.setRemoteDescription(new RTCSessionDescription(snap.data()));
      });

      unsubCandidatesRef.current = onSnapshot(refs.calleeCandidates, async (snap) => {
        if (!snap.exists()) return;
        for (const c of snap.data().candidates || []) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { }
        }
      });

      // Auto cancel after 45 seconds if no answer
      noAnswerTimerRef.current = setTimeout(() => {
        setNoAnswer(true);
        endCall(true);
        setError("No answer 💔");
        setTimeout(() => setError(""), 3000);
      }, 45000);

    } catch (err) {
      setError(err.message);
      setCallStatus("idle");
      await cleanup();
      setTimeout(() => setError(""), 4000);
    }
  };

  // ── Answer call ───────────────────────────────────────────────────────────
  const answerCall = async () => {
    if (!refs) return;
    setError("");
    setCallStatus("connecting");
    isCaller.current = false;

    try {
      await updateDoc(refs.callState, { status: "connected" });
      const stream = await getStream(audioOnly);
      const pc = createPC(stream);

      const calleeCandidates = [];
      pc.onicecandidate = async (e) => {
        if (e.candidate) {
          calleeCandidates.push(e.candidate.toJSON());
          await setDoc(refs.calleeCandidates, { candidates: calleeCandidates });
        }
      };

      const offerSnap = await getDoc(refs.offer);
      if (!offerSnap.exists()) throw new Error("Call offer not found. Please try again.");
      await pc.setRemoteDescription(new RTCSessionDescription(offerSnap.data()));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await setDoc(refs.answer, { sdp: answer.sdp, type: answer.type });

      unsubCandidatesRef.current = onSnapshot(refs.callerCandidates, async (snap) => {
        if (!snap.exists()) return;
        for (const c of snap.data().candidates || []) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { }
        }
      });

    } catch (err) {
      setError(err.message);
      setCallStatus("idle");
      await cleanup();
      setTimeout(() => setError(""), 4000);
    }
  };

  // ── Decline call ──────────────────────────────────────────────────────────
  const declineCall = async () => {
    if (!refs) return;
    try { await updateDoc(refs.callState, { status: "declined" }); } catch { }
    setCallStatus("idle");
  };

  // ── Toggle mute / camera ──────────────────────────────────────────────────
  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = muted; });
    setMuted(m => !m);
  };

  const toggleCamera = () => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = cameraOff; });
    setCameraOff(c => !c);
  };

  // ── Guard: no couple ──────────────────────────────────────────────────────
  if (!coupleId) return null;

  // ── Guard: partner not joined ─────────────────────────────────────────────
  if (!coupleData?.partnerJoined) return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-6 right-6 z-50">
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl px-4 py-3 shadow-soft border border-rose/20 text-center max-w-xs">
        <p className="text-xs text-softdark/50">📹 Calls available once your partner joins</p>
        <p className="font-mono text-xs font-bold text-plum mt-1 tracking-widest">{coupleData?.inviteCode}</p>
      </div>
    </motion.div>
  );

  return (
    <>
      {/* ── Error toast ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-white/90 backdrop-blur-xl rounded-2xl px-5 py-3 shadow-plum border border-rose/20">
            <p className="text-sm text-softdark text-center">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Idle — floating buttons ──────────────────────────────────────────── */}
      <AnimatePresence>
        {callStatus === "idle" && (
          <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">

            <AnimatePresence>
              {showButtons && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }} className="flex flex-col items-end gap-2">
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => startCall(true)}
                    className="bg-white/90 backdrop-blur-sm text-plum rounded-2xl px-4 py-2.5 text-xs font-medium shadow-soft border border-rose/20 hover:border-plum/30 hover:shadow-plum transition-all flex items-center gap-2">
                    <span>🎤</span> Voice Only
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => startCall(false)}
                    className="bg-white/90 backdrop-blur-sm text-plum rounded-2xl px-4 py-2.5 text-xs font-medium shadow-soft border border-rose/20 hover:border-plum/30 hover:shadow-plum transition-all flex items-center gap-2">
                    <span>📹</span> Video Call
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => setShowButtons(s => !s)}
              className="w-14 h-14 rounded-full bg-gradient-to-r from-plum to-plum-light text-white text-2xl flex items-center justify-center shadow-plum hover:shadow-glow transition-all">
              {showButtons ? "✕" : "📹"}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Ringing ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {callStatus === "ringing" && (
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            className="fixed bottom-6 right-6 z-50 bg-white/95 backdrop-blur-xl rounded-3xl shadow-plum border border-rose/20 p-6 w-72">
            <div className="text-center space-y-4">
              <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.8, repeat: Infinity }}
                className="text-6xl">{audioOnly ? "🎤" : "📹"}</motion.div>
              <div>
                <p className="font-serif text-xl text-softdark">
                  {audioOnly ? "Voice" : "Video"} Call
                </p>
                <p className="text-sm text-plum/70 mt-1 font-medium">{callerName} ♥</p>
                <p className="text-xs text-softdark/40 mt-1">is calling you...</p>
              </div>
              <div className="flex gap-3">
                <button onClick={declineCall}
                  className="flex-1 py-3 rounded-2xl bg-red-50 text-red-500 border border-red-100 text-sm font-medium hover:bg-red-100 transition-colors">
                  Decline
                </button>
                <button onClick={answerCall}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-plum to-plum-light text-white text-sm font-medium shadow-plum hover:-translate-y-0.5 transition-all">
                  Accept ♥
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Calling (waiting) ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {callStatus === "calling" && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-50 bg-softdark rounded-3xl shadow-2xl border border-white/10 p-6 w-72 text-center space-y-5">
            <div className="relative">
              <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                className="text-6xl">{audioOnly ? "🎤" : "📹"}</motion.div>
              <motion.div animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inset-0 rounded-full border-2 border-plum/30 m-4" />
            </div>
            <div>
              <p className="font-serif text-xl text-white">Calling...</p>
              <p className="text-xs text-white/40 mt-1">Waiting for your partner to answer ♥</p>
            </div>
            <div className="flex justify-center gap-1.5">
              {[0,1,2].map(i => (
                <motion.div key={i} className="w-2 h-2 rounded-full bg-white/30"
                  animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
              ))}
            </div>
            <button onClick={() => endCall(true)}
              className="w-full py-3 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/20 text-sm font-medium hover:bg-red-500/30 transition-colors">
              Cancel Call
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Active call ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {(callStatus === "connected" || callStatus === "connecting") && (
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-6 right-6 z-50 bg-softdark rounded-3xl shadow-2xl border border-white/10 overflow-hidden transition-all duration-300"
            style={{ width: minimized ? 220 : 360, height: minimized ? 56 : audioOnly ? 220 : 430 }}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-black/30 flex-shrink-0">
              <div className="flex items-center gap-2">
                <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-white/80 text-xs font-medium">
                  {callStatus === "connecting" ? "Connecting..." : formatDuration(callDuration)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setMinimized(m => !m)}
                  className="text-white/40 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-white/10 transition-colors">
                  {minimized ? "⬆" : "⬇"}
                </button>
                <button onClick={() => endCall(true)}
                  className="text-white/40 hover:text-red-400 text-xs px-2 py-1 rounded-lg hover:bg-white/10 transition-colors">
                  End ✕
                </button>
              </div>
            </div>

            {!minimized && (
              <>
                {/* Video */}
                {!audioOnly && (
                  <div className="relative bg-black" style={{ height: 280 }}>
                    <video ref={remoteVideoRef} autoPlay playsInline
                      className="w-full h-full object-cover" />
                    <div className="absolute bottom-3 right-3 w-24 h-20 rounded-xl overflow-hidden border-2 border-white/20 shadow-lg bg-softdark">
                      <video ref={localVideoRef} autoPlay playsInline muted
                        className="w-full h-full object-cover" />
                    </div>
                    {callStatus === "connecting" && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-softdark gap-3">
                        <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                          className="text-4xl">📹</motion.div>
                        <p className="text-white/60 text-sm">Connecting...</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Audio only */}
                {audioOnly && (
                  <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                      className="text-5xl">🎤</motion.div>
                    <p className="text-white/60 text-sm">Voice call active</p>
                    <p className="text-white/30 text-xs font-mono">{formatDuration(callDuration)}</p>
                  </div>
                )}

                {/* Controls */}
                <div className="flex items-center justify-center gap-4 py-3 bg-black/20">
                  <button onClick={toggleMute}
                    className={`w-11 h-11 rounded-full flex items-center justify-center text-lg transition-all ${
                      muted ? "bg-red-500/40 text-red-300" : "bg-white/10 text-white hover:bg-white/20"
                    }`}>
                    {muted ? "🔇" : "🎤"}
                  </button>
                  {!audioOnly && (
                    <button onClick={toggleCamera}
                      className={`w-11 h-11 rounded-full flex items-center justify-center text-lg transition-all ${
                        cameraOff ? "bg-red-500/40 text-red-300" : "bg-white/10 text-white hover:bg-white/20"
                      }`}>
                      {cameraOff ? "🚫" : "📹"}
                    </button>
                  )}
                  <button onClick={() => endCall(true)}
                    className="w-12 h-12 rounded-full bg-red-500 text-white text-xl flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg hover:scale-105">
                    ✕
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
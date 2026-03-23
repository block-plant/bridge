import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

// ── Constants ─────────────────────────────────────────────────────────────────
const REACTIONS = ["❤️", "😍", "🥰", "😭", "✨"];
const TAGS = ["First date 💕", "Adventure 🌍", "Milestone 🎉", "Everyday ☀️", "Missing you 🥺", "Special moment ✨"];
const LAYOUTS = [
  { id: "normal", label: "Normal" },
  { id: "polaroid", label: "Polaroid" },
  { id: "vintage", label: "Vintage" },
  { id: "film", label: "Film" },
];
const FILTERS = [
  { id: "none", label: "None", css: "none" },
  { id: "grayscale", label: "B&W", css: "grayscale(100%)" },
  { id: "sepia", label: "Sepia", css: "sepia(80%)" },
  { id: "warm", label: "Warm", css: "saturate(150%) hue-rotate(-20deg) brightness(1.1)" },
  { id: "cool", label: "Cool", css: "saturate(80%) hue-rotate(20deg) brightness(1.05)" },
  { id: "faded", label: "Faded", css: "contrast(85%) brightness(1.1) saturate(80%)" },
  { id: "dreamy", label: "Dreamy", css: "brightness(1.15) saturate(120%) contrast(90%)" },
];

// ── Upload to Cloudinary ──────────────────────────────────────────────────────
const uploadToCloudinary = async (blob) => {
  const formData = new FormData();
  formData.append("file", blob);
  formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );
  const data = await res.json();
  if (!data.secure_url) throw new Error(data.error?.message || "Upload failed");
  return data.secure_url;
};

// ── Memory Card ───────────────────────────────────────────────────────────────
const MemoryCard = ({ memory, isMe, onReact, onDelete }) => {
  const filterCss = FILTERS.find(f => f.id === memory.filter)?.css || "none";

  const imageEl = (
    <img src={memory.imageUrl} alt={memory.caption}
      className="w-full h-48 object-cover"
      style={{ filter: filterCss }} />
  );

  const cardInner = (
    <div className="p-4 space-y-3">
      {memory.caption && <p className="text-sm text-softdark leading-relaxed">{memory.caption}</p>}
      {memory.tag && (
        <span className="inline-block text-xs px-3 py-1 bg-rose/10 text-plum rounded-full border border-rose/20">
          {memory.tag}
        </span>
      )}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {REACTIONS.map((r) => (
            <button key={r} onClick={() => onReact(memory.id, r)}
              className={`text-lg rounded-xl p-1 transition-all hover:scale-110 ${memory.reactions?.[r] > 0 ? "bg-rose/20" : "hover:bg-rose/10"}`}>
              {r}
            </button>
          ))}
        </div>
        <span className="text-xs text-softdark/30">
          {memory.createdAt?.toDate?.()?.toLocaleDateString?.() || ""}
        </span>
      </div>
      {Object.entries(memory.reactions || {}).some(([, v]) => v > 0) && (
        <div className="flex gap-2 flex-wrap">
          {Object.entries(memory.reactions || {}).map(([emoji, count]) =>
            count > 0 ? (
              <span key={emoji} className="text-xs bg-rose/10 rounded-full px-2 py-0.5 text-softdark/60">
                {emoji} {count}
              </span>
            ) : null
          )}
        </div>
      )}
    </div>
  );

  const handleDownload = async () => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = memory.imageUrl;
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.filter = filterCss;
    ctx.drawImage(img, 0, 0);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/jpeg", 0.95);
    a.download = `memory-${memory.id}.jpg`;
    a.click();
  };
};

const deleteBtn = isMe && (
  <div className="absolute top-3 right-3 flex gap-1 z-10">
    <button onClick={handleDownload}
      className="bg-white/80 backdrop-blur-sm rounded-full w-7 h-7 flex items-center justify-center text-xs text-softdark/50 hover:text-plum transition-colors">
      ⬇️
    </button>
    <button onClick={() => onDelete(memory.id)}
      className="bg-white/80 backdrop-blur-sm rounded-full w-7 h-7 flex items-center justify-center text-xs text-softdark/50 hover:text-red-400 transition-colors">
      ✕
    </button>
  </div>
);

  const senderBadge = (
    <div className="absolute bottom-3 left-3">
      <span className="bg-white/80 backdrop-blur-sm rounded-full px-2 py-1 text-xs text-softdark/60">
        {memory.senderName}
      </span>
    </div>
  );

  // ── Polaroid layout ────────────────────────────────────────────────────────
  if (memory.layout === "polaroid") {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-3 pb-10 shadow-lg rounded-sm"
        style={{ transform: `rotate(${memory.rotation || 0}deg)` }}>
        <div className="relative overflow-hidden">
          {imageEl}
          {deleteBtn}
        </div>
        <div className="pt-3 text-center">
          <p className="font-serif text-sm text-softdark/70 italic">{memory.caption || memory.senderName}</p>
        </div>
      </motion.div>
    );
  }

  // ── Vintage layout ─────────────────────────────────────────────────────────
  if (memory.layout === "vintage") {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="border-4 border-amber-200 bg-amber-50 rounded-sm shadow-md">
        <div className="relative overflow-hidden">
          <img src={memory.imageUrl} alt={memory.caption}
            className="w-full h-48 object-cover"
            style={{ filter: "sepia(40%) contrast(90%) brightness(1.05)" }} />
          {deleteBtn}
          {senderBadge}
        </div>
        {cardInner}
      </motion.div>
    );
  }

  // ── Film layout ────────────────────────────────────────────────────────────
  if (memory.layout === "film") {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-900 rounded-lg shadow-xl overflow-hidden">
        <div className="flex justify-between px-2 py-1">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="w-3 h-3 rounded-sm bg-gray-700" />
          ))}
        </div>
        <div className="relative mx-2">
          <img src={memory.imageUrl} alt={memory.caption}
            className="w-full h-48 object-cover"
            style={{ filter: filterCss }} />
          {deleteBtn}
        </div>
        <div className="flex justify-between px-2 py-1 mb-1">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="w-3 h-3 rounded-sm bg-gray-700" />
          ))}
        </div>
        <div className="bg-gray-900 px-3 pb-3">
          <p className="text-gray-300 text-xs font-mono">{memory.caption}</p>
          <p className="text-gray-500 text-xs font-mono mt-1">{memory.senderName}</p>
        </div>
      </motion.div>
    );
  }

  // ── Normal layout (default) ────────────────────────────────────────────────
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      className="bg-white/70 backdrop-blur-sm rounded-3xl overflow-hidden border border-white/80 shadow-soft">
      <div className="relative">
        {imageEl}
        {deleteBtn}
        {senderBadge}
      </div>
      {cardInner}
    </motion.div>
  );
};

// ── Main Scrapbook ────────────────────────────────────────────────────────────
export default function Scrapbook() {
  const { user, userData, coupleData } = useAuth();
  const [memories, setMemories] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [tag, setTag] = useState("");
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState("normal");
  const [selectedFilter, setSelectedFilter] = useState("none");
  const [cameraMode, setCameraMode] = useState(false);
  const [mirrored, setMirrored] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  const coupleId = coupleData?.id;

  useEffect(() => {
    if (!coupleId) return;
    const q = query(collection(db, "couples", coupleId, "memories"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setMemories(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [coupleId]);

  // ── Camera ────────────────────────────────────────────────────────────────
  const startCamera = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    streamRef.current = stream;
    setCameraMode(true);
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    }, 100);
  } catch {
    alert("Could not access camera. Please allow camera permission.");
  }
};

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    setCameraMode(false);
  };

  const takePhoto = () => {
  const canvas = canvasRef.current;
  const video = videoRef.current;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (mirrored) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0);
  canvas.toBlob((blob) => {
    setFile(blob);
    setPreview(URL.createObjectURL(blob));
    stopCamera();
  }, "image/jpeg", 0.9);
};

  const handleFileSelect = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const handleUpload = async () => {
    if (!file || uploading) return;
    setUploading(true);
    try {
      const imageUrl = await uploadToCloudinary(file);
      await addDoc(collection(db, "couples", coupleId, "memories"), {
        imageUrl,
        caption: caption.trim(),
        tag,
        layout: selectedLayout,
        filter: selectedFilter,
        rotation: selectedLayout === "polaroid" ? (Math.random() * 6 - 3).toFixed(1) : 0,
        senderId: user.uid,
        senderName: userData.displayName,
        createdAt: new Date(),
        reactions: {},
      });
      setFile(null); setPreview(null); setCaption(""); setTag("");
      setSelectedLayout("normal"); setSelectedFilter("none");
      setShowUpload(false);
    } catch (err) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleReact = async (memoryId, emoji) => {
    const memRef = doc(db, "couples", coupleId, "memories", memoryId);
    const memory = memories.find((m) => m.id === memoryId);
    const current = memory?.reactions?.[emoji] || 0;
    await updateDoc(memRef, { [`reactions.${emoji}`]: current + 1 });
  };

  const handleDelete = async (memoryId) => {
    if (!confirm("Delete this memory?")) return;
    await deleteDoc(doc(db, "couples", coupleId, "memories", memoryId));
  };

  const resetUpload = () => {
    setShowUpload(false);
    setPreview(null);
    setFile(null);
    stopCamera();
  };

  const filterCss = FILTERS.find(f => f.id === selectedFilter)?.css || "none";

  return (
    <div className="page-enter min-h-screen bg-petal">
      {/* Header */}
      <div className="bg-white/60 backdrop-blur-md border-b border-rose/20 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard"
              className="text-plum/50 hover:text-plum bg-white/50 rounded-2xl px-3 py-2 border border-rose/20 transition-colors text-sm">
              ← Back
            </Link>
            <div>
              <h1 className="font-serif text-2xl text-softdark">Our Scrapbook 📸</h1>
              <p className="text-xs text-softdark/40">{memories.length} memories together</p>
            </div>
          </div>
          <button onClick={() => setShowUpload(true)}
            className="bg-gradient-to-r from-plum to-plum-light text-white rounded-2xl px-4 py-2 text-sm font-medium hover:-translate-y-0.5 transition-all shadow-plum">
            + Add Memory
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        {memories.length === 0 && (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">📸</p>
            <p className="font-serif text-2xl text-softdark">No memories yet</p>
            <p className="text-sm text-softdark/40 mt-2">Start adding photos to your shared scrapbook ♥</p>
            <button onClick={() => setShowUpload(true)}
              className="mt-6 bg-gradient-to-r from-plum to-plum-light text-white rounded-2xl px-6 py-3 text-sm font-medium hover:-translate-y-0.5 transition-all shadow-plum">
              Add your first memory
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {memories.map((memory) => (
            <MemoryCard key={memory.id} memory={memory}
              isMe={memory.senderId === user.uid}
              onReact={handleReact} onDelete={handleDelete} />
          ))}
        </div>
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUpload && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-softdark/20 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white/90 backdrop-blur-xl rounded-4xl shadow-plum p-6 w-full max-w-sm space-y-4 my-4">

              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl text-softdark">Add a memory</h2>
                <button onClick={resetUpload} className="text-softdark/40 hover:text-softdark text-lg">✕</button>
              </div>

              {/* Camera view */}
              {cameraMode ? (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden">
                    <video ref={videoRef} autoPlay playsInline
                    className="w-full h-48 object-cover"
                    style={{ filter: filterCss, transform: mirrored ? "scaleX(-1)" : "scaleX(1)" }} />
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                <button onClick={() => setMirrored(m => !m)}
                className="absolute top-2 left-2 bg-white/80 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-softdark/60 hover:text-plum transition-colors">
                {mirrored ? "↔️ Mirrored" : "↔️ Mirror"}
                </button>
                  <div className="flex gap-2">
                    <button onClick={takePhoto}
                      className="flex-1 bg-gradient-to-r from-plum to-plum-light text-white rounded-2xl py-3 text-sm font-medium">
                      📸 Capture
                    </button>
                    <button onClick={stopCamera}
                      className="px-4 bg-rose/20 text-plum rounded-2xl py-3 text-sm">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Photo picker */}
                  {!preview ? (
                    <div className="flex gap-2">
                      <button onClick={() => document.getElementById("file-input").click()}
                        className="flex-1 border-2 border-dashed border-rose/30 rounded-3xl p-5 text-center hover:border-plum/30 transition-colors">
                        <p className="text-2xl mb-1">🖼️</p>
                        <p className="text-xs text-softdark/50">Upload photo</p>
                      </button>
                      <button onClick={startCamera}
                        className="flex-1 border-2 border-dashed border-rose/30 rounded-3xl p-5 text-center hover:border-plum/30 transition-colors">
                        <p className="text-2xl mb-1">📷</p>
                        <p className="text-xs text-softdark/50">Take photo</p>
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <img src={preview} alt="preview"
                        className="w-full h-40 object-cover rounded-2xl"
                        style={{ filter: filterCss }} />
                      <button onClick={() => { setPreview(null); setFile(null); }}
                        className="absolute top-2 right-2 bg-white/80 rounded-full w-7 h-7 flex items-center justify-center text-xs text-softdark/50 hover:text-red-400">
                        ✕
                      </button>
                    </div>
                  )}
                  <input id="file-input" type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />

                  {/* Filters */}
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-plum/50 mb-2">Filter</label>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {FILTERS.map((f) => (
                        <button key={f.id} onClick={() => setSelectedFilter(f.id)}
                          className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-all ${selectedFilter === f.id ? "bg-plum text-white border-plum" : "bg-white text-softdark/60 border-rose/30"}`}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Layout */}
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-plum/50 mb-2">Layout</label>
                    <div className="flex gap-2">
                      {LAYOUTS.map((l) => (
                        <button key={l.id} onClick={() => setSelectedLayout(l.id)}
                          className={`flex-1 text-xs py-2 rounded-2xl border transition-all ${selectedLayout === l.id ? "bg-plum text-white border-plum" : "bg-white text-softdark/60 border-rose/30"}`}>
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Caption */}
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-plum/50 mb-1.5">Caption</label>
                    <input value={caption} onChange={(e) => setCaption(e.target.value)}
                      placeholder="What's the story behind this? ♥"
                      className="w-full bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark" />
                  </div>

                  {/* Tag */}
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-plum/50 mb-2">Tag</label>
                    <div className="flex flex-wrap gap-2">
                      {TAGS.map((t) => (
                        <button key={t} onClick={() => setTag(tag === t ? "" : t)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${tag === t ? "bg-plum text-white border-plum" : "bg-white text-softdark/60 border-rose/30 hover:border-plum/30"}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button onClick={handleUpload} disabled={!file || uploading}
                    className="w-full bg-gradient-to-r from-plum to-plum-light text-white rounded-2xl py-3 text-sm font-medium disabled:opacity-40 hover:-translate-y-0.5 transition-all shadow-plum">
                    {uploading ? "Uploading... 📤" : "Save Memory ✨"}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection, addDoc, onSnapshot, query,
  orderBy, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { formatDistanceToNow, format } from "date-fns";

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatTime = (timestamp) => {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return format(date, "hh:mm a");
};

const formatDate = (timestamp) => {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return formatDistanceToNow(date, { addSuffix: true });
};

// ── Message Bubble ────────────────────────────────────────────────────────────
const MessageBubble = ({ message, isMe }) => (
  <motion.div
    initial={{ opacity: 0, y: 10, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    className={`flex ${isMe ? "justify-end" : "justify-start"} mb-3`}
  >
    <div className={`max-w-[75vw] md:max-w-sm ${isMe ? "items-end" : "items-start"} flex flex-col gap-1`}>
      <div className={`px-4 py-3 rounded-3xl text-sm leading-relaxed ${
        isMe
          ? "bg-gradient-to-br from-plum to-plum-light text-white rounded-br-sm"
          : "bg-white/80 text-softdark border border-rose/20 rounded-bl-sm"
      }`}>
        {message.text}
      </div>
      <span className="text-xs text-softdark/30 px-1">{formatTime(message.createdAt)}</span>
    </div>
  </motion.div>
);

// ── Love Note Card ────────────────────────────────────────────────────────────
const LoveNoteCard = ({ note, isMe }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className={`bg-gradient-to-br ${isMe ? "from-rose/20 to-blush/30" : "from-blush/30 to-rose/10"} 
      rounded-3xl p-4 border border-rose/20 relative overflow-hidden`}
  >
    <div className="absolute top-2 right-3 text-rose/20 text-4xl font-serif">"</div>
    <p className="text-sm text-softdark leading-relaxed italic">{note.text}</p>
    <div className="flex items-center justify-between mt-3">
      <span className="text-xs text-plum/60 font-medium">— {note.senderName}</span>
      <span className="text-xs text-softdark/30">{formatDate(note.createdAt)}</span>
    </div>
  </motion.div>
);

// ── Main Messages Page ────────────────────────────────────────────────────────
export default function Messages() {
  const { user, userData, coupleData } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loveNotes, setLoveNotes] = useState([]);
  const [input, setInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [tab, setTab] = useState("chat"); // chat | notes
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const coupleId = coupleData?.id;

  // ── Listen to messages ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!coupleId) return;
    const q = query(
      collection(db, "couples", coupleId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [coupleId]);

  // ── Listen to love notes ────────────────────────────────────────────────────
  useEffect(() => {
    if (!coupleId) return;
    const q = query(
      collection(db, "couples", coupleId, "loveNotes"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setLoveNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [coupleId]);

  // ── Auto scroll to bottom ───────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = async () => {
  if (!input.trim() || sending) return;
  const text = input.trim();
  setInput("");
  setSending(true);
  try {
    await addDoc(collection(db, "couples", coupleId, "messages"), {
      text,
      senderId: user.uid,
      senderName: userData.displayName,
      createdAt: serverTimestamp(),
        });
    } catch {
        setInput(text);
    } finally {
        setSending(false);
    }
    };

  // ── Send love note ──────────────────────────────────────────────────────────
  const sendLoveNote = async () => {
    if (!noteInput.trim() || sending) return;
    setSending(true);
    try {
      await addDoc(collection(db, "couples", coupleId, "loveNotes"), {
        text: noteInput.trim(),
        senderId: user.uid,
        senderName: userData.displayName,
        createdAt: serverTimestamp(),
      });
      setNoteInput("");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e, fn) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); fn(); }
  };

  return (
    <div className="page-enter min-h-screen bg-petal flex flex-col">
      {/* Header */}
      <div className="bg-white/60 backdrop-blur-md border-b border-rose/20 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
        <Link to="/dashboard"
            className="text-plum/50 hover:text-plum bg-white/50 rounded-2xl px-3 py-2 border border-rose/20 transition-colors text-sm">
            ← Back
        </Link>
        <div>
            <h1 className="font-serif text-2xl text-softdark">
            {userData?.displayName} <span className="text-rose">♥</span>
            </h1>
            <p className="text-xs text-softdark/40">Private messages — just the two of you</p>
        </div>
        </div>
          {/* Tabs */}
          <div className="flex bg-rose/10 rounded-2xl p-1 gap-1">
            {["chat", "notes"].map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  tab === t ? "bg-white text-plum shadow-soft" : "text-softdark/50 hover:text-plum"
                }`}>
                {t === "chat" ? "💬 Chat" : "📌 Notes"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full flex flex-col">
        <AnimatePresence mode="wait">

          {/* ── Chat Tab ────────────────────────────────────────────────────── */}
          {tab === "chat" && (
            <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 flex flex-col">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
                {messages.length === 0 && (
                  <div className="text-center py-20">
                    <p className="text-4xl mb-3">💬</p>
                    <p className="font-serif text-xl text-softdark">Start your conversation</p>
                    <p className="text-sm text-softdark/40 mt-1">Every great love story starts with hello ♥</p>
                  </div>
                )}
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} isMe={msg.senderId === user.uid} />
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-4 bg-white/40 backdrop-blur-sm border-t border-rose/20">
                <div className="flex gap-3 items-end">
                  <textarea value={input} onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, sendMessage)}
                    placeholder="Say something sweet... ♥"
                    rows={1}
                    className="flex-1 bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark placeholder-softdark/30 resize-none focus:border-plum/40 transition-all"
                  />
                  <button onClick={sendMessage} disabled={!input.trim() || sending}
                    className="bg-gradient-to-r from-plum to-plum-light text-white rounded-2xl px-5 py-3 text-sm font-medium disabled:opacity-40 hover:-translate-y-0.5 transition-all shadow-plum">
                    Send
                  </button>
                </div>
                <p className="text-xs text-softdark/30 mt-2 text-center hidden sm:block">Press Enter to send</p>
              </div>
            </motion.div>
          )}

          {/* ── Love Notes Tab ───────────────────────────────────────────────── */}
          {tab === "notes" && (
            <motion.div key="notes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 flex flex-col">
              {/* Notes input */}
              <div className="px-4 py-4 border-b border-rose/20 bg-white/40 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-widest text-plum/50 mb-2">Leave a love note</p>
                <div className="flex gap-3 items-end">
                  <textarea value={noteInput} onChange={(e) => setNoteInput(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, sendLoveNote)}
                    placeholder="Write something from the heart..."
                    rows={2}
                    className="flex-1 bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark placeholder-softdark/30 resize-none focus:border-plum/40 transition-all"
                  />
                  <button onClick={sendLoveNote} disabled={!noteInput.trim() || sending}
                    className="bg-gradient-to-r from-plum to-plum-light text-white rounded-2xl px-5 py-3 text-sm font-medium disabled:opacity-40 hover:-translate-y-0.5 transition-all shadow-plum">
                    Pin 📌
                  </button>
                </div>
              </div>

              {/* Notes list */}
              <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
                {loveNotes.length === 0 && (
                  <div className="text-center py-20">
                    <p className="text-4xl mb-3">📌</p>
                    <p className="font-serif text-xl text-softdark">No love notes yet</p>
                    <p className="text-sm text-softdark/40 mt-1">Leave something sweet for them to find ♥</p>
                  </div>
                )}
                {loveNotes.map((note) => (
                  <LoveNoteCard key={note.id} note={note} isMe={note.senderId === user.uid} />
                ))}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
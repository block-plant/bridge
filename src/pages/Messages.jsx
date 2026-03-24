import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection, addDoc, onSnapshot, query,
  orderBy, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { format, isToday, isYesterday, isThisWeek } from "date-fns";

// ── Date Helpers ──────────────────────────────────────────────────────────────
const getMessageDate = (timestamp) => {
  if (!timestamp) return null;
  return timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
};

const formatTime = (timestamp) => {
  const date = getMessageDate(timestamp);
  if (!date) return "";
  return format(date, "hh:mm a");
};

const formatDateHeader = (date) => {
  if (!date) return "";
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  if (isThisWeek(date)) return format(date, "EEEE"); // Monday, Tuesday etc.
  return format(date, "dd MMM yyyy"); // 12 Jan 2025
};

const isSameDay = (date1, date2) => {
  if (!date1 || !date2) return false;
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

const formatNoteDate = (timestamp) => {
  const date = getMessageDate(timestamp);
  if (!date) return "";
  if (isToday(date)) return `Today at ${format(date, "hh:mm a")}`;
  if (isYesterday(date)) return `Yesterday at ${format(date, "hh:mm a")}`;
  return format(date, "dd MMM, hh:mm a");
};

// ── Date Header ───────────────────────────────────────────────────────────────
const DateHeader = ({ date }) => (
  <div className="flex items-center justify-center my-4">
    <div className="bg-rose/20 text-softdark/50 text-xs px-3 py-1 rounded-full font-medium">
      {formatDateHeader(date)}
    </div>
  </div>
);

// ── Message Bubble ────────────────────────────────────────────────────────────
const MessageBubble = ({ message, isMe }) => (
  <motion.div
    initial={{ opacity: 0, y: 10, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    className={`flex ${isMe ? "justify-end" : "justify-start"} mb-1`}
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
      <span className="text-xs text-softdark/30">{formatNoteDate(note.createdAt)}</span>
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
  const [tab, setTab] = useState("chat");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

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

  // ── Auto resize textarea ────────────────────────────────────────────────────
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input]);

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
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

  // ── Build messages with date headers ───────────────────────────────────────
  const messagesWithDates = [];
  let lastDate = null;
  for (const msg of messages) {
    const msgDate = getMessageDate(msg.createdAt);
    if (msgDate && !isSameDay(msgDate, lastDate)) {
      messagesWithDates.push({ type: "date", date: msgDate, id: `date-${msg.id}` });
      lastDate = msgDate;
    }
    messagesWithDates.push({ type: "message", ...msg });
  }

  return (
    // ── Key fix: use h-screen + flex col so input never moves ─────────────────
    <div className="h-screen flex flex-col bg-petal overflow-hidden">

      {/* Header — fixed at top */}
      <div className="bg-white/60 backdrop-blur-md border-b border-rose/20 px-4 py-4 flex-shrink-0 z-10">
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

      {/* Body — fills remaining height */}
      <div className="flex-1 max-w-2xl mx-auto w-full flex flex-col min-h-0">
        <AnimatePresence mode="wait">

          {/* ── Chat Tab ──────────────────────────────────────────────────────── */}
          {tab === "chat" && (
            <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 flex flex-col min-h-0">

              {/* Scrollable messages area */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {messages.length === 0 && (
                  <div className="text-center py-20">
                    <p className="text-4xl mb-3">💬</p>
                    <p className="font-serif text-xl text-softdark">Start your conversation</p>
                    <p className="text-sm text-softdark/40 mt-1">Every great love story starts with hello ♥</p>
                  </div>
                )}
                {messagesWithDates.map((item) =>
                  item.type === "date"
                    ? <DateHeader key={item.id} date={item.date} />
                    : <MessageBubble key={item.id} message={item} isMe={item.senderId === user.uid} />
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input — pinned to bottom, never moves */}
              <div className="flex-shrink-0 px-4 py-3 bg-white/60 backdrop-blur-sm border-t border-rose/20">
                <div className="flex gap-3 items-end">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, sendMessage)}
                    placeholder="Say something sweet... ♥"
                    rows={1}
                    style={{ height: "auto", minHeight: "44px", maxHeight: "120px" }}
                    className="flex-1 bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark placeholder-softdark/30 resize-none focus:border-plum/40 transition-all overflow-y-auto"
                  />
                  <button onClick={sendMessage} disabled={!input.trim() || sending}
                    className="flex-shrink-0 bg-gradient-to-r from-plum to-plum-light text-white rounded-2xl px-5 py-3 text-sm font-medium disabled:opacity-40 hover:-translate-y-0.5 transition-all shadow-plum">
                    Send
                  </button>
                </div>
                <p className="text-xs text-softdark/30 mt-1.5 text-center hidden sm:block">
                  Enter to send · Shift+Enter for new line
                </p>
              </div>
            </motion.div>
          )}

          {/* ── Love Notes Tab ─────────────────────────────────────────────────── */}
          {tab === "notes" && (
            <motion.div key="notes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 flex flex-col min-h-0">

              {/* Notes input — pinned to top of notes tab */}
              <div className="flex-shrink-0 px-4 py-4 border-b border-rose/20 bg-white/40 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-widest text-plum/50 mb-2">Leave a love note</p>
                <div className="flex gap-3 items-end">
                  <textarea value={noteInput} onChange={(e) => setNoteInput(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, sendLoveNote)}
                    placeholder="Write something from the heart..."
                    rows={2}
                    className="flex-1 bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark placeholder-softdark/30 resize-none focus:border-plum/40 transition-all"
                  />
                  <button onClick={sendLoveNote} disabled={!noteInput.trim() || sending}
                    className="flex-shrink-0 bg-gradient-to-r from-plum to-plum-light text-white rounded-2xl px-5 py-3 text-sm font-medium disabled:opacity-40 hover:-translate-y-0.5 transition-all shadow-plum">
                    Pin 📌
                  </button>
                </div>
              </div>

              {/* Scrollable notes list */}
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
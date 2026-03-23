import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection, addDoc, onSnapshot, query, orderBy,
  deleteDoc, doc, updateDoc
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import Calendar from "react-calendar";
import { format, isSameDay, isPast, differenceInDays, addWeeks, addMonths } from "date-fns";

// ── Constants ─────────────────────────────────────────────────────────────────
const EVENT_TYPES = [
  { id: "visit",       label: "Visit 🚆" },
  { id: "anniversary", label: "Anniversary 💕" },
  { id: "exam",        label: "Exam 📚" },
  { id: "datenight",   label: "Date Night 🌙" },
  { id: "birthday",    label: "Birthday 🎂" },
  { id: "milestone",   label: "Milestone 🎯" },
  { id: "other",       label: "Other ✨" },
];

const RECURRENCE = [
  { id: "none",    label: "No repeat" },
  { id: "weekly",  label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

const REMINDER_DAYS = [1, 2, 3, 5, 7, 14];

const PRESET_COLORS = [
  "#8b3a5a", "#e8a0a0", "#b05a78", "#7c3aed",
  "#2563eb", "#059669", "#d97706", "#dc2626",
  "#ec4899", "#0891b2", "#65a30d", "#f59e0b",
];

const getTypeLabel = (id) => EVENT_TYPES.find(t => t.id === id)?.label || "Other ✨";

// ── Helpers ───────────────────────────────────────────────────────────────────
const toDate = (d) => d?.toDate ? d.toDate() : new Date(d);

const getDaysUntil = (date) => differenceInDays(toDate(date), new Date());

const isReminder = (event) => event.eventKind === "reminder";
const isMilestone = (event) => event.type === "milestone";

// ── Color Picker ──────────────────────────────────────────────────────────────
const ColorPicker = ({ value, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {PRESET_COLORS.map((c) => (
      <button key={c} onClick={() => onChange(c)}
        className="w-7 h-7 rounded-full border-2 transition-all hover:scale-110"
        style={{ background: c, borderColor: value === c ? "#2d1b2e" : "transparent" }} />
    ))}
    <div className="relative">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-7 h-7 rounded-full border-2 border-rose/30 cursor-pointer opacity-0 absolute inset-0" />
      <div className="w-7 h-7 rounded-full border-2 border-dashed border-rose/40 flex items-center justify-center text-xs text-softdark/40 pointer-events-none">
        +
      </div>
    </div>
  </div>
);

// ── Event Card ────────────────────────────────────────────────────────────────
const EventCard = ({ event, isMe, onDelete, onExport }) => {
  const date = toDate(event.date);
  const daysUntil = getDaysUntil(event.date);
  const isPastEvent = isPast(date) && !isSameDay(date, new Date());
  const kind = isReminder(event) ? "reminder" : "event";

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={`bg-white/70 backdrop-blur-sm rounded-2xl p-4 border shadow-soft transition-opacity
        ${isPastEvent && kind === "reminder" ? "opacity-40" : ""}
      `}
      style={{ borderColor: event.color + "40" }}>

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1">
          {/* Type + Kind badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
              style={{ background: event.color || "#8b3a5a" }}>
              {getTypeLabel(event.type)}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
              kind === "reminder"
                ? "bg-amber-50 text-amber-600 border-amber-200"
                : "bg-blue-50 text-blue-600 border-blue-200"
            }`}>
              {kind === "reminder" ? "⏰ Reminder" : "📌 Event"}
            </span>
            {event.recurrence !== "none" && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-200">
                🔁 {event.recurrence}
              </span>
            )}
            {isMilestone(event) && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-rose/10 text-plum border border-rose/20">
                🎯 Milestone
              </span>
            )}
            <span className="text-xs text-softdark/30">{event.addedBy}</span>
          </div>

          {/* Title */}
          <p className="font-medium text-softdark text-sm">{event.title}</p>

          {/* Date + time */}
          <p className="text-xs text-softdark/50">
            {format(date, "MMMM d, yyyy")}
            {event.time && ` at ${event.time}`}
            {!isPastEvent && daysUntil === 0 && " — Today! 🎉"}
            {!isPastEvent && daysUntil === 1 && " — Tomorrow!"}
            {!isPastEvent && daysUntil > 1 && ` — in ${daysUntil} days`}
            {isPastEvent && " — Passed"}
          </p>

          {/* Reminder notice */}
          {!isPastEvent && event.reminderDays > 0 && daysUntil <= event.reminderDays && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-2 py-1 w-fit">
              ⏰ Reminder: {daysUntil === 0 ? "Today!" : `${daysUntil} day${daysUntil > 1 ? "s" : ""} away`}
            </p>
          )}

          {/* Note */}
          {event.note && <p className="text-xs text-softdark/40 italic">{event.note}</p>}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1">
          <button onClick={() => onExport(event)}
            className="text-softdark/30 hover:text-plum transition-colors text-sm" title="Export to calendar">
            📤
          </button>
          {isMe && (
            <button onClick={() => onDelete(event.id)}
              className="text-softdark/30 hover:text-red-400 transition-colors text-sm">✕</button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ── Stats Panel ───────────────────────────────────────────────────────────────
const StatsPanel = ({ events }) => {
  const counts = EVENT_TYPES.map(type => ({
    ...type,
    count: events.filter(e => e.type === type.id).length,
  })).filter(t => t.count > 0);

  const total = events.length;
  const upcoming = events.filter(e => !isPast(toDate(e.date))).length;
  const past = events.filter(e => isPast(toDate(e.date))).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: total, emoji: "📅" },
          { label: "Upcoming", value: upcoming, emoji: "🔜" },
          { label: "Passed", value: past, emoji: "✅" },
        ].map(s => (
          <div key={s.label} className="bg-white/70 rounded-2xl p-4 text-center border border-white/80 shadow-soft">
            <p className="text-2xl">{s.emoji}</p>
            <p className="font-serif text-3xl text-plum">{s.value}</p>
            <p className="text-xs text-softdark/40">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white/70 rounded-3xl border border-white/80 shadow-soft p-5 space-y-3">
        <p className="text-xs uppercase tracking-widest text-plum/40 font-medium">By type</p>
        {counts.length === 0 && <p className="text-sm text-softdark/40">No events yet</p>}
        {counts.map(t => (
          <div key={t.id} className="flex items-center gap-3">
            <span className="text-sm w-32">{t.label}</span>
            <div className="flex-1 bg-rose/10 rounded-full h-2">
              <div className="h-2 rounded-full bg-gradient-to-r from-plum to-plum-light transition-all"
                style={{ width: `${(t.count / total) * 100}%` }} />
            </div>
            <span className="text-xs text-softdark/40 w-4">{t.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Main Calendar ─────────────────────────────────────────────────────────────
export default function SharedCalendar() {
  const { user, userData, coupleData } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState("calendar");
  const [form, setForm] = useState({
    title: "", type: "visit", note: "", date: "", time: "",
    color: "#8b3a5a", recurrence: "none", reminderDays: 0,
    eventKind: "event",
  });

  const coupleId = coupleData?.id;

  useEffect(() => {
    if (!coupleId) return;
    const q = query(collection(db, "couples", coupleId, "events"), orderBy("date", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [coupleId]);

  // Auto delete passed reminders
  useEffect(() => {
    events.forEach(async (e) => {
      if (isReminder(e) && isPast(toDate(e.date)) && !isSameDay(toDate(e.date), new Date())) {
        await deleteDoc(doc(db, "couples", coupleId, "events", e.id));
      }
    });
  }, [events]);

  const eventsOnDate = (date) =>
    events.filter(e => isSameDay(toDate(e.date), date));

  const selectedEvents = eventsOnDate(selectedDate);
  const upcomingEvents = events.filter(e => {
    const d = toDate(e.date);
    return !isPast(d) || isSameDay(d, new Date());
  });

  const handleAdd = async () => {
    if (!form.title || !form.date) return;
    const baseEvent = {
      title: form.title,
      type: form.type,
      note: form.note,
      time: form.time,
      color: form.color,
      recurrence: form.recurrence,
      reminderDays: Number(form.reminderDays),
      eventKind: form.eventKind,
      date: new Date(form.date),
      addedBy: userData.displayName,
      senderId: user.uid,
      createdAt: new Date(),
    };

    await addDoc(collection(db, "couples", coupleId, "events"), baseEvent);

    // Add recurring instances (next 6)
    if (form.recurrence !== "none") {
      for (let i = 1; i <= 6; i++) {
        const nextDate = form.recurrence === "weekly"
          ? addWeeks(new Date(form.date), i)
          : addMonths(new Date(form.date), i);
        await addDoc(collection(db, "couples", coupleId, "events"), { ...baseEvent, date: nextDate });
      }
    }

    setForm({ title: "", type: "visit", note: "", date: "", time: "", color: "#8b3a5a", recurrence: "none", reminderDays: 0, eventKind: "event" });
    setShowAdd(false);
  };

  const handleDelete = async (eventId) => {
    if (!confirm("Delete this event?")) return;
    await deleteDoc(doc(db, "couples", coupleId, "events", eventId));
  };

  // Export to Google Calendar
  const handleExport = (event) => {
    const date = toDate(event.date);
    const start = format(date, "yyyyMMdd") + (event.time ? `T${event.time.replace(":", "")}00` : "");
    const end = start;
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${start}/${end}&details=${encodeURIComponent(event.note || "")}`;
    window.open(url, "_blank");
  };

  const f = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const TABS = [
    { id: "calendar", icon: "📅" },
    { id: "upcoming", icon: "📋" },
    { id: "stats",    icon: "📊" },
  ];

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
              <h1 className="font-serif text-2xl text-softdark">Our Calendar 📅</h1>
              <p className="text-xs text-softdark/40">{upcomingEvents.length} upcoming</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-rose/10 rounded-2xl p-1 gap-1">
              {TABS.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${tab === t.id ? "bg-white text-plum shadow-soft" : "text-softdark/50 hover:text-plum"}`}>
                  {t.icon}
                </button>
              ))}
            </div>
            <button onClick={() => setShowAdd(true)}
              className="bg-gradient-to-r from-plum to-plum-light text-white rounded-2xl px-3 md:px-4 py-2 text-sm font-medium hover:-translate-y-0.5 transition-all shadow-plum whitespace-nowrap">
              + Add
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <AnimatePresence mode="wait">

          {/* Calendar tab */}
          {tab === "calendar" && (
            <motion.div key="cal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="bg-white/70 backdrop-blur-sm rounded-3xl border border-white/80 shadow-soft p-4 overflow-hidden">
                <style>{`
                  .react-calendar { width: 100%; border: none; font-family: 'DM Sans', sans-serif; background: transparent; }
                  .react-calendar__tile { padding: 10px 6px; border-radius: 12px; font-size: 13px; color: #2d1b2e; }
                  .react-calendar__tile:hover { background: rgba(232,160,160,0.2); }
                  .react-calendar__tile--active { background: linear-gradient(135deg, #8b3a5a, #b05a78) !important; color: white !important; border-radius: 12px; }
                  .react-calendar__tile--now { background: rgba(232,160,160,0.3); border-radius: 12px; }
                  .react-calendar__month-view__weekdays { font-size: 11px; color: #8b3a5a; text-transform: uppercase; }
                  .react-calendar__navigation button { font-size: 14px; color: #2d1b2e; border-radius: 12px; padding: 6px; }
                  .react-calendar__navigation button:hover { background: rgba(232,160,160,0.2); }
                  .react-calendar__month-view__weekdays__weekday abbr { text-decoration: none; }
                  .has-event { position: relative; }
                  .has-event::after { content: ''; position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); width: 4px; height: 4px; background: #8b3a5a; border-radius: 50%; }
                `}</style>
                <Calendar onChange={setSelectedDate} value={selectedDate}
                  tileClassName={({ date }) => eventsOnDate(date).length > 0 ? "has-event" : ""} />
              </div>

              <div>
                <p className="text-xs uppercase tracking-widest text-plum/40 font-medium mb-3">
                  {format(selectedDate, "MMMM d, yyyy")}
                </p>
                {selectedEvents.length === 0 ? (
                  <div className="text-center py-8 bg-white/40 rounded-3xl border border-white/60">
                    <p className="text-2xl mb-2">📭</p>
                    <p className="text-sm text-softdark/40">No events on this day</p>
                    <button onClick={() => { setForm(f => ({ ...f, date: format(selectedDate, "yyyy-MM-dd") })); setShowAdd(true); }}
                      className="mt-3 text-xs text-plum/50 hover:text-plum transition-colors underline">Add one?</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedEvents.map(e => (
                      <EventCard key={e.id} event={e} isMe={e.senderId === user.uid}
                        onDelete={handleDelete} onExport={handleExport} />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Upcoming tab */}
          {tab === "upcoming" && (
            <motion.div key="up" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {upcomingEvents.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-4xl mb-3">📋</p>
                  <p className="font-serif text-xl text-softdark">No upcoming events</p>
                  <p className="text-sm text-softdark/40 mt-1">Add your first event ♥</p>
                </div>
              ) : upcomingEvents.map(e => (
                <EventCard key={e.id} event={e} isMe={e.senderId === user.uid}
                  onDelete={handleDelete} onExport={handleExport} />
              ))}
            </motion.div>
          )}

          {/* Stats tab */}
          {tab === "stats" && (
            <motion.div key="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <StatsPanel events={events} />
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Add Event Modal */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-softdark/20 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white/90 backdrop-blur-xl rounded-4xl shadow-plum p-6 w-full max-w-sm space-y-4 mt-4 mb-20">

              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl text-softdark">Add an event</h2>
                <button onClick={() => setShowAdd(false)} className="text-softdark/40 hover:text-softdark text-lg">✕</button>
              </div>

              {/* Kind toggle */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-plum/50 mb-2">Kind</label>
                <div className="flex gap-2">
                  {[
                    { id: "event", label: "📌 Event", desc: "Stays forever" },
                    { id: "reminder", label: "⏰ Reminder", desc: "Auto-deletes after date" },
                  ].map(k => (
                    <button key={k.id} onClick={() => setForm(p => ({ ...p, eventKind: k.id }))}
                      className={`flex-1 py-2 px-3 rounded-2xl border text-xs transition-all text-left ${form.eventKind === k.id ? "bg-plum text-white border-plum" : "bg-white text-softdark/60 border-rose/30"}`}>
                      <p className="font-medium">{k.label}</p>
                      <p className="opacity-70">{k.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-plum/50 mb-1.5">Title</label>
                <input value={form.title} onChange={f("title")} placeholder="e.g. Visiting you! 🚆"
                  className="w-full bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark" />
              </div>

              {/* Date + Time */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="block text-xs uppercase tracking-widest text-plum/50 mb-1.5">Date</label>
                  <input type="date" value={form.date} onChange={f("date")}
                    className="w-full bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs uppercase tracking-widest text-plum/50 mb-1.5">Time</label>
                  <input type="time" value={form.time} onChange={f("time")}
                    className="w-full bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark" />
                </div>
              </div>

              {/* Type */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-plum/50 mb-2">Type</label>
                <div className="flex flex-wrap gap-2">
                  {EVENT_TYPES.map(t => (
                    <button key={t.id} onClick={() => setForm(p => ({ ...p, type: t.id }))}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all touch-manipulation ${form.type === t.id ? "bg-plum text-white border-plum" : "bg-white text-softdark/60 border-rose/30"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-plum/50 mb-2">Color</label>
                <ColorPicker value={form.color} onChange={(c) => setForm(p => ({ ...p, color: c }))} />
              </div>

              {/* Recurrence */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-plum/50 mb-2">Repeat</label>
                <div className="flex gap-2">
                  {RECURRENCE.map(r => (
                    <button key={r.id} onClick={() => setForm(p => ({ ...p, recurrence: r.id }))}
                      className={`flex-1 text-xs py-2 rounded-2xl border transition-all ${form.recurrence === r.id ? "bg-plum text-white border-plum" : "bg-white text-softdark/60 border-rose/30"}`}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reminder */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-plum/50 mb-2">Remind me</label>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setForm(p => ({ ...p, reminderDays: 0 }))}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${form.reminderDays === 0 ? "bg-plum text-white border-plum" : "bg-white text-softdark/60 border-rose/30"}`}>
                    No reminder
                  </button>
                  {REMINDER_DAYS.map(d => (
                    <button key={d} onClick={() => setForm(p => ({ ...p, reminderDays: d }))}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${form.reminderDays === d ? "bg-plum text-white border-plum" : "bg-white text-softdark/60 border-rose/30"}`}>
                      {d === 1 ? "1 day before" : `${d} days before`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-plum/50 mb-1.5">Notes</label>
                <textarea value={form.note} onChange={f("note")} placeholder="Any extra details..."
                  rows={2}
                  className="w-full bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark resize-none" />
              </div>

              <button onClick={handleAdd} disabled={!form.title || !form.date}
                className="w-full bg-gradient-to-r from-plum to-plum-light text-white rounded-2xl py-3 text-sm font-medium disabled:opacity-40 hover:-translate-y-0.5 transition-all shadow-plum">
                Save ✨
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { useWeather } from "../hooks/useWeather";
import { logOut } from "../firebase/auth";
import { useNavigate, Link } from "react-router-dom";

const getTimeInCity = (timezone) => {
  try {
    return new Date().toLocaleTimeString("en-US", {
      timeZone: timezone, hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch { return new Date().toLocaleTimeString(); }
};

const getDaysTogether = (anniversaryDate) => {
  if (!anniversaryDate) return null;
  const start = anniversaryDate.toDate ? anniversaryDate.toDate() : new Date(anniversaryDate);
  return Math.floor((new Date() - start) / (1000 * 60 * 60 * 24));
};

const getCountdown = (meetupDate) => {
  if (!meetupDate) return null;
  const target = meetupDate.toDate ? meetupDate.toDate() : new Date(meetupDate);
  const diff = target - new Date();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0 };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
  };
};

const MOODS = ["😊", "😍", "😴", "😢", "😤", "🥰", "😌", "🤩"];

const Card = ({ children, className = "" }) => (
  <div className={`bg-white/60 backdrop-blur-md rounded-3xl border border-white/80 shadow-soft p-4 md:p-5 ${className}`}>
    {children}
  </div>
);

const Label = ({ children }) => (
  <p className="text-xs uppercase tracking-widest text-plum/40 font-medium mb-2">{children}</p>
);

const ClockWidget = ({ name, timezone, city, weather, weatherLoading }) => {
  const [time, setTime] = useState(getTimeInCity(timezone));
  useEffect(() => {
    const interval = setInterval(() => setTime(getTimeInCity(timezone)), 1000);
    return () => clearInterval(interval);
  }, [timezone]);
  return (
    <Card className="flex-1 min-w-0">
      <Label>{name}</Label>
      <p className="font-serif text-2xl md:text-3xl text-softdark truncate">{time}</p>
      <p className="text-xs text-softdark/40 mt-1 truncate">{city || "Set your city"}</p>
      {weatherLoading && <p className="text-xs text-softdark/30 mt-2">Loading...</p>}
      {weather && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-lg">{weather.icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-softdark">{weather.temp}°C</p>
            <p className="text-xs text-softdark/40 truncate">{weather.description}</p>
          </div>
        </div>
      )}
    </Card>
  );
};

const MoodSelector = ({ currentMood, onSelect, label }) => (
  <div>
    <Label>{label}</Label>
    <div className="flex gap-1.5 flex-wrap">
      {MOODS.map((m) => (
        <button key={m} onClick={() => onSelect(m)}
          className={`text-xl rounded-xl p-1.5 transition-all duration-150 ${currentMood === m ? "bg-rose/30 scale-110" : "hover:bg-rose/10"}`}>
          {m}
        </button>
      ))}
    </div>
  </div>
);

const CountdownWidget = ({ meetupDate, onSet }) => {
  const countdown = getCountdown(meetupDate);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const handleSave = () => { if (input) { onSet(new Date(input)); setEditing(false); } };
  return (
    <Card>
      <Label>Next meetup countdown</Label>
      {countdown ? (
        <div className="flex gap-3 md:gap-4 items-end">
          {[["days", countdown.days], ["hrs", countdown.hours], ["min", countdown.minutes]].map(([unit, val]) => (
            <div key={unit} className="text-center">
              <p className="font-serif text-3xl md:text-4xl text-plum">{val}</p>
              <p className="text-xs text-softdark/40">{unit}</p>
            </div>
          ))}
          <button onClick={() => setEditing(true)}
            className="ml-auto text-xs text-plum/40 hover:text-plum transition-colors">✏️ Edit</button>
        </div>
      ) : (
        <p className="text-sm text-softdark/40">No meetup set yet 🥺</p>
      )}
      {(editing || !countdown) && (
        <div className="mt-3 flex gap-2">
          <input type="datetime-local" value={input} onChange={(e) => setInput(e.target.value)}
            className="flex-1 text-xs bg-white border border-rose/30 rounded-xl px-3 py-2 text-softdark min-w-0" />
          <button onClick={handleSave}
            className="text-xs bg-plum text-white rounded-xl px-3 py-2 hover:bg-plum-light transition-colors whitespace-nowrap">
            Save
          </button>
        </div>
      )}
    </Card>
  );
};

const SettingsPanel = ({ userData, coupleData, onClose, onSave }) => {
  const [myCity, setMyCity] = useState(userData?.city || "");
  const [myTimezone, setMyTimezone] = useState(userData?.timezone || "Asia/Kolkata");
  const [anniversary, setAnniversary] = useState("");
  const handleSave = async () => { await onSave({ myCity, myTimezone, anniversary }); onClose(); };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-softdark/20 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white/90 backdrop-blur-xl rounded-4xl shadow-plum p-6 w-full max-w-sm space-y-5 mt-4 mb-20">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl text-softdark">Your settings</h2>
          <button onClick={onClose}
            className="bg-rose/10 hover:bg-rose/20 text-softdark rounded-full w-8 h-8 flex items-center justify-center text-sm transition-colors">✕</button>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-plum/50 mb-1.5">Your city</label>
          <input value={myCity} onChange={(e) => setMyCity(e.target.value)} placeholder="e.g. Mumbai"
            className="w-full bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-plum/50 mb-1.5">Your timezone</label>
          <select value={myTimezone} onChange={(e) => setMyTimezone(e.target.value)}
            className="w-full bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark">
            {Intl.supportedValuesOf("timeZone").map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-plum/50 mb-1.5">Anniversary date</label>
          <input type="date" value={anniversary} onChange={(e) => setAnniversary(e.target.value)}
            className="w-full bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark" />
        </div>
        <button onClick={handleSave}
          className="w-full bg-gradient-to-r from-plum to-plum-light text-white rounded-2xl py-3 text-sm font-medium hover:-translate-y-0.5 transition-all shadow-plum">
          Save settings ✓
        </button>
      </motion.div>
    </motion.div>
  );
};

export default function Dashboard() {
  const { user, userData, coupleData } = useAuth();
  const navigate = useNavigate();
  const [partner, setPartner] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // ✅ Use coupleData directly from context — it's already a live onSnapshot
  // No need for a separate coupleInfo state
  const myCity = userData?.city || "";
  const myTimezone = userData?.timezone || "Asia/Kolkata";
  const partnerCity = partner?.city || "";
  const partnerTimezone = partner?.timezone || "Asia/Kolkata";

  const { weather: myWeather, loading: myWeatherLoading } = useWeather(myCity);
  const { weather: partnerWeather, loading: partnerWeatherLoading } = useWeather(partnerCity);

  // ✅ Key fix: depend on coupleData?.members so this re-runs when partner joins
  useEffect(() => {
    if (!coupleData?.members) return;

    const partnerUid = coupleData.members.find((id) => id !== user.uid);
    if (!partnerUid) {
      setPartner(null);
      return;
    }

    // Live listen to partner's user doc
    const unsub = onSnapshot(doc(db, "users", partnerUid), (snap) => {
      if (snap.exists()) setPartner({ id: snap.id, ...snap.data() });
      else setPartner(null);
    });

    return () => unsub();
  }, [coupleData?.members, user.uid]); // ✅ re-runs when members array changes

  const handleMoodChange = async (mood) => {
    await updateDoc(doc(db, "users", user.uid), { mood });
  };

  const handleMeetupSet = async (date) => {
    await updateDoc(doc(db, "couples", coupleData.id), { nextMeetup: date });
  };

  const handleSettingsSave = async ({ myCity, myTimezone, anniversary }) => {
    await updateDoc(doc(db, "users", user.uid), { city: myCity, timezone: myTimezone });
    if (anniversary) {
      await updateDoc(doc(db, "couples", coupleData.id), { anniversaryDate: new Date(anniversary) });
    }
    setShowSettings(false);
  };

  // ✅ Use coupleData directly from context (already live)
  const daysTogether = getDaysTogether(coupleData?.anniversaryDate);

  const NAV_ITEMS = [
    { icon: "💬", label: "Messages",   path: "/messages" },
    { icon: "📸", label: "Scrapbook",  path: "/scrapbook" },
    { icon: "🎵", label: "Music Room", path: "/music" },
    { icon: "🎮", label: "Games",      path: "/games" },
    { icon: "📅", label: "Calendar",   path: "/calendar" },
    { icon: "💸", label: "Finance",    path: "/finance" },
  ];

  return (
    <div className="page-enter min-h-screen bg-petal p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
          <div>
            <h1 className="font-serif text-2xl md:text-3xl text-softdark leading-tight">
              {userData?.displayName} <span className="text-rose">♥</span>{" "}
              {partner?.displayName
                ? <span>{partner.displayName}</span>
                : coupleData?.partnerJoined
                  ? <span className="text-softdark/30 text-xl">loading...</span>
                  : <span className="text-softdark/30 text-xl">waiting...</span>
              }
            </h1>
            {daysTogether !== null && (
              <p className="text-sm text-softdark/50 mt-0.5">{daysTogether} days together 🌸</p>
            )}
          </div>
          <div className="flex gap-2 self-start sm:self-auto">
            <button onClick={() => setShowSettings(true)}
              className="text-sm text-plum/50 hover:text-plum bg-white/50 rounded-2xl px-3 py-2 border border-rose/20 transition-colors whitespace-nowrap">
              ⚙️ Settings
            </button>
            <button onClick={async () => { await logOut(); navigate("/"); }}
              className="text-sm text-plum/50 hover:text-plum bg-white/50 rounded-2xl px-3 py-2 border border-rose/20 transition-colors whitespace-nowrap">
              Sign out
            </button>
          </div>
        </motion.div>

        {/* Partner not joined banner */}
        {!coupleData?.partnerJoined && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-rose/10 border border-rose/20 rounded-3xl p-5 mb-6 text-center">
            <p className="text-sm text-softdark/60 mb-2">Waiting for your partner to join...</p>
            <p className="font-mono text-xl md:text-2xl font-bold text-plum tracking-widest">{coupleData?.inviteCode}</p>
            <button onClick={() => navigator.clipboard.writeText(coupleData?.inviteCode || "")}
              className="text-xs text-plum/40 hover:text-plum mt-2 transition-colors">
              📋 Copy invite code
            </button>
          </motion.div>
        )}

        {/* Partner joined banner — shows once when partner joins */}
        {coupleData?.partnerJoined && partner && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-green-50 border border-green-200 rounded-3xl p-4 mb-6 text-center">
            <p className="text-sm text-green-600 font-medium">
              ♥ You and {partner.displayName} are connected!
            </p>
          </motion.div>
        )}

        <div className="space-y-4">
          {/* Clocks */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="flex flex-col sm:flex-row gap-4">
            <ClockWidget name={`${userData?.displayName || "You"}'s time`} timezone={myTimezone}
              city={myCity} weather={myWeather} weatherLoading={myWeatherLoading} />
            <ClockWidget name={`${partner?.displayName || "Partner"}'s time`} timezone={partnerTimezone}
              city={partnerCity} weather={partnerWeather} weatherLoading={partnerWeatherLoading} />
          </motion.div>

          {/* Countdown */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <CountdownWidget meetupDate={coupleData?.nextMeetup} onSet={handleMeetupSet} />
          </motion.div>

          {/* Moods */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card>
              <div className="flex gap-2 items-center mb-4 flex-wrap">
                <span className="text-xl">{userData?.mood || "😊"}</span>
                <span className="font-serif text-softdark">How are you feeling?</span>
                <span className="ml-auto text-xl">{partner?.mood || "😊"}</span>
                <span className="text-sm text-softdark/40">{partner?.displayName || "Partner"}</span>
              </div>
              <MoodSelector currentMood={userData?.mood} onSelect={handleMoodChange} label="Your mood" />
            </Card>
          </motion.div>

          {/* Navigation grid */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card>
              <Label>Your space</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {NAV_ITEMS.map((item) => (
                  <Link key={item.path} to={item.path}
                    className="flex items-center gap-2 bg-white/60 hover:bg-white/90 border border-rose/20 rounded-2xl px-3 py-3 transition-all hover:-translate-y-0.5 hover:shadow-soft">
                    <span className="text-xl flex-shrink-0">{item.icon}</span>
                    <span className="text-sm font-medium text-softdark truncate">{item.label}</span>
                  </Link>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {showSettings && (
          <SettingsPanel userData={userData} coupleData={coupleData}
            onClose={() => setShowSettings(false)} onSave={handleSettingsSave} />
        )}
      </AnimatePresence>
    </div>
  );
}
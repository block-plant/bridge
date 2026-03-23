import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { signUpAndCreateRoom, signUpAndJoinRoom, signIn } from "../firebase/auth";

const FloatingHeart = ({ delay = 0, x = 50, size = 20 }) => (
  <motion.div
    className="absolute pointer-events-none select-none text-rose/30"
    style={{ left: `${x}%`, bottom: "-5%", fontSize: size }}
    animate={{ y: [0, -800], opacity: [0, 0.5, 0] }}
    transition={{ duration: 12, delay, repeat: Infinity, ease: "easeOut" }}
  >♥</motion.div>
);

const Input = ({ label, type = "text", value, onChange, placeholder, icon }) => (
  <div className="w-full">
    {label && <label className="block text-xs font-medium text-plum/70 mb-1.5 tracking-wide uppercase">{label}</label>}
    <div className="relative">
      {icon && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-rose/60 text-sm">{icon}</span>}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        className={`w-full bg-white/60 backdrop-blur-sm border border-rose/30 rounded-2xl py-3.5 text-softdark placeholder-softdark/30 focus:border-plum/40 focus:bg-white/80 transition-all duration-200 text-sm ${icon ? "pl-11 pr-4" : "px-4"}`}
      />
    </div>
  </div>
);

const Btn = ({ children, onClick, loading, variant = "primary" }) => {
  const styles = {
    primary: "bg-gradient-to-r from-plum to-plum-light text-white shadow-plum hover:-translate-y-0.5",
    secondary: "bg-rose/20 text-plum border border-rose/30 hover:bg-rose/30 hover:-translate-y-0.5",
    ghost: "text-plum/60 hover:text-plum text-xs underline-offset-4 hover:underline",
  };
  return (
    <button onClick={onClick} disabled={loading}
      className={`w-full py-3.5 rounded-2xl font-medium text-sm transition-all duration-200 ${styles[variant]} ${loading ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}>
      {loading
        ? <span className="flex items-center justify-center gap-2">
            <motion.span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full"
              animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}/>
            Please wait...
          </span>
        : children}
    </button>
  );
};

const InviteCard = ({ code, onContinue }) => (
  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-6">
    <div className="text-5xl">💌</div>
    <div>
      <h2 className="font-serif text-2xl text-softdark mb-1">Your room is ready!</h2>
      <p className="text-sm text-softdark/50">Share this code with your partner</p>
    </div>
    <div className="bg-gradient-to-r from-blush/60 to-rose/20 rounded-3xl p-6 border border-rose/30">
      <p className="text-xs uppercase tracking-widest text-plum/50 mb-3">Invite Code</p>
      <div className="flex gap-1.5 justify-center flex-wrap">
        {code.split("").map((char, i) => (
          <motion.span key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="w-9 h-12 flex items-center justify-center bg-white rounded-xl text-xl font-mono font-bold text-plum shadow-soft border border-rose/20">
            {char}
          </motion.span>
        ))}
      </div>
      <button onClick={() => navigator.clipboard.writeText(code)}
        className="mt-4 text-xs text-plum/50 hover:text-plum transition-colors flex items-center gap-1 mx-auto">
        📋 Copy code
      </button>
    </div>
    <p className="text-xs text-softdark/40 px-4">Once your partner joins, you'll be connected forever on LoveBridge ♥</p>
    <Btn onClick={onContinue}>Continue to Dashboard →</Btn>
  </motion.div>
);

export default function Landing() {
  const navigate = useNavigate();
  const [view, setView] = useState("hero");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", code: "" });

  const f = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));
  const clear = () => setError("");

  const handleLogin = async () => {
    clear();
    if (!form.email || !form.password) return setError("Please fill in all fields.");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) return setError("Please enter a valid email address.");
    setLoading(true);
    try { await signIn(form.email, form.password); navigate("/dashboard"); }
    catch (err) { setError(err.message.includes("invalid-credential") ? "Incorrect email or password." : err.message); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    clear();
    if (!form.email || !form.password) return setError("Please fill in all fields.");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) return setError("Please enter a valid email address.");
    if (form.password !== form.confirmPassword) return setError("Passwords don't match.");
    if (form.password.length < 6) return setError("Password must be at least 6 characters.");
    setLoading(true);
    try {
      const { inviteCode: code } = await signUpAndCreateRoom(form.email, form.password, form.name);
      setInviteCode(code); setView("success");
    }
    catch (err) { setError(err.message.includes("email-already-in-use") ? "Email already registered." : err.message); }
    finally { setLoading(false); }
  };

  const handleJoin = async () => {
    clear();
    if (!form.email || !form.password) return setError("Please fill in all fields.");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) return setError("Please enter a valid email address.");
    if (form.password !== form.confirmPassword) return setError("Passwords don't match.");
    setLoading(true);
    try { await signUpAndJoinRoom(form.email, form.password, form.name, form.code); navigate("/dashboard"); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const views = {
    success: <InviteCard code={inviteCode} onContinue={() => navigate("/dashboard")} />,

    login: (
      <motion.div key="login" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
        <div className="text-center mb-6">
          <h2 className="font-serif text-2xl text-softdark">Welcome back</h2>
          <p className="text-sm text-softdark/50 mt-1">We missed you ♥</p>
        </div>
        <Input label="Email" type="email" value={form.email} onChange={f("email")} placeholder="your@email.com" icon="✉️" />
        <Input label="Password" type="password" value={form.password} onChange={f("password")} placeholder="••••••••" icon="🔒" />
        {error && <p className="text-red-500 text-xs text-center bg-red-50 rounded-2xl py-2 px-4">{error}</p>}
        <Btn onClick={handleLogin} loading={loading}>Sign In</Btn>
        <Btn variant="ghost" onClick={() => { setView("signup"); clear(); }}>New here? Create your couple room →</Btn>
      </motion.div>
    ),

    signup: (
      <motion.div key="signup" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
        <div className="text-center mb-6">
          <h2 className="font-serif text-2xl text-softdark">Create your room</h2>
          <p className="text-sm text-softdark/50 mt-1">You'll get a code to share with your partner</p>
        </div>
        <Input label="Your name" value={form.name} onChange={f("name")} placeholder="What should we call you?" icon="🌸" />
        <Input label="Email" type="email" value={form.email} onChange={f("email")} placeholder="your@email.com" icon="✉️" />
        <Input label="Password" type="password" value={form.password} onChange={f("password")} placeholder="At least 6 characters" icon="🔒" />
        <Input label="Confirm password" type="password" value={form.confirmPassword} onChange={f("confirmPassword")} placeholder="Same password again" icon="🔒" />
        {error && <p className="text-red-500 text-xs text-center bg-red-50 rounded-2xl py-2 px-4">{error}</p>}
        <Btn onClick={handleCreate} loading={loading}>Create Our Room 💌</Btn>
        <div className="flex gap-3">
          <Btn variant="secondary" onClick={() => { setView("join"); clear(); }}>Join with code</Btn>
          <Btn variant="ghost" onClick={() => { setView("login"); clear(); }}>Sign in</Btn>
        </div>
      </motion.div>
    ),

    join: (
      <motion.div key="join" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🗝️</div>
          <h2 className="font-serif text-2xl text-softdark">Join your partner</h2>
          <p className="text-sm text-softdark/50 mt-1">Enter the invite code they sent you</p>
        </div>
        <Input label="Invite code" value={form.code} onChange={f("code")} placeholder="e.g. ABCD1234" icon="🗝️" />
        <Input label="Your name" value={form.name} onChange={f("name")} placeholder="What should we call you?" icon="🌸" />
        <Input label="Email" type="email" value={form.email} onChange={f("email")} placeholder="your@email.com" icon="✉️" />
        <Input label="Password" type="password" value={form.password} onChange={f("password")} placeholder="At least 6 characters" icon="🔒" />
        <Input label="Confirm password" type="password" value={form.confirmPassword} onChange={f("confirmPassword")} placeholder="Same password again" icon="🔒" />
        {error && <p className="text-red-500 text-xs text-center bg-red-50 rounded-2xl py-2 px-4">{error}</p>}
        <Btn onClick={handleJoin} loading={loading}>Join Our Room ♥</Btn>
        <Btn variant="ghost" onClick={() => { setView("signup"); clear(); }}>← Create a room instead</Btn>
      </motion.div>
    ),

    hero: (
      <motion.div key="hero" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center space-y-8">
        <div className="space-y-3">
          <motion.div className="text-6xl" animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}>♥</motion.div>
          <h1 className="font-serif text-5xl text-softdark">LoveBridge</h1>
          <p className="font-serif text-lg text-plum/70 italic">Your private world, together</p>
        </div>
        <p className="text-sm text-softdark/50 leading-relaxed max-w-xs mx-auto">
          A shared space for the two of you — music, memories, messages, and more.
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          {["💬 Chat", "🎵 Music", "📹 Video Calls", "📸 Memories", "🎮 Games", "📅 Calendar"].map((feat) => (
            <span key={feat} className="text-xs px-3 py-1.5 rounded-full bg-rose/20 text-plum border border-rose/30 font-medium">{feat}</span>
          ))}
        </div>
        <div className="space-y-3 pt-2">
          <Btn onClick={() => setView("signup")}>Create Our Space 🌸</Btn>
          <Btn variant="secondary" onClick={() => setView("join")}>I have an invite code 🗝️</Btn>
          <Btn variant="ghost" onClick={() => setView("login")}>Already a member? Sign in</Btn>
        </div>
      </motion.div>
    ),
  };

  return (
    <div className="page-enter min-h-screen bg-petal relative overflow-hidden flex items-center justify-center p-4">
      {[12, 28, 44, 60, 76, 90].map((x, i) => (
        <FloatingHeart key={i} x={x} delay={i * 1.5} size={12 + (i % 3) * 4} />
      ))}
      <AnimatePresence>
        {view !== "hero" && (
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { setView("hero"); clear(); }}
            className="absolute top-6 left-6 text-plum/50 hover:text-plum text-sm transition-colors z-10">
            ← Back
          </motion.button>
        )}
      </AnimatePresence>
      <motion.div className="w-full max-w-md relative z-10" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="bg-white/70 backdrop-blur-xl rounded-4xl shadow-soft border border-white/80 p-8 md:p-10">
          <AnimatePresence mode="wait">{views[view]}</AnimatePresence>
        </div>
        <p className="text-center text-xs text-softdark/30 mt-6">
          Private & secure — only the two of you can access your space 🔒
        </p>
      </motion.div>
    </div>
  );
}
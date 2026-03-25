import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { doc, setDoc, onSnapshot, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

const GAMES = [
  { id: "wyr",      icon: "💭", label: "Would You Rather",       desc: "Pick between two options — see what your partner chooses", levels: ["Mild", "Spicy", "Extreme"] },
  { id: "tod",      icon: "🎯", label: "Truth or Dare",           desc: "Sweet, bold or daring — you decide",                      levels: ["Sweet", "Bold", "Daring"] },
  { id: "hwyknm",   icon: "💑", label: "How Well Do You Know Me", desc: "Answer questions about each other",                        levels: ["Easy", "Medium", "Hard"] },
  { id: "emoji",    icon: "🧩", label: "Emoji Puzzle",            desc: "Decode the emoji phrase before your partner",             levels: ["Easy", "Medium", "Hard"] },
  { id: "scramble", icon: "🔤", label: "Word Scramble",           desc: "Unscramble the hidden word",                              levels: ["Easy", "Medium", "Hard"] },
  { id: "story",    icon: "📖", label: "Story Builder",           desc: "Take turns adding to a romantic story",                   levels: ["Fun", "Dramatic", "Wild"] },
  { id: "trivia",   icon: "🧠", label: "Couple's Trivia",         desc: "Test your knowledge together",                            levels: ["Easy", "Medium", "Hard"] },
  { id: "finish",   icon: "💌", label: "Finish the Sentence",     desc: "Complete romantic prompts your own way",                  levels: ["Sweet", "Deep", "Funny"] },
];

const LEVEL_COLORS = {
  Mild: "bg-green-50 text-green-600 border-green-200",
  Easy: "bg-green-50 text-green-600 border-green-200",
  Fun: "bg-green-50 text-green-600 border-green-200",
  Sweet: "bg-green-50 text-green-600 border-green-200",
  Spicy: "bg-amber-50 text-amber-600 border-amber-200",
  Medium: "bg-amber-50 text-amber-600 border-amber-200",
  Bold: "bg-amber-50 text-amber-600 border-amber-200",
  Dramatic: "bg-amber-50 text-amber-600 border-amber-200",
  Deep: "bg-amber-50 text-amber-600 border-amber-200",
  Extreme: "bg-red-50 text-red-500 border-red-200",
  Hard: "bg-red-50 text-red-500 border-red-200",
  Daring: "bg-red-50 text-red-500 border-red-200",
  Wild: "bg-red-50 text-red-500 border-red-200",
  Funny: "bg-red-50 text-red-500 border-red-200",
};

// ── Claude API ────────────────────────────────────────────────────────────────
const generateQuestion = async (gameId, level, partnerName, myName) => {
  // Create a random seed string (e.g., "x7b9z2") to force Claude to give a different answer every time
  const randomSeed = Math.random().toString(36).substring(2, 10);
  const uniqueInstruction = ` CRITICAL: Be highly creative. Ensure this specific output is completely unique, rare, and unexpected. Do not use common examples or clichés. (Random uniqueness seed: ${randomSeed})`;

  const prompts = {
    wyr: `Generate a single "Would You Rather" question for a couple named ${myName} and ${partnerName}. Level: ${level}. Return ONLY valid JSON: {"a": "option A", "b": "option B"}. ${
      level === "Extreme" ? "Make it a painfully difficult, high-stakes moral or relationship dilemma. Deeply thought-provoking." 
      : level === "Spicy" ? "Make it hot, intimate, slightly naughty, and focused on physical romance or bedroom secrets." 
      : "Make it a sweet, funny, and light-hearted everyday couple scenario."}${uniqueInstruction}`,
      
    tod: `Generate a single Truth OR Dare for a couple named ${myName} and ${partnerName}. Level: ${level}. Return ONLY valid JSON: {"type": "truth", "content": "question"} or {"type": "dare", "content": "dare"}. ${
      level === "Daring" ? "Make the dare wild, physical, and hot, or the truth deeply revealing and intimate." 
      : level === "Bold" ? "Make it a fun challenge or a slightly uncomfortable but exciting truth." 
      : "Make it a cute, romantic gesture or a sweet, innocent truth about your feelings."}${uniqueInstruction}`,
      
    hwyknm: `Generate a "How Well Do You Know Me" question for a couple. Level: ${level}. Return ONLY valid JSON: {"question": "the question"}. ${
      level === "Hard" ? "Make it about a highly specific, obscure detail, a deep-seated fear, or a long-forgotten childhood memory." 
      : level === "Medium" ? "Make it about daily habits, specific preferences, or opinions on common topics." 
      : "Make it about absolute favorite things (food, color, movie) that any partner should easily know."}${uniqueInstruction}`,
      
    emoji: `Generate an emoji puzzle for a couple. Level: ${level}. Return ONLY valid JSON: {"emoji": "emoji sequence", "answer": "answer", "hint": "short hint"}. Answer should be a romantic word, phrase or movie. ${
      level === "Hard" ? "Use 6-8 obscure emojis representing a complex movie plot, idiom, or abstract concept. Extremely difficult." 
      : level === "Medium" ? "Use 3-5 emojis representing a well-known romantic movie, song, or activity." 
      : "Use 2-3 very obvious emojis representing a common romantic object, animal, or simple word."}${uniqueInstruction}`,
      
    scramble: `Generate a word scramble for a couple. Level: ${level}. Return ONLY valid JSON: {"scrambled": "SCRAMBLED", "answer": "ANSWER", "hint": "short hint"}. Use a romantic or relationship word. Scrambled must be different from answer. ${
      level === "Hard" ? "Use a 9-12 letter complex relationship or emotion word." 
      : level === "Medium" ? "Use a 6-8 letter word related to dates, feelings, or romance." 
      : "Use a 4-5 letter simple word like 'LOVE', 'KISS', 'HUG', or 'DATE'."}${uniqueInstruction}`,
      
    story: `Generate a story starter for a couple's story building game. Level: ${level} mood. Return ONLY valid JSON: {"starter": "opening sentence"}. ${
      level === "Wild" ? "Make the opening sentence hot, passionate, scandalous, and intensely romantic with a wild twist." 
      : level === "Dramatic" ? "Make the opening sentence highly emotional, full of suspense, tension, or a dramatic romantic revelation." 
      : "Make the opening sentence goofy, hilarious, or starting a ridiculous and fun adventure together."}${uniqueInstruction}`,
      
    trivia: `Generate a trivia question about love, relationships, famous couples or romantic movies. Level: ${level}. Return ONLY valid JSON: {"question": "q", "answer": "correct answer", "options": ["opt1", "opt2", "opt3", "opt4"]}. Correct answer must be one of the options. ${
      level === "Hard" ? "Ask a highly obscure fact about the biology of love, ancient romantic history, or difficult statistics." 
      : level === "Medium" ? "Ask about a famous celebrity couple, a well-known romantic movie, or common relationship milestones." 
      : "Ask a very simple, universal question about Valentine's Day, common date ideas, or basic romance."}${uniqueInstruction}`,
      
    finish: `Generate a "Finish the Sentence" prompt for a couple named ${myName} and ${partnerName}. Level: ${level} mood. Return ONLY valid JSON: {"prompt": "Incomplete sentence ending with ..."}. ${
      level === "Funny" ? "Make the prompt set up a hilarious, silly, or slightly embarrassing admission." 
      : level === "Deep" ? "Make the prompt set up a vulnerable, deeply emotional, or soul-baring confession." 
      : "Make the prompt set up a cute, affectionate, and heartwarming compliment."}${uniqueInstruction}`,
  };

  const isDev = import.meta.env.DEV;

  if (isDev) {
    // Local development — call Anthropic directly
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompts[gameId] }],
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || `API error ${res.status}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text?.trim() || "";
    
    // THIS IS THE FIX: Extract ONLY the JSON object/array, ignoring Claude's conversational text
    const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      throw new Error("Claude didn't return any valid JSON format. Try again!");
    }
    
    return JSON.parse(jsonMatch[0]);

  } else {
    // Production — call via secure Vercel proxy
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId, level, prompt: prompts[gameId] }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || `API error ${res.status}`);
    }

    return await res.json();
  }
};

// ── Game Components ───────────────────────────────────────────────────────────
const Spinner = ({ label }) => (
  <div className="text-center py-10">
    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className="text-4xl inline-block mb-3">⚙️</motion.div>
    <p className="text-sm text-softdark/40">{label || "Claude is thinking..."}</p>
  </div>
);

const ResultBox = ({ partnerAnswer, partnerName, children }) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
    className="bg-rose/10 rounded-2xl p-4 border border-rose/20 space-y-1.5">
    {children}
    {!partnerAnswer && <p className="text-xs text-softdark/40 italic">Waiting for {partnerName}...</p>}
  </motion.div>
);

const WYRGame = ({ question, myAnswer, partnerAnswer, onAnswer, partnerName, loading }) => (
  <div className="space-y-4">
    {loading ? <Spinner label="Generating question..." /> : question ? (
      <>
        <p className="text-xs uppercase tracking-widest text-plum/40 text-center">Would you rather...</p>
        {["a", "b"].map(opt => (
          <motion.button key={opt} whileTap={{ scale: 0.98 }} onClick={() => !myAnswer && onAnswer(opt)}
            className={`w-full p-4 rounded-2xl border-2 text-sm font-medium text-left transition-all ${
              myAnswer === opt ? "bg-plum text-white border-plum shadow-plum"
              : myAnswer ? "bg-white/40 text-softdark/40 border-rose/10 cursor-default"
              : "bg-white/70 text-softdark border-rose/20 hover:border-plum/30"}`}>
            <span className="opacity-40 font-bold mr-2 text-xs">{opt.toUpperCase()}</span>{question[opt]}
          </motion.button>
        ))}
        {myAnswer && (
          <ResultBox partnerAnswer={partnerAnswer} partnerName={partnerName}>
            <p className="text-xs text-softdark/50">You: <span className="font-medium text-plum">{question[myAnswer]}</span></p>
            {partnerAnswer && <p className="text-xs text-softdark/50">{partnerName}: <span className="font-medium text-plum">{question[partnerAnswer]}</span></p>}
            {partnerAnswer && <p className="text-sm font-medium text-center text-plum pt-1">{myAnswer === partnerAnswer ? "🎉 You both agree!" : "💭 You see it differently!"}</p>}
          </ResultBox>
        )}
      </>
    ) : null}
  </div>
);

const TODGame = ({ question, myAnswer, onAnswer, partnerAnswer, partnerName, loading }) => (
  <div className="space-y-4">
    {loading ? <Spinner /> : question ? (
      <>
        <div className={`rounded-2xl p-5 border-2 text-center ${question.type === "truth" ? "bg-blue-50 border-blue-200" : "bg-orange-50 border-orange-200"}`}>
          <p className={`text-xs uppercase tracking-widest font-bold mb-3 ${question.type === "truth" ? "text-blue-500" : "text-orange-500"}`}>
            {question.type === "truth" ? "❓ Truth" : "🎯 Dare"}
          </p>
          <p className="font-serif text-lg text-softdark">{question.content}</p>
        </div>
        {!myAnswer ? (
          <div className="flex gap-3">
            <button onClick={() => onAnswer("done")} className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-plum to-plum-light text-white text-sm font-medium shadow-plum">✓ Done!</button>
            <button onClick={() => onAnswer("skip")} className="px-5 py-3 rounded-2xl bg-rose/10 text-plum/60 text-sm border border-rose/20">Skip</button>
          </div>
        ) : (
          <ResultBox partnerAnswer={partnerAnswer} partnerName={partnerName}>
            <p className="text-xs text-softdark/50">You: <span className="font-medium text-plum">{myAnswer === "done" ? "✓ Done!" : "Skipped"}</span></p>
            {partnerAnswer && <p className="text-xs text-softdark/50">{partnerName}: <span className="font-medium text-plum">{partnerAnswer === "done" ? "✓ Done!" : "Skipped"}</span></p>}
          </ResultBox>
        )}
      </>
    ) : null}
  </div>
);

const TextInputGame = ({ label, placeholder, inputId, myAnswer, onSubmit, partnerAnswer, partnerName, loading }) => (
  <div className="space-y-4">
    {loading ? <Spinner /> : label ? (
      <>
        <div className="bg-rose/10 rounded-2xl p-5 border border-rose/20 text-center">
          <p className="font-serif text-lg text-softdark">{label}</p>
        </div>
        {!myAnswer ? (
          <div className="space-y-3">
            <input id={inputId} placeholder={placeholder}
              className="w-full bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark"
              onKeyDown={e => e.key === "Enter" && onSubmit(document.getElementById(inputId)?.value)} />
            <button onClick={() => onSubmit(document.getElementById(inputId)?.value)}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-plum to-plum-light text-white text-sm font-medium shadow-plum">Submit ♥</button>
          </div>
        ) : (
          <ResultBox partnerAnswer={partnerAnswer} partnerName={partnerName}>
            <p className="text-xs text-softdark/50">You: <span className="font-medium text-plum">"{myAnswer}"</span></p>
            {partnerAnswer && <p className="text-xs text-softdark/50">{partnerName}: <span className="font-medium text-plum">"{partnerAnswer}"</span></p>}
          </ResultBox>
        )}
      </>
    ) : null}
  </div>
);

const EmojiGame = ({ question, myAnswer, onSubmit, partnerAnswer, partnerName, loading }) => (
  <div className="space-y-4">
    {loading ? <Spinner label="Generating puzzle..." /> : question ? (
      <>
        <div className="bg-rose/10 rounded-2xl p-6 border border-rose/20 text-center space-y-2">
          <p className="text-5xl tracking-widest">{question.emoji}</p>
          <p className="text-xs text-softdark/40 italic">Hint: {question.hint}</p>
        </div>
        {!myAnswer ? (
          <div className="space-y-3">
            <input id="emoji-input" placeholder="What does this mean?"
              className="w-full bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark"
              onKeyDown={e => e.key === "Enter" && onSubmit(document.getElementById("emoji-input")?.value)} />
            <button onClick={() => onSubmit(document.getElementById("emoji-input")?.value)}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-plum to-plum-light text-white text-sm font-medium shadow-plum">Submit</button>
          </div>
        ) : (
          <div className="space-y-3">
            <ResultBox partnerAnswer={partnerAnswer} partnerName={partnerName}>
              <p className="text-xs text-softdark/50">You: <span className="font-medium text-plum">{myAnswer}</span></p>
              {partnerAnswer && <p className="text-xs text-softdark/50">{partnerName}: <span className="font-medium text-plum">{partnerAnswer}</span></p>}
            </ResultBox>
            {partnerAnswer && <div className="bg-green-50 rounded-2xl p-3 border border-green-200 text-center"><p className="text-xs text-green-600 font-medium">✓ Answer: {question.answer}</p></div>}
          </div>
        )}
      </>
    ) : null}
  </div>
);

const ScrambleGame = ({ question, myAnswer, onSubmit, partnerAnswer, partnerName, loading }) => (
  <div className="space-y-4">
    {loading ? <Spinner label="Generating scramble..." /> : question ? (
      <>
        <div className="bg-rose/10 rounded-2xl p-6 border border-rose/20 text-center space-y-3">
          <p className="text-xs text-softdark/40 uppercase tracking-widest">Unscramble this word</p>
          <div className="flex justify-center gap-2 flex-wrap">
            {question.scrambled.split("").map((l, i) => (
              <span key={i} className="w-10 h-10 flex items-center justify-center bg-white rounded-xl border-2 border-plum/20 font-mono font-bold text-plum text-lg shadow-soft">{l}</span>
            ))}
          </div>
          <p className="text-xs text-softdark/40 italic">Hint: {question.hint}</p>
        </div>
        {!myAnswer ? (
          <div className="space-y-3">
            <input id="scramble-input" placeholder="Type the word..."
              className="w-full bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark uppercase tracking-widest text-center font-mono"
              onKeyDown={e => e.key === "Enter" && onSubmit(document.getElementById("scramble-input")?.value)} />
            <button onClick={() => onSubmit(document.getElementById("scramble-input")?.value)}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-plum to-plum-light text-white text-sm font-medium shadow-plum">Submit</button>
          </div>
        ) : (
          <div className="space-y-3">
            <ResultBox partnerAnswer={partnerAnswer} partnerName={partnerName}>
              <p className="text-xs text-softdark/50">You: <span className="font-mono font-bold text-plum">{myAnswer.toUpperCase()}</span></p>
              {partnerAnswer && <p className="text-xs text-softdark/50">{partnerName}: <span className="font-mono font-bold text-plum">{partnerAnswer.toUpperCase()}</span></p>}
            </ResultBox>
            {partnerAnswer && (
              <div className={`rounded-2xl p-3 border text-center ${myAnswer.toUpperCase() === question.answer ? "bg-green-50 border-green-200" : "bg-red-50 border-red-100"}`}>
                <p className={`text-xs font-medium ${myAnswer.toUpperCase() === question.answer ? "text-green-600" : "text-red-500"}`}>
                  {myAnswer.toUpperCase() === question.answer ? "✓ Correct!" : `✗ Answer: ${question.answer}`}
                </p>
              </div>
            )}
          </div>
        )}
      </>
    ) : null}
  </div>
);

const StoryGame = ({ question, myAnswer, onSubmit, allParts, partnerName, loading }) => {
  const [input, setInput] = useState("");
  return (
    <div className="space-y-4">
      {loading ? <Spinner label="Starting story..." /> : question ? (
        <>
          <div className="bg-rose/10 rounded-2xl p-5 border border-rose/20">
            <p className="text-xs uppercase tracking-widest text-plum/40 mb-3">Your story so far...</p>
            <p className="font-serif text-softdark leading-relaxed">
              {question.starter}{(allParts || []).map((p, i) => <span key={i}> {p.text}</span>)}
            </p>
          </div>
          {!myAnswer ? (
            <div className="space-y-3">
              <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Add the next sentence..." rows={2}
                className="w-full bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark resize-none" />
              <button onClick={() => { onSubmit(input); setInput(""); }} disabled={!input.trim()}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-plum to-plum-light text-white text-sm font-medium shadow-plum disabled:opacity-40">
                Add to Story ✍️
              </button>
            </div>
          ) : (
            <div className="bg-rose/10 rounded-2xl p-4 border border-rose/20 text-center">
              <p className="text-xs text-softdark/50">Added! Waiting for {partnerName} to continue...</p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};

const TriviaGame = ({ question, myAnswer, onAnswer, partnerAnswer, partnerName, loading }) => (
  <div className="space-y-4">
    {loading ? <Spinner label="Generating trivia..." /> : question ? (
      <>
        <div className="bg-rose/10 rounded-2xl p-5 border border-rose/20 text-center">
          <p className="font-serif text-lg text-softdark">{question.question}</p>
        </div>
        <div className="space-y-2">
          {(question.options || []).map((opt, i) => (
            <motion.button key={i} whileTap={{ scale: 0.98 }} onClick={() => !myAnswer && onAnswer(opt)}
              className={`w-full p-3 rounded-2xl border text-sm text-left transition-all ${
                myAnswer === opt ? opt === question.answer ? "bg-green-100 border-green-300 text-green-700" : "bg-red-50 border-red-200 text-red-500"
                : myAnswer && opt === question.answer ? "bg-green-100 border-green-300 text-green-700"
                : myAnswer ? "bg-white/40 text-softdark/40 border-rose/10 cursor-default"
                : "bg-white/70 text-softdark border-rose/20 hover:border-plum/30"}`}>
              <span className="font-bold mr-2 text-xs opacity-40">{["A","B","C","D"][i]}</span>{opt}
            </motion.button>
          ))}
        </div>
        {myAnswer && (
          <ResultBox partnerAnswer={partnerAnswer} partnerName={partnerName}>
            {partnerAnswer && <p className="text-xs text-softdark/50">{partnerName}: <span className="font-medium text-plum">{partnerAnswer}</span></p>}
            {partnerAnswer && <p className="text-xs text-green-600 font-medium">✓ Answer: {question.answer}</p>}
          </ResultBox>
        )}
      </>
    ) : null}
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Games() {
  const { user, userData, coupleData } = useAuth();
  const [selectedGame, setSelectedGame] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [myAnswer, setMyAnswer] = useState(null);
  const [partnerAnswer, setPartnerAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [storyParts, setStoryParts] = useState([]);
  const [partner, setPartner] = useState(null);

  const coupleId = coupleData?.id;
  const gameRef = coupleId ? doc(db, "couples", coupleId, "gameState", "current") : null;
  const isFirst = user.uid === coupleData?.members?.[0];
  const myKey = isFirst ? "answer1" : "answer2";
  const partnerKey = isFirst ? "answer2" : "answer1";

  useEffect(() => {
    if (!coupleData?.members || coupleData.members.length < 2) return;
    const partnerUid = coupleData.members.find(id => id !== user.uid);
    if (!partnerUid) return;
    getDoc(doc(db, "users", partnerUid)).then(snap => { if (snap.exists()) setPartner(snap.data()); });
  }, [coupleData, user]);

  useEffect(() => {
    if (!gameRef) return;
    const unsub = onSnapshot(gameRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setGameState(data);
      setMyAnswer(data[myKey] ?? null);
      setPartnerAnswer(data[partnerKey] ?? null);
      if (data.storyParts) setStoryParts(data.storyParts);
    });
    return () => unsub();
  }, [coupleId, myKey, partnerKey]);

  const startGame = async (game, level) => {
    setSelectedGame(game);
    setSelectedLevel(level);
    setMyAnswer(null);
    setPartnerAnswer(null);
    setError("");
    setLoading(true);
    try {
      const question = await generateQuestion(
        game.id, level,
        partner?.displayName || "Partner",
        userData?.displayName || "You"
      );
      await setDoc(gameRef, {
        gameId: game.id, level, question,
        answer1: null, answer2: null,
        storyParts: [], updatedAt: serverTimestamp()
      });
    } catch (err) {
      setError(err.message);
      setSelectedGame(null);
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async (answer) => {
    if (!answer?.trim() || !gameRef) return;
    await setDoc(gameRef, { [myKey]: answer.trim() }, { merge: true });
  };

  const nextQuestion = async () => {
    if (!selectedGame || !selectedLevel) return;
    setMyAnswer(null);
    setPartnerAnswer(null);
    setError("");
    setLoading(true);
    try {
      const question = await generateQuestion(
        selectedGame.id, selectedLevel,
        partner?.displayName || "Partner",
        userData?.displayName || "You"
      );
      await setDoc(gameRef, {
        gameId: selectedGame.id, level: selectedLevel, question,
        answer1: null, answer2: null,
        storyParts: gameState?.storyParts || [],
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addStoryPart = async (text) => {
    if (!text?.trim() || !gameRef) return;
    const newParts = [...(gameState?.storyParts || []), { text, by: userData.displayName }];
    await setDoc(gameRef, { [myKey]: text, storyParts: newParts }, { merge: true });
    setTimeout(async () => {
      await setDoc(gameRef, { answer1: null, answer2: null }, { merge: true });
    }, 3000);
  };

  const renderGame = () => {
    if (!gameState || gameState.gameId !== selectedGame?.id) return null;
    const q = gameState.question;
    const pName = partner?.displayName || "Partner";
    switch (selectedGame.id) {
      case "wyr":      return <WYRGame question={q} myAnswer={myAnswer} partnerAnswer={partnerAnswer} onAnswer={submitAnswer} partnerName={pName} loading={loading} />;
      case "tod":      return <TODGame question={q} myAnswer={myAnswer} onAnswer={submitAnswer} partnerAnswer={partnerAnswer} partnerName={pName} loading={loading} />;
      case "hwyknm":   return <TextInputGame label={q?.question} placeholder="Your answer..." inputId="hwyknm-input" myAnswer={myAnswer} onSubmit={submitAnswer} partnerAnswer={partnerAnswer} partnerName={pName} loading={loading} />;
      case "emoji":    return <EmojiGame question={q} myAnswer={myAnswer} onSubmit={submitAnswer} partnerAnswer={partnerAnswer} partnerName={pName} loading={loading} />;
      case "scramble": return <ScrambleGame question={q} myAnswer={myAnswer} onSubmit={submitAnswer} partnerAnswer={partnerAnswer} partnerName={pName} loading={loading} />;
      case "story":    return <StoryGame question={q} myAnswer={myAnswer} onSubmit={addStoryPart} allParts={storyParts} partnerName={pName} loading={loading} />;
      case "trivia":   return <TriviaGame question={q} myAnswer={myAnswer} onAnswer={submitAnswer} partnerAnswer={partnerAnswer} partnerName={pName} loading={loading} />;
      case "finish":   return <TextInputGame label={q?.prompt} placeholder="Complete the sentence..." inputId="finish-input" myAnswer={myAnswer} onSubmit={submitAnswer} partnerAnswer={partnerAnswer} partnerName={pName} loading={loading} />;
      default:         return null;
    }
  };

  return (
    <div className="min-h-screen bg-petal">
      <div className="bg-white/60 backdrop-blur-md border-b border-rose/20 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-plum/50 hover:text-plum bg-white/50 rounded-2xl px-3 py-2 border border-rose/20 transition-colors text-sm">← Back</Link>
            <div>
              <h1 className="font-serif text-2xl text-softdark">Games 🎮</h1>
              <p className="text-xs text-softdark/40">Play together ♥</p>
            </div>
          </div>
          {selectedGame && (
            <button onClick={() => { setSelectedGame(null); setSelectedLevel(null); setMyAnswer(null); setPartnerAnswer(null); setError(""); }}
              className="text-xs text-plum/50 hover:text-plum bg-white/50 rounded-2xl px-3 py-2 border border-rose/20 transition-colors">
              ← Games
            </button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center">
            <p className="text-sm text-red-500">{error}</p>
            <button onClick={() => setError("")} className="text-xs text-red-400 mt-1 underline">Dismiss</button>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {!selectedGame && (
            <motion.div key="selection" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {GAMES.map(game => (
                <motion.div key={game.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-white/70 backdrop-blur-sm rounded-3xl border border-white/80 shadow-soft p-5">
                  <div className="flex items-start gap-4 mb-4">
                    <span className="text-3xl">{game.icon}</span>
                    <div className="flex-1">
                      <p className="font-serif text-lg text-softdark">{game.label}</p>
                      <p className="text-xs text-softdark/40 mt-0.5">{game.desc}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {game.levels.map(level => (
                      <button key={level} onClick={() => startGame(game, level)}
                        className={`text-xs px-4 py-2 rounded-full border font-medium transition-all active:scale-95 touch-manipulation ${LEVEL_COLORS[level]}`}>
                        {level}
                      </button>
                    ))}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {selectedGame && (
            <motion.div key="game" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="bg-white/70 backdrop-blur-sm rounded-3xl border border-white/80 shadow-soft p-3 md:p-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{selectedGame.icon}</span>
                  <div>
                    <p className="font-medium text-softdark text-sm">{selectedGame.label}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${LEVEL_COLORS[selectedLevel]}`}>{selectedLevel}</span>
                  </div>
                </div>
                <button onClick={nextQuestion} disabled={loading}
                  className="text-xs bg-rose/10 text-plum border border-rose/20 rounded-2xl px-3 py-2 hover:bg-rose/20 transition-colors disabled:opacity-40 whitespace-nowrap">
                  Next ↻
                </button>
              </div>

              <div className="bg-white/70 backdrop-blur-sm rounded-3xl border border-white/80 shadow-soft p-5">
                {renderGame()}
              </div>

              {myAnswer && partnerAnswer && selectedGame.id !== "story" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <button onClick={nextQuestion} disabled={loading}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-plum to-plum-light text-white text-sm font-medium shadow-plum hover:-translate-y-0.5 transition-all disabled:opacity-40">
                    {loading ? "LoveBridge is thinking..." : "Next Question ↻"}
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
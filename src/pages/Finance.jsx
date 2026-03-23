import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection, addDoc, onSnapshot, query, orderBy,
  deleteDoc, doc, setDoc, getDoc, serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { format } from "date-fns";

const CATEGORIES = [
  { id: "food",      icon: "🍕", label: "Food" },
  { id: "travel",    icon: "✈️", label: "Travel" },
  { id: "gifts",     icon: "🎁", label: "Gifts" },
  { id: "date",      icon: "🌹", label: "Date Night" },
  { id: "shopping",  icon: "🛍️", label: "Shopping" },
  { id: "movies",    icon: "🎬", label: "Movies" },
  { id: "other",     icon: "💸", label: "Other" },
];

const getCategoryIcon = (id) => CATEGORIES.find(c => c.id === id)?.icon || "💸";
const getCategoryLabel = (id) => CATEGORIES.find(c => c.id === id)?.label || "Other";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

export default function Finance() {
  const { user, userData, coupleData } = useAuth();
  const [tab, setTab] = useState("expenses");
  const [expenses, setExpenses] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [dateFund, setDateFund] = useState(null);
  const [partner, setPartner] = useState(null);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddWish, setShowAddWish] = useState(false);
  const [showDateFund, setShowDateFund] = useState(false);

  const [expenseForm, setExpenseForm] = useState({
    title: "", amount: "", category: "food", paidBy: "me", splitType: "equal",
  });
  const [wishForm, setWishForm] = useState({ title: "", price: "", link: "", forWhom: "partner" });
  const [fundForm, setFundForm] = useState({ goal: "", current: "", title: "" });

  const coupleId = coupleData?.id;

  // Get partner
  useEffect(() => {
    if (!coupleData?.members || coupleData.members.length < 2) return;
    const partnerUid = coupleData.members.find(id => id !== user.uid);
    if (!partnerUid) return;
    getDoc(doc(db, "users", partnerUid)).then(snap => {
      if (snap.exists()) setPartner(snap.data());
    });
  }, [coupleData, user]);

  // Listen to expenses
  useEffect(() => {
    if (!coupleId) return;
    const q = query(collection(db, "couples", coupleId, "expenses"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [coupleId]);

  // Listen to wishlist
  useEffect(() => {
    if (!coupleId) return;
    const q = query(collection(db, "couples", coupleId, "wishlist"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => setWishlist(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [coupleId]);

  // Listen to date fund
  useEffect(() => {
    if (!coupleId) return;
    return onSnapshot(doc(db, "couples", coupleId, "dateFund", "main"), snap => {
      if (snap.exists()) setDateFund(snap.data());
    });
  }, [coupleId]);

  // ── Add expense ──────────────────────────────────────────────────────────────
  const addExpense = async () => {
    if (!expenseForm.title || !expenseForm.amount) return;
    const amount = parseFloat(expenseForm.amount);
    const paidByName = expenseForm.paidBy === "me" ? userData.displayName : partner?.displayName || "Partner";
    const myShare = expenseForm.splitType === "equal" ? amount / 2 : expenseForm.paidBy === "me" ? 0 : amount;
    const partnerShare = expenseForm.splitType === "equal" ? amount / 2 : expenseForm.paidBy === "me" ? amount : 0;

    await addDoc(collection(db, "couples", coupleId, "expenses"), {
      title: expenseForm.title,
      amount,
      category: expenseForm.category,
      paidBy: expenseForm.paidBy,
      paidByName,
      paidByUid: expenseForm.paidBy === "me" ? user.uid : partner?.uid || "",
      splitType: expenseForm.splitType,
      myShare,
      partnerShare,
      createdAt: serverTimestamp(),
      addedBy: userData.displayName,
    });
    setExpenseForm({ title: "", amount: "", category: "food", paidBy: "me", splitType: "equal" });
    setShowAddExpense(false);
  };

  // ── Add wish ─────────────────────────────────────────────────────────────────
  const addWish = async () => {
    if (!wishForm.title) return;
    await addDoc(collection(db, "couples", coupleId, "wishlist"), {
      title: wishForm.title,
      price: wishForm.price ? parseFloat(wishForm.price) : null,
      link: wishForm.link,
      forWhom: wishForm.forWhom,
      forName: wishForm.forWhom === "me" ? userData.displayName : partner?.displayName || "Partner",
      addedBy: userData.displayName,
      addedByUid: user.uid,
      purchased: false,
      createdAt: serverTimestamp(),
    });
    setWishForm({ title: "", price: "", link: "", forWhom: "partner" });
    setShowAddWish(false);
  };

  // ── Save date fund ────────────────────────────────────────────────────────────
  const saveDateFund = async () => {
    if (!fundForm.goal || !fundForm.title) return;
    await setDoc(doc(db, "couples", coupleId, "dateFund", "main"), {
      title: fundForm.title,
      goal: parseFloat(fundForm.goal),
      current: parseFloat(fundForm.current || 0),
      updatedAt: serverTimestamp(),
    });
    setFundForm({ goal: "", current: "", title: "" });
    setShowDateFund(false);
  };

  const togglePurchased = async (item) => {
    await setDoc(doc(db, "couples", coupleId, "wishlist", item.id), { ...item, purchased: !item.purchased });
  };

  const deleteExpense = async (id) => {
    if (!confirm("Delete this expense?")) return;
    await deleteDoc(doc(db, "couples", coupleId, "expenses", id));
  };

  const deleteWish = async (id) => {
    await deleteDoc(doc(db, "couples", coupleId, "wishlist", id));
  };

  // ── Calculations ──────────────────────────────────────────────────────────────
  const totalSpent = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const myTotal = expenses.filter(e => e.paidBy === "me" || e.paidByUid === user.uid).reduce((sum, e) => sum + (e.amount || 0), 0);
  const partnerTotal = totalSpent - myTotal;
  const balance = myTotal - partnerTotal;

  const byCategory = CATEGORIES.map(cat => ({
    ...cat,
    total: expenses.filter(e => e.category === cat.id).reduce((sum, e) => sum + (e.amount || 0), 0),
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  const fundProgress = dateFund ? Math.min((dateFund.current / dateFund.goal) * 100, 100) : 0;

  const TABS = [
    { id: "expenses", label: "💸 Expenses" },
    { id: "split",    label: "⚖️ Split" },
    { id: "wishlist", label: "🎁 Wishlist" },
    { id: "fund",     label: "🎯 Date Fund" },
  ];

  const ef = (field) => (e) => setExpenseForm(p => ({ ...p, [field]: e.target.value }));
  const wf = (field) => (e) => setWishForm(p => ({ ...p, [field]: e.target.value }));
  const ff = (field) => (e) => setFundForm(p => ({ ...p, [field]: e.target.value }));

  return (
    <div className="min-h-screen bg-petal">
      {/* Header */}
      <div className="bg-white/60 backdrop-blur-md border-b border-rose/20 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-plum/50 hover:text-plum bg-white/50 rounded-2xl px-3 py-2 border border-rose/20 transition-colors text-sm">← Back</Link>
            <div>
              <h1 className="font-serif text-2xl text-softdark">Finance 💸</h1>
              <p className="text-xs text-softdark/40">Track together ♥</p>
            </div>
          </div>
        </div>
        <div className="max-w-2xl mx-auto mt-3 flex bg-rose/10 rounded-2xl p-1 gap-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-all ${tab === t.id ? "bg-white text-plum shadow-soft" : "text-softdark/50 hover:text-plum"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <AnimatePresence mode="wait">

          {/* ── Expenses Tab ──────────────────────────────────────────────────── */}
          {tab === "expenses" && (
            <motion.div key="expenses" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total Spent", value: formatCurrency(totalSpent), emoji: "💸" },
                  { label: userData?.displayName || "You", value: formatCurrency(myTotal), emoji: "👤" },
                  { label: partner?.displayName || "Partner", value: formatCurrency(partnerTotal), emoji: "👤" },
                ].map(s => (
                  <div key={s.label} className="bg-white/70 rounded-2xl p-3 border border-white/80 shadow-soft text-center">
                    <p className="text-lg">{s.emoji}</p>
                    <p className="font-serif text-lg text-plum">{s.value}</p>
                    <p className="text-xs text-softdark/40 truncate">{s.label}</p>
                  </div>
                ))}
              </div>

              <button onClick={() => setShowAddExpense(true)}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-plum to-plum-light text-white text-sm font-medium shadow-plum hover:-translate-y-0.5 transition-all">
                + Add Expense
              </button>

              {expenses.length === 0 ? (
                <div className="text-center py-16 bg-white/40 rounded-3xl border border-white/60">
                  <p className="text-4xl mb-3">💸</p>
                  <p className="font-serif text-xl text-softdark">No expenses yet</p>
                  <p className="text-sm text-softdark/40 mt-1">Track what you spend together ♥</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {expenses.map(expense => (
                    <motion.div key={expense.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/80 shadow-soft">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{getCategoryIcon(expense.category)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-softdark text-sm truncate">{expense.title}</p>
                          <p className="text-xs text-softdark/40">
                            Paid by {expense.paidByName} · {getCategoryLabel(expense.category)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-plum">{formatCurrency(expense.amount)}</p>
                          <p className="text-xs text-softdark/30">
                            {expense.splitType === "equal" ? `Each: ${formatCurrency(expense.amount / 2)}` : "Full"}
                          </p>
                        </div>
                        <button onClick={() => deleteExpense(expense.id)}
                          className="text-softdark/20 hover:text-red-400 transition-colors ml-2">✕</button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Split Tab ─────────────────────────────────────────────────────── */}
          {tab === "split" && (
            <motion.div key="split" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* Balance */}
              <div className={`rounded-3xl p-6 text-center border ${balance > 0 ? "bg-green-50 border-green-200" : balance < 0 ? "bg-red-50 border-red-100" : "bg-rose/10 border-rose/20"}`}>
                {balance === 0 ? (
                  <div>
                    <p className="text-4xl mb-2">⚖️</p>
                    <p className="font-serif text-xl text-softdark">You're all settled up!</p>
                    <p className="text-xs text-softdark/40 mt-1">No one owes anyone anything ♥</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-4xl mb-2">{balance > 0 ? "💚" : "🔴"}</p>
                    <p className="font-serif text-xl text-softdark">
                      {balance > 0 ? `${partner?.displayName || "Partner"} owes you` : `You owe ${partner?.displayName || "Partner"}`}
                    </p>
                    <p className="font-serif text-3xl text-plum mt-1">{formatCurrency(Math.abs(balance))}</p>
                  </div>
                )}
              </div>

              {/* By category */}
              {byCategory.length > 0 && (
                <div className="bg-white/70 rounded-3xl border border-white/80 shadow-soft p-5 space-y-4">
                  <p className="text-xs uppercase tracking-widest text-plum/40 font-medium">Spending by category</p>
                  {byCategory.map(cat => (
                    <div key={cat.id} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-softdark flex items-center gap-2">
                          <span>{cat.icon}</span>{cat.label}
                        </span>
                        <span className="text-sm font-medium text-plum">{formatCurrency(cat.total)}</span>
                      </div>
                      <div className="w-full bg-rose/10 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-gradient-to-r from-plum to-plum-light transition-all"
                          style={{ width: `${(cat.total / totalSpent) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Breakdown */}
              <div className="bg-white/70 rounded-3xl border border-white/80 shadow-soft p-5 space-y-3">
                <p className="text-xs uppercase tracking-widest text-plum/40 font-medium">Breakdown</p>
                {[
                  { name: userData?.displayName || "You", paid: myTotal, owes: expenses.filter(e => e.paidByUid !== user.uid && e.splitType === "equal").reduce((s, e) => s + e.amount / 2, 0) },
                  { name: partner?.displayName || "Partner", paid: partnerTotal, owes: expenses.filter(e => e.paidByUid === user.uid && e.splitType === "equal").reduce((s, e) => s + e.amount / 2, 0) },
                ].map(p => (
                  <div key={p.name} className="flex items-center justify-between p-3 bg-rose/5 rounded-2xl">
                    <p className="text-sm font-medium text-softdark">{p.name}</p>
                    <div className="text-right">
                      <p className="text-xs text-softdark/50">Paid: <span className="text-plum font-medium">{formatCurrency(p.paid)}</span></p>
                      <p className="text-xs text-softdark/50">Owes: <span className="text-plum font-medium">{formatCurrency(p.owes)}</span></p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Wishlist Tab ──────────────────────────────────────────────────── */}
          {tab === "wishlist" && (
            <motion.div key="wishlist" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <button onClick={() => setShowAddWish(true)}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-plum to-plum-light text-white text-sm font-medium shadow-plum hover:-translate-y-0.5 transition-all">
                + Add to Wishlist
              </button>

              {wishlist.length === 0 ? (
                <div className="text-center py-16 bg-white/40 rounded-3xl border border-white/60">
                  <p className="text-4xl mb-3">🎁</p>
                  <p className="font-serif text-xl text-softdark">Wishlist is empty</p>
                  <p className="text-sm text-softdark/40 mt-1">Add things you'd love to give or receive ♥</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {["me", "partner"].map(whom => {
                    const items = wishlist.filter(w => w.forWhom === whom);
                    if (items.length === 0) return null;
                    return (
                      <div key={whom}>
                        <p className="text-xs uppercase tracking-widest text-plum/40 font-medium mb-2">
                          {whom === "me" ? `For ${userData?.displayName || "You"}` : `For ${partner?.displayName || "Partner"}`}
                        </p>
                        <div className="space-y-2">
                          {items.map(item => (
                            <motion.div key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                              className={`bg-white/70 rounded-2xl p-4 border shadow-soft flex items-center gap-3 transition-all ${item.purchased ? "opacity-50 border-green-200" : "border-white/80"}`}>
                              <button onClick={() => togglePurchased(item)}
                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${item.purchased ? "bg-green-400 border-green-400 text-white" : "border-rose/30 hover:border-plum/40"}`}>
                                {item.purchased && <span className="text-xs">✓</span>}
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium text-softdark ${item.purchased ? "line-through" : ""}`}>{item.title}</p>
                                <p className="text-xs text-softdark/40">
                                  {item.price ? formatCurrency(item.price) : "No price"} · Added by {item.addedBy}
                                </p>
                              </div>
                              {item.link && (
                                <a href={item.link} target="_blank" rel="noreferrer"
                                  className="text-xs text-plum/50 hover:text-plum transition-colors">🔗</a>
                              )}
                              <button onClick={() => deleteWish(item.id)}
                                className="text-softdark/20 hover:text-red-400 transition-colors">✕</button>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Date Fund Tab ─────────────────────────────────────────────────── */}
          {tab === "fund" && (
            <motion.div key="fund" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {dateFund ? (
                <>
                  <div className="bg-white/70 rounded-3xl border border-white/80 shadow-soft p-6 space-y-4">
                    <div className="text-center">
                      <p className="text-4xl mb-2">🎯</p>
                      <p className="font-serif text-2xl text-softdark">{dateFund.title}</p>
                      <p className="text-sm text-softdark/40 mt-1">Saving for your next meetup</p>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-softdark/50">Progress</span>
                        <span className="font-medium text-plum">{Math.round(fundProgress)}%</span>
                      </div>
                      <div className="w-full bg-rose/10 rounded-full h-3">
                        <motion.div className="h-3 rounded-full bg-gradient-to-r from-plum to-plum-light"
                          initial={{ width: 0 }}
                          animate={{ width: `${fundProgress}%` }}
                          transition={{ duration: 1, ease: "easeOut" }} />
                      </div>
                      <div className="flex justify-between text-xs text-softdark/40 mt-1">
                        <span>{formatCurrency(dateFund.current)} saved</span>
                        <span>{formatCurrency(dateFund.goal)} goal</span>
                      </div>
                    </div>
                    {fundProgress >= 100 && (
                      <div className="bg-green-50 rounded-2xl p-4 border border-green-200 text-center">
                        <p className="text-2xl mb-1">🎉</p>
                        <p className="text-sm font-medium text-green-600">Goal reached! Time to plan that date!</p>
                      </div>
                    )}
                  </div>
                  <button onClick={() => { setFundForm({ goal: dateFund.goal, current: dateFund.current, title: dateFund.title }); setShowDateFund(true); }}
                    className="w-full py-3 rounded-2xl bg-rose/10 text-plum border border-rose/20 text-sm font-medium hover:bg-rose/20 transition-all">
                    ✏️ Update Fund
                  </button>
                </>
              ) : (
                <div className="text-center py-16 bg-white/40 rounded-3xl border border-white/60">
                  <p className="text-4xl mb-3">🎯</p>
                  <p className="font-serif text-xl text-softdark">No date fund yet</p>
                  <p className="text-sm text-softdark/40 mt-1 mb-6">Start saving for your next meetup ♥</p>
                  <button onClick={() => setShowDateFund(true)}
                    className="bg-gradient-to-r from-plum to-plum-light text-white rounded-2xl px-6 py-3 text-sm font-medium shadow-plum">
                    Create Date Fund 🎯
                  </button>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── Add Expense Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddExpense && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-softdark/20 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="bg-white/90 backdrop-blur-xl rounded-4xl shadow-plum p-6 w-full max-w-sm space-y-4 mt-4 mb-20">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl text-softdark">Add Expense</h2>
                <button onClick={() => setShowAddExpense(false)} className="bg-rose/10 hover:bg-rose/20 text-softdark rounded-full w-8 h-8 flex items-center justify-center text-sm transition-colors">✕</button>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-plum/50 mb-1.5">What was it?</label>
                <input value={expenseForm.title} onChange={ef("title")} placeholder="e.g. Dinner at Pizza place"
                  className="w-full bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-plum/50 mb-1.5">Amount (₹)</label>
                <input type="number" value={expenseForm.amount} onChange={ef("amount")} placeholder="0"
                  className="w-full bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-plum/50 mb-2">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button key={cat.id} onClick={() => setExpenseForm(p => ({ ...p, category: cat.id }))}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${expenseForm.category === cat.id ? "bg-plum text-white border-plum" : "bg-white text-softdark/60 border-rose/30"}`}>
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-plum/50 mb-2">Paid by</label>
                <div className="flex gap-2">
                  {[{ id: "me", label: userData?.displayName || "Me" }, { id: "partner", label: partner?.displayName || "Partner" }].map(p => (
                    <button key={p.id} onClick={() => setExpenseForm(prev => ({ ...prev, paidBy: p.id }))}
                      className={`flex-1 py-2 rounded-2xl border text-xs font-medium transition-all ${expenseForm.paidBy === p.id ? "bg-plum text-white border-plum" : "bg-white text-softdark/60 border-rose/30"}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-plum/50 mb-2">Split</label>
                <div className="flex gap-2">
                  {[{ id: "equal", label: "Split equally" }, { id: "full", label: "Paid in full" }].map(s => (
                    <button key={s.id} onClick={() => setExpenseForm(p => ({ ...p, splitType: s.id }))}
                      className={`flex-1 py-2 rounded-2xl border text-xs font-medium transition-all ${expenseForm.splitType === s.id ? "bg-plum text-white border-plum" : "bg-white text-softdark/60 border-rose/30"}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={addExpense} disabled={!expenseForm.title || !expenseForm.amount}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-plum to-plum-light text-white text-sm font-medium shadow-plum disabled:opacity-40">
                Save Expense ✓
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add Wish Modal ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddWish && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-softdark/20 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="bg-white/90 backdrop-blur-xl rounded-4xl shadow-plum p-6 w-full max-w-sm space-y-4 mt-4 mb-20">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl text-softdark">Add to Wishlist</h2>
                <button onClick={() => setShowAddWish(false)} className="bg-rose/10 hover:bg-rose/20 text-softdark rounded-full w-8 h-8 flex items-center justify-center text-sm transition-colors">✕</button>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-plum/50 mb-1.5">What is it?</label>
                <input value={wishForm.title} onChange={wf("title")} placeholder="e.g. Wireless earbuds"
                  className="w-full bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-plum/50 mb-1.5">Price (₹, optional)</label>
                <input type="number" value={wishForm.price} onChange={wf("price")} placeholder="0"
                  className="w-full bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-plum/50 mb-1.5">Link (optional)</label>
                <input value={wishForm.link} onChange={wf("link")} placeholder="https://..."
                  className="w-full bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-plum/50 mb-2">This is for</label>
                <div className="flex gap-2">
                  {[{ id: "me", label: `Me (${userData?.displayName || "You"})` }, { id: "partner", label: partner?.displayName || "Partner" }].map(p => (
                    <button key={p.id} onClick={() => setWishForm(prev => ({ ...prev, forWhom: p.id }))}
                      className={`flex-1 py-2 rounded-2xl border text-xs font-medium transition-all ${wishForm.forWhom === p.id ? "bg-plum text-white border-plum" : "bg-white text-softdark/60 border-rose/30"}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={addWish} disabled={!wishForm.title}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-plum to-plum-light text-white text-sm font-medium shadow-plum disabled:opacity-40">
                Add to Wishlist 🎁
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Date Fund Modal ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showDateFund && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-softdark/20 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="bg-white/90 backdrop-blur-xl rounded-4xl shadow-plum p-6 w-full max-w-sm space-y-4 mt-4 mb-20">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl text-softdark">Date Fund 🎯</h2>
                <button onClick={() => setShowDateFund(false)} className="bg-rose/10 hover:bg-rose/20 text-softdark rounded-full w-8 h-8 flex items-center justify-center text-sm transition-colors">✕</button>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-plum/50 mb-1.5">What are you saving for?</label>
                <input value={fundForm.title} onChange={ff("title")} placeholder="e.g. Mumbai trip 🌊"
                  className="w-full bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-plum/50 mb-1.5">Goal amount (₹)</label>
                <input type="number" value={fundForm.goal} onChange={ff("goal")} placeholder="e.g. 5000"
                  className="w-full bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-plum/50 mb-1.5">Already saved (₹)</label>
                <input type="number" value={fundForm.current} onChange={ff("current")} placeholder="0"
                  className="w-full bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark" />
              </div>
              <button onClick={saveDateFund} disabled={!fundForm.title || !fundForm.goal}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-plum to-plum-light text-white text-sm font-medium shadow-plum disabled:opacity-40">
                Save Fund 🎯
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
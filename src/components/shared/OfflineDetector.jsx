import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function OfflineDetector() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBack, setShowBack] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowBack(true);
      setTimeout(() => setShowBack(false), 3000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowBack(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {(!isOnline || showBack) && (
        <motion.div
          initial={{ opacity: 0, y: -60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -60 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] pointer-events-none"
        >
          <div className={`rounded-2xl px-5 py-3 text-sm font-medium shadow-lg flex items-center gap-2 ${
            isOnline
              ? "bg-green-50 text-green-600 border border-green-200"
              : "bg-softdark text-white border border-white/10"
          }`}>
            {isOnline ? (
              <><span>✓</span> Back online!</>
            ) : (
              <><span className="w-2 h-2 rounded-full bg-red-400 animate-pulse inline-block" /> No internet connection</>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
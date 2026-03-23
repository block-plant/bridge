import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AuthProvider, useAuth } from "./context/AuthContext";
import FloatingCall from "./components/shared/FloatingCall";

// ── Lazy load all pages ───────────────────────────────────────────────────────
const Landing    = lazy(() => import("./pages/Landing"));
const Dashboard  = lazy(() => import("./pages/Dashboard"));
const Messages   = lazy(() => import("./pages/Messages"));
const Scrapbook  = lazy(() => import("./pages/Scrapbook"));
const Calendar   = lazy(() => import("./pages/Calendar"));
const MusicRoom  = lazy(() => import("./pages/MusicRoom"));
const Games      = lazy(() => import("./pages/Games"));
const Finance    = lazy(() => import("./pages/Finance"));
const VideoCall  = lazy(() => import("./pages/VideoCall"));

// ── Page loading skeleton ─────────────────────────────────────────────────────
const PageLoader = () => (
  <div className="min-h-screen bg-petal flex items-center justify-center">
    <div className="text-center space-y-4">
      <div className="text-4xl animate-pulse">♥</div>
      <div className="space-y-2">
        <div className="h-2 w-32 bg-rose/30 rounded-full mx-auto animate-pulse" />
        <div className="h-2 w-24 bg-rose/20 rounded-full mx-auto animate-pulse" />
      </div>
    </div>
  </div>
);

// ── Page transition wrapper ───────────────────────────────────────────────────
const PageTransition = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -16 }}
    transition={{ duration: 0.25, ease: "easeInOut" }}
    style={{ minHeight: "100vh" }}
  >
    {children}
  </motion.div>
);

// ── Route guards ──────────────────────────────────────────────────────────────
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/" replace />;
};

const PublicRoute = ({ children }) => {
  const { user } = useAuth();
  return !user ? children : <Navigate to="/dashboard" replace />;
};

// ── Inner router (must be inside BrowserRouter) ───────────────────────────────
function AppRoutes() {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <>
      {user && <FloatingCall />}
      <AnimatePresence mode="wait" initial={false}>
        <Suspense fallback={<PageLoader />}>
          <Routes location={location} key={location.pathname}>
            <Route path="/"          element={<PublicRoute><PageTransition><Landing /></PageTransition></PublicRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><PageTransition><Dashboard /></PageTransition></ProtectedRoute>} />
            <Route path="/messages"  element={<ProtectedRoute><PageTransition><Messages /></PageTransition></ProtectedRoute>} />
            <Route path="/scrapbook" element={<ProtectedRoute><PageTransition><Scrapbook /></PageTransition></ProtectedRoute>} />
            <Route path="/calendar"  element={<ProtectedRoute><PageTransition><Calendar /></PageTransition></ProtectedRoute>} />
            <Route path="/music"     element={<ProtectedRoute><PageTransition><MusicRoom /></PageTransition></ProtectedRoute>} />
            <Route path="/games"     element={<ProtectedRoute><PageTransition><Games /></PageTransition></ProtectedRoute>} />
            <Route path="/finance"   element={<ProtectedRoute><PageTransition><Finance /></PageTransition></ProtectedRoute>} />
            <Route path="/video"     element={<ProtectedRoute><PageTransition><VideoCall /></PageTransition></ProtectedRoute>} />
            <Route path="*"          element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AnimatePresence>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
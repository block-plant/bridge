import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";

// ── Lazy load all pages ───────────────────────────────────────────────────────
const Landing    = lazy(() => import("./pages/Landing"));
const Dashboard  = lazy(() => import("./pages/Dashboard"));
const Messages   = lazy(() => import("./pages/Messages"));
const Scrapbook  = lazy(() => import("./pages/Scrapbook"));
const Calendar   = lazy(() => import("./pages/Calendar"));
const MusicRoom  = lazy(() => import("./pages/MusicRoom"));
const Games      = lazy(() => import("./pages/Games"));
const Finance    = lazy(() => import("./pages/Finance"));

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

// ── Route guards ──────────────────────────────────────────────────────────────
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/" replace />;
};

const PublicRoute = ({ children }) => {
  const { user } = useAuth();
  return !user ? children : <Navigate to="/dashboard" replace />;
};

function AppRoutes() {
  const { user } = useAuth();
  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/"          element={<PublicRoute><Landing /></PublicRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/messages"  element={<ProtectedRoute><Messages /></ProtectedRoute>} />
          <Route path="/scrapbook" element={<ProtectedRoute><Scrapbook /></ProtectedRoute>} />
          <Route path="/calendar"  element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
          <Route path="/music"     element={<ProtectedRoute><MusicRoom /></ProtectedRoute>} />
          <Route path="/games"     element={<ProtectedRoute><Games /></ProtectedRoute>} />
          <Route path="/finance"   element={<ProtectedRoute><Finance /></ProtectedRoute>} />
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
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
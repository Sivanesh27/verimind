import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import AppLayout from './components/layout/AppLayout.jsx';
import { Spinner } from './components/ui/Badges.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/auth/Login.jsx';
import Register from './pages/auth/Register.jsx';
import VerifyEmail from './pages/auth/VerifyEmail.jsx';
import ForgotPassword from './pages/auth/ForgotPassword.jsx';
import Agent from './pages/Agent.jsx';
import History from './pages/History.jsx';
import Review from './pages/Review.jsx';
import Admin from './pages/Admin.jsx';
import NotFound from './pages/NotFound.jsx';

// Chart-heavy pages are split out of the main bundle.
const Monitor = lazy(() => import('./pages/Monitor.jsx'));
const Evaluation = lazy(() => import('./pages/Evaluation.jsx'));

function RequireAuth({ children, staff, admin }) {
  const { user, loading, isStaff, isAdmin } = useAuth();
  const location = useLocation();
  if (loading) return <div className="center-page"><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if ((staff && !isStaff) || (admin && !isAdmin)) return <Navigate to="/agent" replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-page"><Spinner /></div>;
  return user ? <Navigate to="/agent" replace /> : children;
}

export default function App() {
  return (
    <Suspense fallback={<div className="center-page"><Spinner /></div>}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
        <Route path="/verify" element={<GuestOnly><VerifyEmail /></GuestOnly>} />
        <Route path="/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />

        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route path="/agent" element={<Agent />} />
          <Route path="/history" element={<History />} />
          <Route path="/monitor" element={<Monitor />} />
          <Route path="/evaluation" element={<Evaluation />} />
          <Route path="/review" element={<RequireAuth staff><Review /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth admin><Admin /></RequireAuth>} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

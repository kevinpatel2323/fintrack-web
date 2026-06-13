import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Route gate. While the boot session check is in flight we show a spinner;
// once resolved we either redirect to /login or render the protected tree.
export default function RequireAuth() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="auth-screen">
        <div className="auth-spinner" aria-label="Loading" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

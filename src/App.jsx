import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import AppShell from './components/shell/AppShell.jsx';
import { Toaster } from './components/ui/Toast.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import RequireAuth from './components/RequireAuth.jsx';

import Dashboard from './pages/Dashboard.jsx';
import StatementImport from './pages/StatementImport.jsx';
import Transactions from './pages/Transactions.jsx';
import TransactionDetail from './pages/TransactionDetail.jsx';
import Calendar from './pages/Calendar.jsx';
import Friends from './pages/Friends.jsx';
import FriendDetail from './pages/FriendDetail.jsx';
import Categories from './pages/Categories.jsx';
import Accounts from './pages/Accounts.jsx';
import Memos from './pages/Memos.jsx';
import MemoDetail from './pages/MemoDetail.jsx';
import Cards from './pages/Cards.jsx';
import CardDetail from './pages/CardDetail.jsx';
import You from './pages/You.jsx';
import Security from './pages/Security.jsx';
import Login from './pages/Login.jsx';
import Setup from './pages/Setup.jsx';
import NotFound from './pages/NotFound.jsx';

// Dev-only gallery of the UI kit; never part of the production bundle.
const UiKit = import.meta.env.DEV ? lazy(() => import('./pages/dev/UiKit.jsx')) : null;

// Responsive shell layout. Nested routes render through <Outlet/>.
function ShellLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Shell-less, public auth screens */}
          <Route path="/login" element={<Login />} />
          <Route path="/setup" element={<Setup />} />

          {/* Everything else requires a session and renders inside the shell */}
          <Route element={<RequireAuth />}>
            <Route element={<ShellLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/import" element={<StatementImport />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/transactions/:id" element={<TransactionDetail />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route
                path="/subscriptions"
                element={<Navigate to="/calendar?view=subscriptions" replace />}
              />
              <Route path="/friends" element={<Friends />} />
              <Route path="/friends/:id" element={<FriendDetail />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/memos" element={<Memos />} />
              <Route path="/memos/:id" element={<MemoDetail />} />
              <Route path="/cards" element={<Cards />} />
              <Route path="/cards/:id" element={<CardDetail />} />
              <Route path="/you" element={<You />} />
              <Route path="/security" element={<Security />} />
              <Route path="*" element={<NotFound />} />
              {UiKit && (
                <Route
                  path="/ui-kit"
                  element={
                    <Suspense fallback={null}>
                      <UiKit />
                    </Suspense>
                  }
                />
              )}
            </Route>
          </Route>
        </Routes>
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  );
}

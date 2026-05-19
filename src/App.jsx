import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useMediaQuery } from './hooks/useMediaQuery.js';
import DesktopShell from './components/ui/DesktopShell.jsx';
import MobileShell from './components/ui/MobileShell.jsx';

import Dashboard from './pages/Dashboard.jsx';
import StatementImport from './pages/StatementImport.jsx';
import Transactions from './pages/Transactions.jsx';
import TransactionDetail from './pages/TransactionDetail.jsx';
import Calendar from './pages/Calendar.jsx';
import Friends from './pages/Friends.jsx';
import FriendDetail from './pages/FriendDetail.jsx';
import Categories from './pages/Categories.jsx';
import Cards from './pages/Cards.jsx';
import CardDetail from './pages/CardDetail.jsx';
import You from './pages/You.jsx';

export default function App() {
  const isMobile = useMediaQuery('(max-width: 720px)');
  const Shell = isMobile ? MobileShell : DesktopShell;

  return (
    <BrowserRouter>
      <Shell>
        <Routes>
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
          <Route path="/cards" element={<Cards />} />
          <Route path="/cards/:id" element={<CardDetail />} />
          <Route path="/you" element={<You />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}

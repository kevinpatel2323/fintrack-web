import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import MobileBottomNav from './components/MobileBottomNav.jsx';
import Dashboard from './pages/Dashboard.jsx';
import StatementImport from './pages/StatementImport.jsx';
import Transactions from './pages/Transactions.jsx';
import Calendar from './pages/Calendar.jsx';
import Friends from './pages/Friends.jsx';
import Categories from './pages/Categories.jsx';
import SubscriptionsCalendar from './pages/SubscriptionsCalendar.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <div className="page">
        <div className="gradient" aria-hidden="true" />
        <header className="hero">
          <p className="eyebrow">Fintrack</p>
          <h1>
            Track every account
            <br />
            with <span className="hero-accent-gradient">precision.</span>
          </h1>
        </header>

        <nav className="nav nav--top" aria-label="Main">
          <NavLink to="/" end>
            Overview
          </NavLink>
          <NavLink to="/import">Import</NavLink>
          <NavLink to="/transactions">Transactions</NavLink>
          <NavLink to="/calendar">Calendar</NavLink>
          <NavLink to="/subscriptions">Subscriptions</NavLink>
          <NavLink to="/friends">Friends</NavLink>
          <NavLink to="/categories">Categories</NavLink>
        </nav>

        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/import" element={<StatementImport />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/subscriptions" element={<SubscriptionsCalendar />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/categories" element={<Categories />} />
          </Routes>
        </main>

        <MobileBottomNav />
      </div>
    </BrowserRouter>
  );
}

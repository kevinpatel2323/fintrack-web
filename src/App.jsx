import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import MobileBottomNav from './components/MobileBottomNav.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Transactions from './pages/Transactions.jsx';
import Friends from './pages/Friends.jsx';

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

        <nav className="nav nav--top">
          <NavLink to="/" end>
            Overview
          </NavLink>
          <NavLink to="/transactions">Transactions</NavLink>
          <NavLink to="/friends">Friends</NavLink>
        </nav>

        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/friends" element={<Friends />} />
          </Routes>
        </main>

        <MobileBottomNav />
      </div>
    </BrowserRouter>
  );
}

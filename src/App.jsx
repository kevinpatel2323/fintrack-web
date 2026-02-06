import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Transactions from './pages/Transactions.jsx';
import Friends from './pages/Friends.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <div className="page">
        <div className="gradient" aria-hidden="true" />
        <header className="hero">
          <p className="eyebrow">HDFC Statement Control</p>
          <h1>Track every account, every day.</h1>
          <p className="subtitle">
            Upload statements, verify imports, and browse transaction ranges with a focused
            mobile-first workflow.
          </p>
        </header>

        <nav className="nav">
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
      </div>
    </BrowserRouter>
  );
}

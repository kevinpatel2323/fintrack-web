import Sidebar from './Sidebar.jsx';

export default function DesktopShell({ children }) {
  return (
    <div className="ft-app">
      <Sidebar />
      <main className="ft-app__main">
        <div className="ft-app__content">{children}</div>
      </main>
    </div>
  );
}

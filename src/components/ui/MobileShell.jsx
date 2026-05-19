import MobileTabBar from './MobileTabBar.jsx';

export default function MobileShell({ children }) {
  return (
    <div className="ft-mobile">
      {children}
      <MobileTabBar />
    </div>
  );
}

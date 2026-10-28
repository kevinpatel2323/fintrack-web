import { Link } from 'react-router-dom';
import { CircleUserRound } from 'lucide-react';
import { useNavBadges } from './nav.js';

// The header's leading control on every tab (frappe-ui FilesMobile opens its
// nav from the same spot). It leads to You: categories, imports, security
// and appearance. Card statements waiting to be imported put a dot on it.
export default function YouButton() {
  const badges = useNavBadges();
  const alert = badges['/import']?.label;
  return (
    <Link to="/you" className="you-button" aria-label={alert ? `You · ${alert}` : 'You'}>
      <CircleUserRound size={22} strokeWidth={1.5} aria-hidden />
      {alert && <span className="you-button__dot" aria-hidden />}
    </Link>
  );
}

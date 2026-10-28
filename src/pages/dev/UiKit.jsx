import BasicsDemo from './kit/BasicsDemo.jsx';
import FormsDemo from './kit/FormsDemo.jsx';
import OverlaysDemo from './kit/OverlaysDemo.jsx';
import ChartsDemo from './kit/ChartsDemo.jsx';
import PhoneDemo from './kit/PhoneDemo.jsx';
import './UiKit.css';

// Dev-only gallery of the UI kit (route /ui-kit). Every component in every
// state, light and dark, so the kit can be reviewed against Frappe UI. On a
// phone-width viewport the Phone section (the phone kit, docs/phone.md)
// comes first.
export default function UiKit() {
  return (
    <div className="uikit">
      <h1 className="text-3xl font-semibold text-ink-gray-9">UI kit</h1>
      <PhoneDemo />
      <BasicsDemo />
      <FormsDemo />
      <OverlaysDemo />
      <ChartsDemo />
    </div>
  );
}

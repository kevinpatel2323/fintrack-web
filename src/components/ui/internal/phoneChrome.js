import { createContext, useContext } from 'react';

/**
 * What the phone shell (components/shell/AppShell.jsx) hands the kit, the way
 * frappe-ui's MobileShell gives pages a header target and a #nav slot:
 *
 * - `headerNode`: the fixed slot above the scroll area. A phone PageHeader
 *   renders into it, so it never scrolls or rubber-bands with the page.
 * - `footerNode`: the slot above the tab bar (or the home indicator on pages
 *   without one). MobileActionBar renders into it.
 * - `rootPrefix`: the header's leading control on a tab's own page (the You
 *   button), where there is nothing to go back to.
 * - `fallbackBack`: where Back goes when there is no in-app history.
 *
 * Outside the phone shell (desktop, tests) every field is null and the kit
 * renders in place.
 */
export const PhoneChromeContext = createContext({
  headerNode: null,
  footerNode: null,
  rootPrefix: null,
  fallbackBack: '/',
});

export function usePhoneChrome() {
  return useContext(PhoneChromeContext);
}

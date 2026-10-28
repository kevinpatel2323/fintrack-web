import { createPortal } from 'react-dom';
import { cx } from './internal/dialogUtils.js';
import { usePhoneChrome } from './internal/phoneChrome.js';
import './MobileActionBar.css';

/**
 * A pushed page's main actions, pinned to the bottom of the phone screen in
 * the place of the tab bar (frappe-ui MailMobile's action footer, the HRMS
 * form's sticky save bar). Buttons share the width; use one or two, with the
 * main one last.
 *
 *   {isMobile && (
 *     <MobileActionBar>
 *       <Button size="lg" label="Split" onClick={…} />
 *       <Button size="lg" variant="solid" label="Settle up" onClick={…} />
 *     </MobileActionBar>
 *   )}
 *
 * Renders into the phone shell's footer slot (in place otherwise), above the
 * home indicator.
 */
export default function MobileActionBar({ children, className }) {
  const { footerNode } = usePhoneChrome();
  const bar = <div className={cx('ui-mactionbar', className)}>{children}</div>;
  return footerNode ? createPortal(bar, footerNode) : bar;
}

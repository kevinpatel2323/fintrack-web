import { forwardRef, useEffect, useState } from 'react';
import './ListToolbar.css';

/**
 * The view controls above every list page (Transactions, People, …), the way
 * Frappe CRM lays them out: search and filters on the left, a summary and view
 * options on the right. It pins under the page header as a full-width band
 * while the list scrolls.
 *
 *   const [toolbarRef, toolbarHeight] = useStickyHeight();
 *   <PageBody style={{ '--list-toolbar-height': `${toolbarHeight}px` }}>
 *     <ListToolbar ref={toolbarRef} meta={<span>…summary…</span>}>…filters…</ListToolbar>
 *
 * Pages pass the measured height on so a table header can pin just below.
 */
const ListToolbar = forwardRef(function ListToolbar({ children, meta, className = '' }, ref) {
  return (
    <div ref={ref} className={`list-toolbar ${className}`.trim()}>
      <div className="list-toolbar__filters">{children}</div>
      {meta && <div className="list-toolbar__meta">{meta}</div>}
    </div>
  );
});

export default ListToolbar;

/** A muted, tabular summary line for the toolbar's right side. */
export function ListSummary({ children }) {
  return <span className="list-toolbar__summary">{children}</span>;
}

/** `[ref, height]` — the element's current height, kept up to date. */
export function useStickyHeight() {
  const [node, setNode] = useState(null);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setHeight(Math.round(node.getBoundingClientRect().height)));
    ro.observe(node);
    return () => ro.disconnect();
  }, [node]);
  return [setNode, height];
}

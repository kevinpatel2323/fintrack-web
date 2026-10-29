import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Select } from '../../components/ui';

export const PAGE_SIZES = [25, 50, 100];

/**
 * The pager under the desktop list, laid out like ListView's own. ListView
 * pages the rows it is given; memos are paged by the API (`page`, `pageSize`,
 * `count`), so the list gets one page of rows and this footer moves between
 * pages.
 */
export default function MemosPager({ page, pageSize, total, shown, onPageChange, onPageSizeChange }) {
  if (!total) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, (page - 1) * pageSize + shown);

  return (
    <div className="memos-pager">
      <label className="memos-pager__size">
        <span>Rows per page</span>
        <Select
          options={PAGE_SIZES.map((n) => ({ label: String(n), value: String(n) }))}
          value={String(pageSize)}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        />
      </label>
      <div className="memos-pager__nav">
        <span className="memos-pager__range">
          {shown ? `${start}–${end}` : '0'} of {total}
        </span>
        {totalPages > 1 && (
          <div className="memos-pager__buttons">
            <Button
              variant="ghost"
              icon={ChevronLeft}
              label="Previous page"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            />
            <span className="memos-pager__page" aria-live="polite">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="ghost"
              icon={ChevronRight}
              label="Next page"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

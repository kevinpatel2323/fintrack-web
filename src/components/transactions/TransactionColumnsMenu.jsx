import { Columns3 } from 'lucide-react';
import { Button, Checkbox, Popover } from '../ui';
import './transactions.css';

/**
 * "Columns" control for a ledger table (Frappe CRM's column settings, minus
 * reordering): a checkbox per hideable column and a reset. Works off the
 * state from `useTransactionTableSettings`.
 *
 * @param columns   `[{ id, label }]` hideable columns, in table order
 * @param settings  return value of `useTransactionTableSettings`
 */
export default function TransactionColumnsMenu({ columns, settings, variant = 'subtle', className }) {
  const ids = columns.map((c) => c.id);
  const hiddenCount = ids.filter((id) => settings.hidden[id]).length;
  const hasCustomWidths = Object.keys(settings.widths || {}).length > 0;

  return (
    <Popover
      placement="bottom-end"
      className={className}
      trigger={
        <Button
          variant={variant}
          iconLeft={Columns3}
          label={hiddenCount ? `Columns · ${ids.length - hiddenCount}/${ids.length}` : 'Columns'}
        />
      }
    >
      <div className="txl-colmenu" role="group" aria-label="Show or hide columns">
        {columns.map((c) => (
          <Checkbox
            key={c.id}
            padded
            label={c.label}
            checked={!settings.hidden[c.id]}
            onChange={() => settings.toggleColumn(c.id, ids)}
          />
        ))}
        <div className="txl-colmenu__footer">
          <Button
            variant="ghost"
            label="Show all columns"
            disabled={hiddenCount === 0}
            onClick={settings.showAllColumns}
          />
          {hasCustomWidths && (
            <Button
              variant="ghost"
              label="Reset widths"
              onClick={() => Object.keys(settings.widths).forEach((id) => settings.resetWidth(id))}
            />
          )}
        </div>
      </div>
    </Popover>
  );
}

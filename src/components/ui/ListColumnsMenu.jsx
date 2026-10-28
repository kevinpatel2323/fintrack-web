import { Columns3 } from 'lucide-react';
import Button from './Button.jsx';
import Checkbox from './Checkbox.jsx';
import Popover from './Popover.jsx';
import { listColumnChoices } from './internal/listModel.js';
import './ListView.css';

/**
 * "Columns" control for a ListView (Frappe CRM's column settings, minus
 * reordering): a checkbox per hideable column, "Show all columns", and
 * "Reset widths" once a column has been dragged. Works off the state from
 * `useListSettings`; pass the same object to the table as `columnSettings`.
 *
 * @param columns   the table's columns (pinned ones are left out), or `[{ id, label }]`
 * @param settings  return value of `useListSettings`
 */
export default function ListColumnsMenu({ columns, settings, variant = 'subtle', className }) {
  const choices = listColumnChoices(columns);
  const ids = choices.map((c) => c.id);
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
      <div className="ui-list-colmenu" role="group" aria-label="Show or hide columns">
        {choices.map((c) => (
          <Checkbox
            key={c.id}
            padded
            label={c.label}
            checked={!settings.hidden[c.id]}
            onChange={() => settings.toggleColumn(c.id, ids)}
          />
        ))}
        <div className="ui-list-colmenu__footer">
          <Button
            variant="ghost"
            label="Show all columns"
            disabled={hiddenCount === 0}
            onClick={settings.showAllColumns}
          />
          {hasCustomWidths && <Button variant="ghost" label="Reset widths" onClick={settings.resetWidths} />}
        </div>
      </div>
    </Popover>
  );
}

import { FileSpreadsheet, RotateCw, X } from 'lucide-react';
import { Button, Spinner } from '../../components/ui';
import { fileSize } from './format.js';

/**
 * The chosen statement file: its name, and underneath what the server made of
 * it (where it goes, the period, how many rows), or that it is still being
 * read, or why it could not be.
 */
export default function FileRow({ file, detail, reading, error, onRetry, onRemove }) {
  return (
    <div className="import-file" aria-busy={reading || undefined}>
      <span className="import-file__icon" aria-hidden>
        {reading ? <Spinner size="sm" /> : <FileSpreadsheet size={16} strokeWidth={1.5} />}
      </span>
      <div className="import-file__text">
        <span className="import-file__name truncate" title={file?.name}>
          {file?.name}
        </span>
        {error ? (
          <span className="import-file__error" role="alert">
            {error}
          </span>
        ) : (
          <span className="import-file__meta">
            {reading ? 'Reading statement…' : detail || fileSize(file?.size)}
          </span>
        )}
      </div>
      <div className="import-file__actions">
        {error && onRetry && <Button iconLeft={RotateCw} label="Try again" onClick={onRetry} />}
        {onRemove && (
          <Button
            variant="ghost"
            icon={X}
            label="Choose another file"
            tooltip="Choose another file"
            disabled={reading}
            onClick={onRemove}
          />
        )}
      </div>
    </div>
  );
}

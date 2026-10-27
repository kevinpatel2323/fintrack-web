import { forwardRef, isValidElement, useCallback, useRef, useState } from 'react';
import { CloudUpload } from 'lucide-react';
import { useStableId } from './internal/floating.js';
import Spinner from './Spinner.jsx';
import './FileUploader.css';

// A Frappe-style dropzone (frappe-ui's FileUploader is headless, so the look
// is built from its tokens): dashed outline-gray-2 border, surface-gray-1 on
// hover and drag-over, an icon, a title with a link-like "browse", and a
// description. Click, Enter or Space opens the file dialog; files can be
// dropped. `onFiles(File[])` gets the files that match `accept`.
//
// `uploading` swaps the icon for the kit Spinner and shows `progress`
// (0–100) as a Progress-style bar.

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function isComponentType(value) {
  if (!value || isValidElement(value)) return false;
  return typeof value === 'function' || (typeof value === 'object' && '$$typeof' in value);
}

/** Whether `file` matches an `accept` list (".pdf", "image/*", "text/csv"). */
export function fileMatchesAccept(file, accept) {
  if (!accept) return true;
  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();
  return accept
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .some((rule) => {
      if (rule.startsWith('.')) return name.endsWith(rule);
      if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
      return type === rule;
    });
}

const FileUploader = forwardRef(function FileUploader(
  {
    accept,
    multiple = false,
    disabled = false,
    onFiles,
    onReject,
    title,
    description,
    icon = CloudUpload,
    uploading = false,
    progress,
    size = 'md',
    error,
    id: idProp,
    className,
    style,
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
    ...rest
  },
  ref,
) {
  const autoId = useStableId('ui-file-uploader');
  const id = idProp ?? autoId;
  const inputRef = useRef(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const busy = Boolean(uploading);
  const inactive = disabled || busy;
  const s = size === 'sm' ? 'sm' : 'md';
  const pct = typeof progress === 'number' && Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : null;

  const deliver = useCallback(
    (list) => {
      const files = Array.from(list || []);
      if (!files.length) return;
      const accepted = files.filter((f) => fileMatchesAccept(f, accept));
      const rejected = files.filter((f) => !fileMatchesAccept(f, accept));
      const picked = multiple ? accepted : accepted.slice(0, 1);
      if (rejected.length) onReject?.(rejected);
      if (picked.length) onFiles?.(picked);
    },
    [accept, multiple, onFiles, onReject],
  );

  const openDialog = () => {
    if (inactive) return;
    inputRef.current?.click();
  };

  const onKeyDown = (event) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openDialog();
    }
  };

  const onDragEnter = (event) => {
    event.preventDefault();
    if (inactive) return;
    dragDepth.current += 1;
    setDragging(true);
  };

  const onDragOver = (event) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = inactive ? 'none' : 'copy';
  };

  const onDragLeave = (event) => {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };

  const onDrop = (event) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (inactive) return;
    deliver(event.dataTransfer?.files);
  };

  const Icon = isComponentType(icon) ? icon : null;
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [ariaDescribedBy, descriptionId, errorId].filter(Boolean).join(' ') || undefined;
  const state = busy ? 'uploading' : dragging ? 'dragging' : 'idle';

  const titleContent = busy ? (
    <>
      Uploading{pct !== null ? ` ${Math.round(pct)}%` : '…'}
    </>
  ) : (
    (title ?? (
      <>
        {multiple ? 'Drop files here or ' : 'Drop a file here or '}
        <span className="ui-file-uploader__link">browse</span>
      </>
    ))
  );

  return (
    <div
      ref={ref}
      id={id}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-busy={busy || undefined}
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      data-state={state}
      className={cx(
        'ui-file-uploader',
        `ui-file-uploader--${s}`,
        dragging && 'is-dragging',
        busy && 'is-uploading',
        disabled && 'is-disabled',
        error && 'has-error',
        className,
      )}
      style={style}
      onClick={openDialog}
      onKeyDown={onKeyDown}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      {...rest}
    >
      <input
        ref={inputRef}
        type="file"
        className="ui-file-uploader__input"
        accept={accept}
        multiple={multiple}
        disabled={inactive}
        tabIndex={-1}
        aria-hidden="true"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          deliver(e.target.files);
          // Let the same file be picked again.
          e.target.value = '';
        }}
      />
      <span className="ui-file-uploader__icon" aria-hidden="true">
        {busy ? (
          <Spinner size={s === 'sm' ? 'md' : 'lg'} />
        ) : Icon ? (
          <Icon size={s === 'sm' ? 16 : 20} strokeWidth={1.5} />
        ) : (
          icon
        )}
      </span>
      <span className="ui-file-uploader__text">
        <span className="ui-file-uploader__title">{titleContent}</span>
        {description && (
          <span id={descriptionId} className="ui-file-uploader__description">
            {description}
          </span>
        )}
        {error && (
          <span id={errorId} role="alert" className="ui-file-uploader__error">
            {error}
          </span>
        )}
        {busy && pct !== null && (
          <span
            className="ui-file-uploader__progress"
            role="progressbar"
            aria-label="Upload progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
          >
            <span className="ui-file-uploader__progress-fill" style={{ transform: `translateX(${pct - 100}%)` }} />
          </span>
        )}
      </span>
    </div>
  );
});

export default FileUploader;

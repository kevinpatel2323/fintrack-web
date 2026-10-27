import { Dialog, Sheet } from '../../components/ui';

/**
 * Where the calendar's create/edit forms open: a Dialog on desktop and a
 * bottom sheet on phones, with the same body and footer either way.
 */
export default function FormFrame({ compact, open, onClose, title, description, footer, busy = false, children }) {
  if (compact) {
    return (
      <Sheet
        open={open}
        onClose={onClose}
        side="bottom"
        title={title}
        description={description}
        footer={footer}
        dismissable={!busy}
      >
        {children}
      </Sheet>
    );
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="xl"
      footer={footer}
      dismissable={!busy}
    >
      {children}
    </Dialog>
  );
}

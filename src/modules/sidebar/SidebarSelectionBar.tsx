import { useEffect, useState } from 'react';
import { CheckSquare, Loader2, Square, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/shared/ui';

/**
 * What to do with the sessions that are picked.
 *
 * Only on screen while something is picked: with nothing selected it would be
 * a permanent row of buttons for something nobody is doing, in a sidebar whose
 * whole job is the list underneath it.
 */

type Props = {
  count: number;
  /** How many rows the list is showing, for "select all". */
  total: number;
  allSelected: boolean;
  busy: boolean;
  onToggleAll: () => void;
  onDelete: () => void;
  onClear: () => void;
};

export default function SidebarSelectionBar({
  count,
  total,
  allSelected,
  busy,
  onToggleAll,
  onDelete,
  onClear,
}: Props) {
  const { t } = useTranslation('sidebar');
  /**
   * Deleting several conversations at once is not undoable from here, and
   * it sits one slip away from the row people click all day. The button
   * asks once rather than opening a dialog: it is the same two actions, in
   * the place the eye already is.
   */
  const [armed, setArmed] = useState(false);

  // A changed selection is a changed decision - the armed button must not
  // carry over to a set of rows nobody confirmed.
  useEffect(() => { setArmed(false); }, [count]);

  if (count === 0) {
    return null;
  }

  return (
    <div className="mb-1 flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1.5">
      <button
        type="button"
        onClick={onToggleAll}
        disabled={busy}
        className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-primary disabled:opacity-60"
        title={t('selection.toggleAll', {
          total,
          defaultValue: 'Select all {{total}}',
        })}
      >
        {allSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
        {t('selection.count', { count, defaultValue: '{{count}} selected' })}
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant={armed ? 'destructive' : 'ghost'}
          onClick={() => {
            if (!armed) {
              setArmed(true);
              return;
            }
            setArmed(false);
            onDelete();
          }}
          disabled={busy}
          className={armed
            ? 'h-6 gap-1 px-2 text-xs'
            : 'h-6 gap-1 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive'}
        >
          {busy
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Trash2 className="h-3.5 w-3.5" />}
          {armed
            ? t('selection.confirmDelete', { count, defaultValue: 'Delete {{count}}?' })
            : t('selection.delete', { defaultValue: 'Delete' })}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => { setArmed(false); onClear(); }}
          disabled={busy}
          className="h-6 w-6 p-0"
          title={t('selection.clear', { defaultValue: 'Clear selection' })}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

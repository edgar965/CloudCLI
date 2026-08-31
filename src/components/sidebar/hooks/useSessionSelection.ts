import { useCallback, useMemo, useRef, useState } from 'react';

import { api } from '../../../utils/api';

import { applyPick } from './sessionPick';

/**
 * Picking several sessions at once, to delete them in one go.
 *
 * A conversation that turned out to be nothing - a test, a mistyped question,
 * the "ok" someone sent to see whether the thing works - is deleted one dialog
 * at a time otherwise, and a list of thirty of them is a list of thirty
 * dialogs.
 *
 * The range select is what makes it worth having: click the first, shift-click
 * the last, everything between is picked. Ordering therefore comes from the
 * list itself rather than from insertion order - `orderedIds` is whatever the
 * sidebar is showing, in the order it shows it.
 */

export type BatchDeleteOutcome = {
  deleted: string[];
  failed: string[];
};

/**
 * @param onDeleted - Told which sessions went, so the list can drop them
 */
export function useSessionSelection(onDeleted?: (ids: string[]) => void) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  /** Where the last plain click landed, for shift-click to reach back to. */
  const anchor = useRef<string | null>(null);

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const clear = useCallback(() => {
    setSelected(new Set());
    anchor.current = null;
  }, []);

  /**
   * Adds or removes one session; with `shiftKey`, everything from the last
   * click to this one.
   *
   * @param id - The session clicked
   * @param orderedIds - The sessions as the list shows them
   * @param shiftKey - Whether the range from the previous click is meant
   */
  const toggle = useCallback((id: string, orderedIds: string[], shiftKey = false) => {
    // Read the anchor here, not inside the updater below: React runs updaters
    // at render time, and the line after this one has already moved the
    // anchor by then. Reading it late made every shift-range see itself as
    // the anchor and fall back to picking the single row.
    const from = anchor.current;
    anchor.current = id;

    setSelected((previous) => applyPick(previous, { id, orderedIds, shiftKey, anchor: from }));
  }, []);

  /** Picks every session the list is showing, or drops them all. */
  const toggleAll = useCallback((orderedIds: string[]) => {
    setSelected((previous) => (
      orderedIds.every((id) => previous.has(id)) ? new Set() : new Set(orderedIds)
    ));
    anchor.current = null;
  }, []);

  /**
   * Deletes what is picked, one request at a time.
   *
   * Sequential on purpose: thirty parallel deletes on one sqlite file is a
   * fight over the same write lock, and the failure that comes out of it says
   * "database is locked" rather than what actually went wrong. It also lets a
   * partial failure be reported honestly - what went, what stayed.
   *
   * The selection keeps whatever could not be deleted, so a second attempt
   * starts from exactly those.
   */
  const deleteSelected = useCallback(async (hardDelete = false): Promise<BatchDeleteOutcome> => {
    const ids = Array.from(selected);
    if (ids.length === 0 || busy) {
      return { deleted: [], failed: [] };
    }

    setBusy(true);
    const deleted: string[] = [];
    const failed: string[] = [];

    try {
      for (const id of ids) {
        try {
          const response = await api.deleteSession(id, hardDelete);
          if (response.ok) {
            deleted.push(id);
          } else {
            failed.push(id);
          }
        } catch {
          failed.push(id);
        }
      }
    } finally {
      setSelected(new Set(failed));
      anchor.current = null;
      setBusy(false);
    }

    if (deleted.length > 0) {
      onDeleted?.(deleted);
    }

    return { deleted, failed };
  }, [busy, onDeleted, selected]);

  return useMemo(() => ({
    selectedIds: selected,
    selectedCount: selected.size,
    isSelected,
    toggle,
    toggleAll,
    clear,
    deleteSelected,
    busy,
  }), [busy, clear, deleteSelected, isSelected, selected, toggle, toggleAll]);
}

export default useSessionSelection;

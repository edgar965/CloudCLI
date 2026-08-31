import { useCallback, useMemo, useState } from 'react';

import { api } from '../../../utils/api';

import { applyPick, emptyPick, pickedIds } from './sessionPick';
import type { PickState } from './sessionPick';

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
  const [pick, setPick] = useState<PickState>(emptyPick);
  const [busy, setBusy] = useState(false);
  const selected = useMemo(() => pickedIds(pick), [pick]);

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const clear = useCallback(() => setPick(emptyPick), []);

  /**
   * Adds or removes one session; with `shiftKey`, everything from the last
   * click to this one.
   *
   * @param id - The session clicked
   * @param orderedIds - The sessions as the list shows them
   * @param shiftKey - Whether the range from the previous click is meant
   */
  const toggle = useCallback((id: string, orderedIds: string[], shiftKey = false) => {
    setPick((previous) => applyPick(previous, { id, orderedIds, shiftKey }));
  }, []);

  /** Picks every session the list is showing, or drops them all. */
  const toggleAll = useCallback((orderedIds: string[]) => {
    setPick((previous) => {
      const all = pickedIds(previous);
      const complete = orderedIds.length > 0 && orderedIds.every((id) => all.has(id));
      return { base: complete ? new Set() : new Set(orderedIds), range: [], anchor: null };
    });
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
      setPick({ base: new Set(failed), range: [], anchor: null });
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

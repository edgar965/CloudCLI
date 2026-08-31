import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

import { useSessionSelection } from './useSessionSelection';

/**
 * The multi-select, shared with the rows that take part in it.
 *
 * Passed through context rather than props: a session row sits four levels
 * below the sidebar (list → project → sessions → row), and threading a
 * selection through all of them would put it in three components that have no
 * use for it.
 */

type Selection = ReturnType<typeof useSessionSelection>;

const SessionSelectionContext = createContext<Selection | null>(null);

export function SessionSelectionProvider({
  value,
  children,
}: {
  value: Selection;
  children: ReactNode;
}) {
  return (
    <SessionSelectionContext.Provider value={value}>
      {children}
    </SessionSelectionContext.Provider>
  );
}

/**
 * The selection, or null where there is none.
 *
 * Null rather than a throw: a row is rendered in places that never offer
 * multi-select (search results, the archive), and those must not have to know
 * that a provider exists.
 */
export function useSelectionContext(): Selection | null {
  return useContext(SessionSelectionContext);
}

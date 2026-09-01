import assert from 'node:assert/strict';

import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { test, vi } from 'vitest';

/**
 * Regression guard for the launcher's start address.
 *
 * `/project/<url-encoded path>` is how a launcher opens one directory, and the
 * whole feature hangs on a single parameter being read from the route and
 * handed to the workspace state. An upstream restructure rewrote the route
 * component and kept only `sessionId` - the path parameter was still in the
 * route, still decoded in `useProjectsState`, and simply never arrived. Nothing
 * failed: the app opened on the project list with nothing selected.
 *
 * A type error would not have caught it either, since the prop is optional.
 * So the seam itself is asserted here.
 */

const providerProps = vi.fn();

vi.mock('@/modules/project-workspace/context/ProjectsStateContext', () => ({
  ProjectsStateProvider: (props: Record<string, unknown>) => {
    providerProps(props);
    return null;
  },
}));

vi.mock('@/modules/project-workspace/ProjectWorkspaceShell', () => ({
  default: () => null,
}));

vi.mock('@/modules/command-palette', () => ({
  PaletteOpsProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/shared/context/SessionProtectionContext', () => ({
  SessionProtectionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSessionProtectionActions: () => ({ isSessionProcessing: () => false }),
}));

vi.mock('@/shared/context/WebSocketContext', () => ({
  useWebSocket: () => ({ ws: null, sendMessage: () => {}, subscribe: () => () => {} }),
}));

vi.mock('@/shared/hooks/useDeviceSettings', () => ({
  useDeviceSettings: () => ({ isMobile: false }),
}));

const { default: ProjectWorkspaceRoute } = await import(
  '@/modules/project-workspace/ProjectWorkspaceRoute'
);

const renderAt = (path: string) => {
  providerProps.mockClear();
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<ProjectWorkspaceRoute />} />
        <Route path="/session/:sessionId" element={<ProjectWorkspaceRoute />} />
        <Route path="/project/:projectPath" element={<ProjectWorkspaceRoute />} />
      </Routes>
    </MemoryRouter>,
  );
  return providerProps.mock.calls.at(-1)?.[0] as Record<string, unknown>;
};

test('the project path from the url reaches the workspace state', () => {
  // React Router hands over the decoded segment, so what arrives is the path
  // itself - a launcher encodes the colon and the backslashes to get it
  // through the address.
  assert.equal(renderAt('/project/A%3A%5CCloudCLI').projectPath, String.raw`A:\CloudCLI`);
});

test('a session url passes the session and no project path', () => {
  const props = renderAt('/session/abc-123');

  assert.equal(props.sessionId, 'abc-123');
  assert.equal(props.projectPath, undefined);
});

test('the bare root passes neither', () => {
  const props = renderAt('/');

  assert.equal(props.sessionId, undefined);
  assert.equal(props.projectPath, undefined);
});

import type { ReactElement, ReactNode } from "react";
import {
  render,
  type RenderOptions,
  type RenderResult,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { ToastContainer } from "react-toastify";
import { DashboardShell } from "@/features/dashboard/components/DashboardShell";

export type RenderWithProvidersOptions = Omit<RenderOptions, "wrapper"> & {
  /** URL the router starts at. Defaults to "/". */
  route?: string;
  path?: string;
  /**
   * Mounts the UI under the DashboardShell layout route, as AppRoutes does
   * for the pages with the dashboard header and sidebar. Implies a route,
   * at `path` or "*".
   */
  shell?: boolean;
};

export type RenderWithProvidersResult = RenderResult & {
  user: ReturnType<typeof userEvent.setup>;
};

// When a context provider is added to the app, add it here too.
export function renderWithProviders(
  ui: ReactElement,
  {
    route = "/",
    path,
    shell = false,
    ...options
  }: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[route]}>
        {shell ? (
          <Routes>
            <Route element={<DashboardShell />}>
              <Route path={path ?? "*"} element={children} />
            </Route>
          </Routes>
        ) : path ? (
          <Routes>
            <Route path={path} element={children} />
          </Routes>
        ) : (
          children
        )}
        <ToastContainer />
      </MemoryRouter>
    );
  }

  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: Wrapper, ...options }),
  };
}

// Re-exported so a test needs one import: screen, waitFor, within, act, …
export * from "@testing-library/react";

export { renderWithProviders as render };

export { userEvent };

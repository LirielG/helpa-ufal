import type { ReactElement, ReactNode } from "react";
import {
  render,
  type RenderOptions,
  type RenderResult,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";

export type RenderWithProvidersOptions = Omit<RenderOptions, "wrapper"> & {
  /** URL the router starts at. Defaults to "/". */
  route?: string;
  path?: string;
};

export type RenderWithProvidersResult = RenderResult & {
  user: ReturnType<typeof userEvent.setup>;
};

// When a context provider is added to the app, add it here too.
export function renderWithProviders(
  ui: ReactElement,
  { route = "/", path, ...options }: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[route]}>
        {path ? (
          <Routes>
            <Route path={path} element={children} />
          </Routes>
        ) : (
          children
        )}
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

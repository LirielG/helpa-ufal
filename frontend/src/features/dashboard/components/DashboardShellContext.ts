import { createContext, useContext, useEffect, useLayoutEffect } from "react";
import type { UserProfile } from "../../../types/profile";

export type DashboardShellOptions = {
  /** Shows the floating "Criar uma ação" button. Defaults to true. */
  showCreateAction?: boolean;
  /** Page background color, behind the header, content and footer. */
  background?: string;
};

type DashboardShellContextValue = {
  setOptions: (options: DashboardShellOptions) => void;
  syncProfile: (profile: UserProfile) => void;
};

export const DashboardShellContext =
  createContext<DashboardShellContextValue | null>(null);

/**
 * Sets the shell options for as long as the calling page is mounted. The
 * shell outlives the pages under it, so the options are undone when the page
 * leaves. A layout effect applies them before the first paint, so the default
 * never flashes.
 */
export function useDashboardShellOptions({
  showCreateAction,
  background,
}: DashboardShellOptions) {
  const shell = useContext(DashboardShellContext);

  useLayoutEffect(() => {
    if (!shell) return;

    shell.setOptions({ showCreateAction, background });
    return () => shell.setOptions({});
  }, [shell, showCreateAction, background]);
}

/**
 * Hands the sidebar a fresh copy of the signed-in user's profile, from a page
 * that reads or saves it itself, so the sidebar does not show a stale one.
 */
export function useSyncSidebarProfile(profile: UserProfile | null) {
  const shell = useContext(DashboardShellContext);

  useEffect(() => {
    if (shell && profile) shell.syncProfile(profile);
  }, [shell, profile]);
}

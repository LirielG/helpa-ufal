import { afterEach, describe, expect, it, vi } from "vitest";
import { Link, Route, Routes } from "react-router";
import {
  act,
  API,
  http,
  HttpResponse,
  makeUser,
  render,
  screen,
  server,
  signIn,
  waitFor,
  within,
} from "@/test";
import { useAuthStore } from "@/stores/authStore";
import { useActionRegisterStore } from "@/stores/actionRegisterStore";
import type { User } from "@/types";
import type { UserProfile } from "@/types/profile";
import { DashboardShell } from "../DashboardShell";
import {
  useDashboardShellOptions,
  useSyncSidebarProfile,
} from "../DashboardShellContext";

function profileOf(user: User, overrides: Partial<UserProfile> = {}) {
  return {
    ...user,
    registrationCode: "2026000001",
    course: "Ciência da Computação",
    cndb: null,
    totalWorkloadHours: 0,
    ...overrides,
  } as UserProfile;
}

function Page({ title, to }: { title: string; to: string }) {
  return (
    <div>
      <h1>{title}</h1>
      <Link to={to}>ir para {to}</Link>
    </div>
  );
}

function PageWithoutCreateAction() {
  useDashboardShellOptions({ showCreateAction: false, background: "#E0F6F6" });
  return <Page title="Como Funciona" to="/dashboard" />;
}

function PageWithSyncedProfile({ profile }: { profile: UserProfile }) {
  useSyncSidebarProfile(profile);
  return <Page title="Perfil" to="/dashboard" />;
}

function renderShell(
  route = "/dashboard",
  profilePage = <Page title="Perfil" to="/dashboard" />,
) {
  return render(
    <Routes>
      <Route element={<DashboardShell />}>
        <Route
          path="/dashboard"
          element={<Page title="Feed" to="/profile" />}
        />
        <Route path="/profile" element={profilePage} />
        <Route path="/how-it-works" element={<PageWithoutCreateAction />} />
      </Route>
    </Routes>,
    { route },
  );
}

const sidebar = () =>
  screen.getByRole("complementary", { name: "Menu lateral do usuário" });
const actionsToggle = () =>
  within(sidebar()).getByRole("button", { name: "Ações" });

function countProfileReads(course = "Ciência da Computação") {
  const calls = { count: 0 };
  server.use(
    http.get(`${API}/users/me`, () => {
      calls.count += 1;
      const user = useAuthStore.getState().user ?? makeUser();
      return HttpResponse.json(profileOf(user, { course }));
    }),
  );
  return calls;
}

describe("DashboardShell as a layout route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Ações submenu", () => {
    it("starts expanded when nothing is saved", () => {
      signIn();
      renderShell();

      expect(actionsToggle()).toHaveAttribute("aria-expanded", "true");
    });

    it("stays collapsed when the user moves to another page", async () => {
      signIn();
      const { user } = renderShell();
      const sidebarBefore = sidebar();

      await user.click(actionsToggle());
      await user.click(screen.getByRole("link", { name: "ir para /profile" }));

      expect(
        await screen.findByRole("heading", { name: "Perfil" }),
      ).toBeInTheDocument();
      expect(sidebar()).toBe(sidebarBefore);
      expect(actionsToggle()).toHaveAttribute("aria-expanded", "false");
    });

    it("stays collapsed after a reload", async () => {
      signIn();
      const { user, unmount } = renderShell();

      await user.click(actionsToggle());
      unmount();
      renderShell("/profile");

      expect(localStorage.getItem("helpa.sidebarActionsCollapsed")).toBe(
        "true",
      );
      expect(actionsToggle()).toHaveAttribute("aria-expanded", "false");
    });

    it("starts expanded and still toggles when localStorage throws", async () => {
      // Only the sidebar's keys: the auth store and the header read storage
      // on their own, outside what this test covers.
      const getItem = Storage.prototype.getItem;
      const setItem = Storage.prototype.setItem;
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (
        this: Storage,
        key,
      ) {
        if (key.startsWith("helpa.")) throw new Error("SecurityError");
        return getItem.call(this, key);
      });
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
        this: Storage,
        key,
        value,
      ) {
        if (key.startsWith("helpa.")) throw new Error("SecurityError");
        setItem.call(this, key, value);
      });
      signIn();
      const { user } = renderShell();

      expect(actionsToggle()).toHaveAttribute("aria-expanded", "true");

      await user.click(actionsToggle());

      expect(actionsToggle()).toHaveAttribute("aria-expanded", "false");
    });
  });

  it("keeps the sidebar's scroll when the user moves to another page", async () => {
    signIn();
    const { user } = renderShell();
    const scrollArea = sidebar().firstElementChild!
      .firstElementChild as HTMLElement;
    scrollArea.scrollTop = 120;

    await user.click(screen.getByRole("link", { name: "ir para /profile" }));
    await screen.findByRole("heading", { name: "Perfil" });

    expect(sidebar().firstElementChild!.firstElementChild).toBe(scrollArea);
    expect(scrollArea.scrollTop).toBe(120);
  });

  describe("profile", () => {
    it("reads the profile once, not on every page", async () => {
      signIn();
      const reads = countProfileReads();
      const { user } = renderShell();

      expect(
        await within(sidebar()).findByText("Ciência da Computação"),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("link", { name: "ir para /profile" }));
      await screen.findByRole("heading", { name: "Perfil" });
      await user.click(
        screen.getByRole("link", { name: "ir para /dashboard" }),
      );
      await screen.findByRole("heading", { name: "Feed" });

      expect(reads.count).toBe(1);
    });

    it("shows the profile a page hands it", async () => {
      const signedIn = signIn();
      countProfileReads("Ciência da Computação");

      renderShell(
        "/profile",
        <PageWithSyncedProfile
          profile={profileOf(signedIn, { course: "Engenharia Civil" })}
        />,
      );

      expect(
        await within(sidebar()).findByText("Engenharia Civil"),
      ).toBeInTheDocument();
    });

    it("shows the new account's profile, never the previous one's, when the user changes", async () => {
      signIn({ fullName: "Ana Souza" });
      server.use(
        http.get(`${API}/users/me`, () => {
          const user = useAuthStore.getState().user!;
          return HttpResponse.json(
            profileOf(user, { course: `Curso de ${user.fullName}` }),
          );
        }),
      );
      renderShell();
      expect(
        await within(sidebar()).findByText("Curso de Ana Souza"),
      ).toBeInTheDocument();

      act(() => {
        useAuthStore.setState({
          user: makeUser({ fullName: "Bruno Lima" }),
          isSessionVerified: true,
        });
      });

      expect(
        within(sidebar()).queryByText("Curso de Ana Souza"),
      ).not.toBeInTheDocument();
      expect(
        await within(sidebar()).findByText("Curso de Bruno Lima"),
      ).toBeInTheDocument();
    });
  });

  describe("collapsing the sidebar on desktop", () => {
    // The desktop ☰ is the one with aria-expanded; the mobile one only opens
    // the drawer.
    const desktopToggle = (name: string, expanded: boolean) =>
      screen.getByRole("button", { name, expanded });
    const mobileToggle = () =>
      screen
        .getAllByRole("button", { name: "Abrir menu lateral" })
        .find((button) => !button.hasAttribute("aria-expanded"))!;
    const desktopSidebar = () =>
      screen.queryByRole("complementary", { name: "Menu lateral do usuário" });

    function throwOnSidebarKeys() {
      const getItem = Storage.prototype.getItem;
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (
        this: Storage,
        key,
      ) {
        if (key.startsWith("helpa.")) throw new Error("SecurityError");
        return getItem.call(this, key);
      });
    }

    it("starts open, then collapses and reopens with the header ☰", async () => {
      signIn();
      const { user } = renderShell();

      expect(desktopSidebar()).toBeInTheDocument();

      await user.click(desktopToggle("Recolher menu lateral", true));

      expect(desktopSidebar()).not.toBeInTheDocument();
      expect(localStorage.getItem("helpa.sidebarCollapsed")).toBe("true");

      await user.click(desktopToggle("Abrir menu lateral", false));

      expect(desktopSidebar()).toBeInTheDocument();
      expect(localStorage.getItem("helpa.sidebarCollapsed")).toBe("false");
    });

    it("stays collapsed on another page and after a reload", async () => {
      signIn();
      const { user, unmount } = renderShell();

      await user.click(desktopToggle("Recolher menu lateral", true));
      await user.click(screen.getByRole("link", { name: "ir para /profile" }));
      await screen.findByRole("heading", { name: "Perfil" });

      expect(desktopSidebar()).not.toBeInTheDocument();

      unmount();
      renderShell("/profile");

      expect(desktopSidebar()).not.toBeInTheDocument();
      expect(desktopToggle("Abrir menu lateral", false)).toBeInTheDocument();
    });

    it("starts open, without an error, when localStorage throws", () => {
      throwOnSidebarKeys();
      signIn();
      renderShell();

      expect(desktopSidebar()).toBeInTheDocument();
      expect(desktopToggle("Recolher menu lateral", true)).toBeInTheDocument();
    });

    it("still opens the mobile drawer, which closes on a destination, with the sidebar saved as collapsed", async () => {
      localStorage.setItem("helpa.sidebarCollapsed", "true");
      signIn();
      const { user } = renderShell();

      await user.click(mobileToggle());
      const drawer = screen.getByRole("dialog", {
        name: "Menu lateral do usuário",
      });

      await user.click(
        within(drawer).getByRole("button", { name: "Dados Pessoais" }),
      );

      expect(
        await screen.findByRole("heading", { name: "Perfil" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("page options", () => {
    it("drops Criar uma ação and applies the background only while the page that asks is open", async () => {
      signIn();
      const { user, container } = renderShell("/how-it-works");
      const root = () => container.firstElementChild as HTMLElement;

      expect(
        screen.queryByRole("button", { name: "Criar uma ação" }),
      ).not.toBeInTheDocument();
      expect(root().style.backgroundColor).toBe("rgb(224, 246, 246)");

      await user.click(
        screen.getByRole("link", { name: "ir para /dashboard" }),
      );
      await screen.findByRole("heading", { name: "Feed" });

      expect(
        screen.getByRole("button", { name: "Criar uma ação" }),
      ).toBeInTheDocument();
      expect(root().style.backgroundColor).toBe("");
    });
  });

  describe("leaving a page", () => {
    it("closes the mobile drawer", async () => {
      signIn();
      const { user } = renderShell();

      await user.click(
        screen.getByRole("button", { name: "Abrir menu lateral" }),
      );
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      await user.click(screen.getByRole("link", { name: "ir para /profile" }));

      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
    });

    it("closes the register modal", async () => {
      signIn();
      const { user } = renderShell();
      act(() => {
        useActionRegisterStore.setState({ isOpen: true });
      });
      expect(
        screen.getByRole("dialog", { name: "Criar uma ação" }),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("link", { name: "ir para /profile" }));

      await waitFor(() =>
        expect(
          screen.queryByRole("dialog", { name: "Criar uma ação" }),
        ).not.toBeInTheDocument(),
      );
    });
  });
});

import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  isRedirect,
  redirect,
} from "@tanstack/react-router";
import { api, ApiProblemError, setMfaSetupHandler, setUnauthorizedHandler } from "../lib/api.ts";
import { ToastHost } from "./toast.tsx";
import { authQueryKey } from "../features/auth/use-auth.ts";
import { queryClient } from "../lib/query-client.ts";
import { SearchPaletteHost } from "./providers.tsx";
import { LoginPage } from "../routes/login.tsx";
import { SignupPage } from "../routes/signup.tsx";
import { HomePage } from "../routes/home.tsx";
import { BasePage } from "../routes/base.tsx";
import { ContactsPage } from "../routes/contacts.tsx";
import { AccountPage, SetupTwoFactorPage } from "../features/account/AccountPage.tsx";
import { AcceptInvite } from "../features/account/AcceptInvite.tsx";
import { AdminPage, type AdminTab } from "../features/admin/AdminPage.tsx";
import { ConnectorsPage, type ConnectorsNotice } from "../features/connectors/ConnectorsPage.tsx";
import { DeviceBanner } from "../features/admin/DeviceBanner.tsx";
import { HelpPage } from "../features/help/HelpPage.tsx";

function currentPath(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}`;
}

/** Only allow same-app relative redirects. */
export function safeNext(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return "/";
  if (next.startsWith("/login") || next.startsWith("/signup")) return "/";
  return next;
}

/** Signed in, and two-factor set up when it's required (everything else waits for it). */
async function ensureAuth(destination?: string) {
  const me = await ensureSignedIn();
  if (me.mfaSetupRequired) throw redirect({ to: "/setup-2fa", search: { next: destination ?? currentPath() } });
  return me;
}

async function ensureSignedIn() {
  try {
    return await queryClient.fetchQuery({
      queryKey: authQueryKey,
      queryFn: () => api.me(),
      staleTime: 60_000,
    });
  } catch (error) {
    if (
      error instanceof ApiProblemError &&
      (error.problem.status === 401 ||
        error.problem.status === 503 ||
        error.problem.status === 502)
    ) {
      throw redirect({ to: "/login", search: { next: currentPath() } });
    }
    // Proxy/backend outages often surface as opaque 500s on /auth/me.
    if (error instanceof ApiProblemError && error.problem.status >= 500) {
      throw redirect({ to: "/login", search: { next: currentPath() } });
    }
    throw error;
  }
}

async function redirectIfAuthed({ search }: { search: { next?: string } }) {
  try {
    await queryClient.fetchQuery({
      queryKey: authQueryKey,
      queryFn: () => api.me(),
      staleTime: 60_000,
    });
    throw redirect({ href: safeNext(search.next) });
  } catch (error) {
    if (isRedirect(error)) {
      throw error;
    }
  }
}

const rootRoute = createRootRoute({
  component: () => (
    <>
      <DeviceBanner />
      <Outlet />
      <SearchPaletteHost />
      <ToastHost />
    </>
  ),
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: (search: Record<string, unknown>): { next?: string } =>
    typeof search.next === "string" ? { next: search.next } : {},
  beforeLoad: redirectIfAuthed,
  component: LoginPage,
});

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/signup",
  validateSearch: (search: Record<string, unknown>): { next?: string } =>
    typeof search.next === "string" ? { next: search.next } : {},
  beforeLoad: redirectIfAuthed,
  component: SignupPage,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: async ({ location }) => {
    const me = await ensureAuth(location.href);
    return { me };
  },
  component: HomePage,
});

/** `/bases/bas_…[/tbl_…[/viw_…[/rec_…]]]`: the base page reads the rest of the path itself. */
const baseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/bases/$baseId/$",
  beforeLoad: async ({ location }) => {
    const me = await ensureAuth(location.href);
    return { me };
  },
  component: function BaseRouteComponent() {
    const { baseId } = baseRoute.useParams();
    return <BasePage baseId={baseId} />;
  },
});

const contactsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/contacts",
  validateSearch: (search: Record<string, unknown>) => ({
    workspaceId:
      typeof search.workspaceId === "string" ? search.workspaceId : "",
  }),
  beforeLoad: async ({ search, location }) => {
    const me = await ensureAuth(location.href);
    if (!search.workspaceId) {
      throw redirect({ to: "/" });
    }
    return { me, workspaceId: search.workspaceId };
  },
  component: function ContactsRouteComponent() {
    const { workspaceId } = contactsRoute.useSearch();
    return <ContactsPage workspaceId={workspaceId} />;
  },
});

const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/account",
  beforeLoad: async ({ location }) => {
    const me = await ensureAuth(location.href);
    return { me };
  },
  component: function AccountRouteComponent() {
    const navigate = accountRoute.useNavigate();
    return (
      <AccountPage
        onBack={() => {
          if (window.history.length > 1) window.history.back();
          else void navigate({ to: "/" });
        }}
      />
    );
  },
});

const connectorsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/connectors",
  validateSearch: (search: Record<string, unknown>): ConnectorsNotice => ({
    ...(typeof search.connected === "string" ? { connected: search.connected } : {}),
    ...(search.reconnected !== undefined ? { reconnected: String(search.reconnected) } : {}),
    ...(typeof search.connectError === "string" ? { connectError: search.connectError } : {}),
  }),
  beforeLoad: async ({ location }) => {
    const me = await ensureAuth(location.href);
    return { me };
  },
  component: function ConnectorsRouteComponent() {
    const notice = connectorsRoute.useSearch();
    const navigate = connectorsRoute.useNavigate();
    return (
      <ConnectorsPage
        notice={notice}
        onNoticeShown={() => void navigate({ search: {}, replace: true })}
        onBack={() => {
          if (window.history.length > 1 && !notice.connected && !notice.connectError) window.history.back();
          else void navigate({ to: "/" });
        }}
      />
    );
  },
});

const setupTwoFactorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/setup-2fa",
  validateSearch: (search: Record<string, unknown>): { next?: string } =>
    typeof search.next === "string" ? { next: search.next } : {},
  beforeLoad: async ({ search }) => {
    const me = await ensureSignedIn();
    if (!me.mfaSetupRequired) throw redirect({ href: safeNext(search.next) });
    return { me };
  },
  component: function SetupTwoFactorRouteComponent() {
    const { next } = setupTwoFactorRoute.useSearch();
    return (
      <SetupTwoFactorPage
        onDone={() => {
          void queryClient.invalidateQueries({ queryKey: authQueryKey }).then(() => {
            window.location.assign(safeNext(next));
          });
        }}
        onSignOut={() => {
          void fetch("/v1/auth/logout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).finally(() => {
            queryClient.clear();
            window.location.assign("/login");
          });
        }}
      />
    );
  },
});

const ADMIN_TABS: AdminTab[] = ["people", "devices", "tokens", "activity", "settings"];

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  validateSearch: (search: Record<string, unknown>): { tab: AdminTab } => ({
    tab: ADMIN_TABS.includes(search.tab as AdminTab) ? (search.tab as AdminTab) : "people",
  }),
  beforeLoad: async ({ location }) => {
    const me = await ensureAuth(location.href);
    return { me };
  },
  component: function AdminRouteComponent() {
    const { tab } = adminRoute.useSearch();
    const navigate = adminRoute.useNavigate();
    return (
      <AdminPage
        tab={tab}
        onTab={(t) => void navigate({ search: { tab: t }, replace: true })}
        onBack={() => {
          if (window.history.length > 1) window.history.back();
          else void navigate({ to: "/" });
        }}
      />
    );
  },
});

const helpIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/help",
  beforeLoad: () => {
    throw redirect({ to: "/help/$topic", params: { topic: "getting-started" }, replace: true });
  },
});

/** Help is readable without signing in. */
const helpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/help/$topic",
  component: function HelpRouteComponent() {
    const { topic } = helpRoute.useParams();
    const navigate = helpRoute.useNavigate();
    return (
      <HelpPage
        topic={topic}
        // Replace, so Back leaves Help for the page you came from instead of stepping through topics.
        onTopic={(t) => void navigate({ to: "/help/$topic", params: { topic: t }, replace: true })}
        onBack={() => {
          if (window.history.length > 1) window.history.back();
          else void navigate({ to: "/" });
        }}
      />
    );
  },
});

/** Public: signed-out visitors see the invitation and are sent to log in. */
const inviteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/invite/$token",
  component: function InviteRouteComponent() {
    const { token } = inviteRoute.useParams();
    const navigate = inviteRoute.useNavigate();
    return (
      <AcceptInvite
        token={token}
        onDone={({ baseId }) => {
          if (baseId) void navigate({ to: "/bases/$baseId/$", params: { baseId, _splat: "" } });
          else void navigate({ to: "/" });
        }}
        onSignIn={() =>
          void navigate({ to: "/login", search: { next: `/invite/${encodeURIComponent(token)}` } })
        }
      />
    );
  },
});

/** Older links used `/invite?token=…`. */
const legacyInviteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/invite",
  validateSearch: (search: Record<string, unknown>): { token?: string } =>
    typeof search.token === "string" ? { token: search.token } : {},
  beforeLoad: ({ search }) => {
    if (search.token) throw redirect({ to: "/invite/$token", params: { token: search.token } });
    throw redirect({ to: "/" });
  },
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  signupRoute,
  homeRoute,
  baseRoute,
  contactsRoute,
  accountRoute,
  setupTwoFactorRoute,
  connectorsRoute,
  adminRoute,
  helpIndexRoute,
  helpRoute,
  inviteRoute,
  legacyInviteRoute,
]);

export const router = createRouter({
  routeTree,
  context: { queryClient },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Two-factor turned required mid-session: everything else waits for the setup page.
setMfaSetupHandler(() => {
  const path = currentPath();
  if (path.startsWith("/setup-2fa") || path.startsWith("/login") || path.startsWith("/signup") || path.startsWith("/invite")) return;
  void queryClient.invalidateQueries({ queryKey: authQueryKey });
  void router.navigate({ to: "/setup-2fa", search: { next: path } });
});

// Any 401 from the API mid-session (expired/revoked session) sends the user
// to the login page and brings them back afterwards.
let redirecting = false;
setUnauthorizedHandler(() => {
  if (redirecting) return;
  const path = currentPath();
  if (path.startsWith("/login") || path.startsWith("/signup") || path.startsWith("/invite")) return;
  redirecting = true;
  queryClient.removeQueries({ queryKey: authQueryKey });
  void router
    .navigate({ to: "/login", search: { next: path } })
    .finally(() => {
      redirecting = false;
    });
});

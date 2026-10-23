import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Unit test of the shared unread store (fix round 1, M1): a count answered for a previous user is ignored,
// and the count resets to 0 when the user changes. The Supabase browser client is a hand-made fake.

type Deferred = { resolve: (count: number) => void };
const pending: Deferred[] = [];
let authCallback: ((event: string, session: unknown) => void) | null = null;
let initialSession: unknown = null;

const fakeClient = {
  from: () => ({
    select: () => ({
      is: () =>
        new Promise((resolve) => {
          pending.push({ resolve: (count: number) => resolve({ count, error: null }) });
        }),
    }),
  }),
  realtime: { setAuth: async () => {} },
  channel: () => {
    const ch = { on: () => ch, subscribe: () => ch };
    return ch;
  },
  removeChannel: async () => {},
  auth: {
    getSession: async () => ({ data: { session: initialSession } }),
    onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
      authCallback = cb;
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
  },
};

vi.mock("@/lib/supabase/browser", () => ({ createBrowserClient: () => fakeClient }));

const session = (id: string) => ({ user: { id }, access_token: `token-${id}` });
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("unread store", () => {
  beforeEach(() => {
    pending.length = 0;
    authCallback = null;
    vi.stubGlobal("document", { addEventListener: () => {}, removeEventListener: () => {}, visibilityState: "visible" });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ignores a count answered for the previous user and resets to 0 on a user change", async () => {
    const { unreadStore } = await import("./NotificationBell");
    initialSession = session("user-a");
    const unsubscribe = unreadStore.subscribe(() => {});
    await flush();
    expect(unreadStore.getSnapshot()).toMatchObject({ signedIn: true, count: 0 });
    const forA = pending.shift()!;

    // A answers 7: shown
    forA.resolve(7);
    await flush();
    expect(unreadStore.getSnapshot().count).toBe(7);

    // A asks again (e.g. a realtime event), then the user switches to B before the answer comes back
    const before = pending.length;
    authCallback!("SIGNED_IN", session("user-a")); // same user: no restart
    expect(pending.length).toBe(before);
    authCallback!("SIGNED_IN", session("user-b"));
    await flush();
    expect(unreadStore.getSnapshot().count).toBe(0); // reset at once, A's 7 is gone
    const forB = pending.pop()!;
    forB.resolve(2);
    await flush();
    expect(unreadStore.getSnapshot().count).toBe(2);

    unsubscribe();
    expect(unreadStore.getSnapshot()).toMatchObject({ signedIn: false, count: 0 }); // last consumer gone
  });

  it("drops an in-flight answer when the user changed meanwhile", async () => {
    vi.resetModules();
    const { unreadStore } = await import("./NotificationBell");
    initialSession = session("user-a");
    const unsubscribe = unreadStore.subscribe(() => {});
    await flush();
    const forA = pending.shift()!; // A's request is still in flight
    authCallback!("SIGNED_IN", session("user-b"));
    await flush();
    const forB = pending.pop()!;
    forA.resolve(9); // A's late answer
    await flush();
    expect(unreadStore.getSnapshot().count).toBe(0);
    forB.resolve(3);
    await flush();
    expect(unreadStore.getSnapshot().count).toBe(3);
    unsubscribe();
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";

const addListener = vi.fn();
const exitApp = vi.fn();
const isNativePlatform = vi.fn(() => true);

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: (name: string, cb: () => void) => addListener(name, cb),
    exitApp: () => exitApp(),
  },
}));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => isNativePlatform() } }));

import NativeBackButton from "@/components/NativeBackButton";
import {
  registerBackInterceptor,
  runBackInterceptors,
  clearBackInterceptors,
} from "@/lib/backHandler";

/** Exposes the router's navigate so a test can move between screens. */
let go: (to: string, opts?: { replace?: boolean }) => void = () => {};

function Probe() {
  const location = useLocation();
  go = useNavigate();
  return (
    <>
      <span data-testid="path">{location.pathname}</span>
      <span data-testid="search">{location.search}</span>
    </>
  );
}

/**
 * Mounts once and stays mounted, so the component accumulates its route stack
 * exactly as it would while someone browses.
 */
async function open(startAt: string) {
  addListener.mockReturnValue(Promise.resolve({ remove: vi.fn() }));

  render(
    <MemoryRouter initialEntries={[startAt]}>
      <NativeBackButton />
      <Probe />
    </MemoryRouter>
  );
  await act(async () => {});

  const call = addListener.mock.calls.find(([name]) => name === "backButton");
  const press = call?.[1] as () => void;

  return {
    press: async () => {
      await act(async () => press());
    },
    visit: async (to: string) => {
      await act(async () => go(to));
    },
    replace: async (to: string) => {
      await act(async () => go(to, { replace: true }));
    },
    path: () => screen.getByTestId("path").textContent,
    search: () => screen.getByTestId("search").textContent,
  };
}

beforeEach(() => {
  clearBackInterceptors();
  addListener.mockReset();
  exitApp.mockReset();
  isNativePlatform.mockReturnValue(true);
});

describe("back interceptor chain", () => {
  it("lets the most recently registered surface claim the press first", () => {
    const order: string[] = [];
    registerBackInterceptor(() => {
      order.push("outer");
      return false;
    });
    registerBackInterceptor(() => {
      order.push("inner");
      return true;
    });

    expect(runBackInterceptors()).toBe(true);
    expect(order).toEqual(["inner"]);
  });

  it("falls through when nothing claims it", () => {
    registerBackInterceptor(() => false);
    expect(runBackInterceptors()).toBe(false);
  });

  it("stops running an interceptor once unregistered", () => {
    const fn = vi.fn(() => true);
    registerBackInterceptor(fn)();
    expect(runBackInterceptors()).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });

  it("does not let a throwing interceptor wedge the button", () => {
    registerBackInterceptor(() => {
      throw new Error("boom");
    });
    expect(() => runBackInterceptors()).not.toThrow();
    expect(runBackInterceptors()).toBe(false);
  });
});

describe("hardware back on a TV", () => {
  it("returns to home when that is where the viewer came from", async () => {
    const app = await open("/");
    await app.visit("/watch/movie/603");
    expect(app.path()).toBe("/watch/movie/603");

    await app.press();

    expect(app.path()).toBe("/");
    expect(exitApp).not.toHaveBeenCalled();
  });

  it("returns to search when that is where the viewer came from", async () => {
    const app = await open("/");
    await app.visit("/search");
    await app.visit("/watch/movie/603");

    await app.press();

    expect(app.path()).toBe("/search");
    expect(exitApp).not.toHaveBeenCalled();
  });

  it("walks the whole way back, one screen per press", async () => {
    const app = await open("/");
    await app.visit("/browse/movie");
    await app.visit("/watch/movie/603");

    await app.press();
    expect(app.path()).toBe("/browse/movie");

    await app.press();
    expect(app.path()).toBe("/");
    expect(exitApp).not.toHaveBeenCalled();
  });

  it("leaves the app only from the first screen", async () => {
    const app = await open("/");

    await app.press();

    expect(exitApp).toHaveBeenCalledTimes(1);
  });

  it("goes home rather than exiting when opened straight onto an inner screen", async () => {
    const app = await open("/search");

    await app.press();

    expect(app.path()).toBe("/");
    expect(exitApp).not.toHaveBeenCalled();
  });

  it("yields to a surface that claimed the press, such as the player", async () => {
    const app = await open("/");
    await app.visit("/watch/movie/603");
    registerBackInterceptor(() => true);

    await app.press();

    expect(app.path()).toBe("/watch/movie/603");
    expect(exitApp).not.toHaveBeenCalled();
  });

  it("keeps the search query, so Back lands on the results not an empty box", async () => {
    const app = await open("/");
    await app.visit("/search?q=dune");
    await app.visit("/watch/movie/603");

    await app.press();

    expect(app.path()).toBe("/search");
    expect(app.search()).toBe("?q=dune");
  });

  it("does not replay typing: a replaced query is one screen, not many", async () => {
    const app = await open("/");
    await app.visit("/search");
    // What typing looks like — SearchPage replaces rather than pushes.
    await app.replace("/search?q=d");
    await app.replace("/search?q=du");
    await app.replace("/search?q=dune");

    await app.press();

    // One press leaves search entirely rather than walking back through "du".
    expect(app.path()).toBe("/");
  });

  it("does not touch the hardware button in a browser", async () => {
    isNativePlatform.mockReturnValue(false);
    render(
      <MemoryRouter initialEntries={["/"]}>
        <NativeBackButton />
      </MemoryRouter>
    );
    await act(async () => {});

    expect(addListener).not.toHaveBeenCalled();
  });
});

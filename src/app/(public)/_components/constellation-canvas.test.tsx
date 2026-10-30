import { act, cleanup, render } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

// WebGL does not exist in jsdom, so the renderer is a fake that records its
// lifecycle. The rest of three (geometries, shader materials) is real.
const live = new Set<FakeRenderer>();
const created: FakeRenderer[] = [];
let constructorError: Error | null = null;
let renderError: Error | null = null;

class FakeRenderer {
  domElement = document.createElement("canvas");
  lost = false;
  render: Mock = vi.fn(() => {
    if (renderError) throw renderError;
  });
  dispose: Mock = vi.fn();
  forceContextLoss: Mock = vi.fn(() => {
    live.delete(this);
  });
  setPixelRatio = vi.fn();
  setClearColor = vi.fn();
  setSize = vi.fn();
  constructor() {
    if (constructorError) throw constructorError;
    live.add(this);
    created.push(this);
  }
  getContext() {
    return { isContextLost: () => this.lost };
  }
}

vi.mock("three", async (importOriginal) => ({
  ...(await importOriginal<typeof import("three")>()),
  WebGLRenderer: FakeRenderer,
}));

vi.mock("three/examples/jsm/lines/LineMaterial.js", () => ({
  LineMaterial: class {
    resolution = { set: vi.fn() };
    fog = false;
    dispose = vi.fn();
  },
}));
vi.mock("three/examples/jsm/lines/LineSegments2.js", async () => {
  const { Object3D } = await vi.importActual<typeof import("three")>("three");
  return { LineSegments2: class extends Object3D {} };
});
vi.mock("three/examples/jsm/lines/LineSegmentsGeometry.js", () => ({
  LineSegmentsGeometry: class {
    attributes = { instanceColorStart: { data: { needsUpdate: false } } };
    setPositions() {
      return this;
    }
    setColors() {
      return this;
    }
    dispose = vi.fn();
  },
}));

const { default: ConstellationCanvas, CONTEXT_RESTORE_TIMEOUT_MS } =
  await import("./constellation-canvas");

// Deterministic animation frames: queued, flushed by hand.
let frames = new Map<number, FrameRequestCallback>();
let nextFrame = 1;
function flushFrame() {
  const pending = frames;
  frames = new Map();
  for (const callback of pending.values()) callback(performance.now());
}

// Listener bookkeeping for the targets the canvas subscribes to.
const listeners: Array<[string, string, unknown]> = [];
const observers = new Set<object>();

function trackListeners(target: Window | Document, name: string) {
  const add = target.addEventListener.bind(target);
  const remove = target.removeEventListener.bind(target);
  vi.spyOn(target, "addEventListener").mockImplementation(
    (type: string, listener: EventListenerOrEventListenerObject, options) => {
      listeners.push([name, type, listener]);
      add(type, listener, options);
    },
  );
  vi.spyOn(target, "removeEventListener").mockImplementation(
    (type: string, listener: EventListenerOrEventListenerObject, options) => {
      const index = listeners.findIndex(
        ([n, t, l]) => n === name && t === type && l === listener,
      );
      if (index >= 0) listeners.splice(index, 1);
      remove(type, listener, options);
    },
  );
}

beforeEach(() => {
  live.clear();
  created.length = 0;
  constructorError = null;
  renderError = null;
  frames = new Map();
  listeners.length = 0;
  observers.clear();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    {} as never,
  );
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = nextFrame++;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    frames.delete(id);
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {
        observers.add(this);
      }
      disconnect() {
        observers.delete(this);
      }
      unobserve() {}
    },
  );
  trackListeners(window, "window");
  trackListeners(document, "document");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function host(container: HTMLElement) {
  return container.firstElementChild as HTMLElement;
}

describe("ConstellationCanvas lifecycle", () => {
  it("reports ready only after a frame rendered on a live context", () => {
    const onStateChange = vi.fn();
    const { container } = render(
      <ConstellationCanvas onStateChange={onStateChange} />,
    );

    expect(created).toHaveLength(1);
    expect(created[0].render).toHaveBeenCalled();
    expect(host(container)).toHaveAttribute("data-canvas-state", "ready");
    expect(host(container)).toHaveAttribute("aria-hidden", "true");
    expect(onStateChange).toHaveBeenLastCalledWith("ready");
  });

  it("disposes, releases the context and removes the canvas on unmount", () => {
    const { container, unmount } = render(<ConstellationCanvas />);
    const renderer = created[0];
    expect(container.querySelector("canvas")).toBe(renderer.domElement);

    unmount();

    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(renderer.domElement.isConnected).toBe(false);
  });

  it("leaves no live renderer, frame, observer or listener after 25 mount/unmount cycles", () => {
    for (let i = 0; i < 25; i++) {
      const { unmount } = render(<ConstellationCanvas />);
      flushFrame();
      unmount();
    }

    expect(created).toHaveLength(25);
    expect(live.size).toBe(0);
    expect(frames.size).toBe(0);
    expect(observers.size).toBe(0);
    expect(listeners).toEqual([]);
  });

  it("does not react to its own forced context loss during unmount", () => {
    const onStateChange = vi.fn();
    const { unmount } = render(
      <ConstellationCanvas onStateChange={onStateChange} />,
    );
    const renderer = created[0];
    renderer.forceContextLoss.mockImplementation(() => {
      live.delete(renderer);
      renderer.domElement.dispatchEvent(
        new Event("webglcontextlost", { cancelable: true }),
      );
    });
    onStateChange.mockClear();

    unmount();

    expect(onStateChange).not.toHaveBeenCalled();
  });
});

describe("ConstellationCanvas context loss", () => {
  it("stops the loop and fades to the fallback when the context is lost", () => {
    const onStateChange = vi.fn();
    const { container } = render(
      <ConstellationCanvas onStateChange={onStateChange} />,
    );
    expect(frames.size).toBe(1);

    const lost = new Event("webglcontextlost", { cancelable: true });
    act(() => {
      created[0].lost = true;
      created[0].domElement.dispatchEvent(lost);
    });

    expect(lost.defaultPrevented).toBe(true);
    expect(frames.size).toBe(0);
    expect(host(container)).toHaveAttribute("data-canvas-state", "lost");
    expect(host(container)).toHaveClass("opacity-0");
    expect(onStateChange).toHaveBeenLastCalledWith("lost");
  });

  it("resumes and becomes ready again when the context is restored", () => {
    const { container } = render(<ConstellationCanvas />);
    const renderer = created[0];
    act(() => {
      renderer.lost = true;
      renderer.domElement.dispatchEvent(
        new Event("webglcontextlost", { cancelable: true }),
      );
    });
    renderer.render.mockClear();

    act(() => {
      renderer.lost = false;
      renderer.domElement.dispatchEvent(new Event("webglcontextrestored"));
    });
    act(() => flushFrame());

    expect(renderer.render).toHaveBeenCalled();
    expect(host(container)).toHaveAttribute("data-canvas-state", "ready");
    expect(host(container)).toHaveClass("opacity-100");
    expect(frames.size).toBe(1);
  });

  it("gives up and reports unavailable when no restore arrives in time", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const onStateChange = vi.fn();
    const { container } = render(
      <ConstellationCanvas onStateChange={onStateChange} />,
    );
    act(() => {
      created[0].lost = true;
      created[0].domElement.dispatchEvent(
        new Event("webglcontextlost", { cancelable: true }),
      );
    });

    act(() => vi.advanceTimersByTime(CONTEXT_RESTORE_TIMEOUT_MS + 1));

    expect(host(container)).toHaveAttribute("data-canvas-state", "unavailable");
    expect(onStateChange).toHaveBeenLastCalledWith("unavailable");
  });
});

describe("ConstellationCanvas failures", () => {
  it("reports unavailable when the renderer cannot be created", () => {
    constructorError = new Error("no WebGL");
    const onStateChange = vi.fn();
    const { container } = render(
      <ConstellationCanvas onStateChange={onStateChange} />,
    );

    expect(host(container)).toHaveAttribute("data-canvas-state", "unavailable");
    expect(onStateChange).toHaveBeenLastCalledWith("unavailable");
  });

  it("reports unavailable and cleans up when the first frame throws", () => {
    renderError = new Error("shader failed");
    const onStateChange = vi.fn();
    const { container } = render(
      <ConstellationCanvas onStateChange={onStateChange} />,
    );

    expect(host(container)).toHaveAttribute("data-canvas-state", "unavailable");
    expect(onStateChange).toHaveBeenLastCalledWith("unavailable");
    expect(live.size).toBe(0);
    expect(frames.size).toBe(0);
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("reports unavailable when WebGL is not supported at all", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const { container } = render(<ConstellationCanvas />);

    expect(created).toHaveLength(0);
    expect(host(container)).toHaveAttribute("data-canvas-state", "unavailable");
  });
});

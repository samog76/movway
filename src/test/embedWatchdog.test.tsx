import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render } from "@testing-library/react";
import { createRef } from "react";
import EmbedPlayer from "@/components/EmbedPlayer";
import { getProvider } from "@/lib/providers";
import { emptyPlayback } from "@/lib/embedBridge";

function mount(providerId: string) {
  const onNotResponding = vi.fn();
  const provider = getProvider(providerId);
  render(
    <EmbedPlayer
      embedUrl={provider.buildMovieUrl(27205)}
      frameKey={`${providerId}|movie`}
      title="Inception"
      iframeRef={createRef<HTMLIFrameElement>()}
      provider={provider}
      playback={emptyPlayback()}
      onNotResponding={onNotResponding}
      lastResort={false}
    />
  );
  return onNotResponding;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("stall watchdog", () => {
  it("gives up on a reporting source that stays silent for twenty seconds", () => {
    const onNotResponding = mount("vixsrc");
    act(() => vi.advanceTimersByTime(21000));
    expect(onNotResponding).toHaveBeenCalledTimes(1);
  });

  it("never abandons a source that cannot report, however long it is quiet", () => {
    const onNotResponding = mount("vidsrc");
    act(() => vi.advanceTimersByTime(10 * 60 * 1000));
    expect(onNotResponding).not.toHaveBeenCalled();
  });
});

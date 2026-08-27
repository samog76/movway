/**
 * When to give up on the default playback source.
 *
 * A cross-origin embed cannot be inspected, so "is this working" has to be
 * inferred from the outside. VidLink is the only source that talks back — it
 * posts playback telemetry to the page — so staying silent past a deadline is
 * the signal that it never came up. That catches the cases worth catching (a
 * source that fails to load, is blocked, or is down) and cannot catch a source
 * that loads and then misbehaves, which is the honest limit of the approach.
 */

/** How long to let the default source prove itself before switching. */
export const FALLBACK_AFTER_MS = 12_000;

export interface FallbackDecision {
  providerId: string;
  defaultProviderId: string;
  /** The viewer chose this source themselves. */
  pickedByHand: boolean;
  /** Already switched once for this title. */
  alreadyFellBack: boolean;
}

/**
 * Whether to start watching the current source for silence.
 *
 * Only the default is ever second-guessed: a source the viewer picked should
 * stay picked, and switching away from an alternate they chose would look like
 * the app fighting them.
 */
export function shouldWatchForFailure({
  providerId,
  defaultProviderId,
  pickedByHand,
  alreadyFellBack,
}: FallbackDecision): boolean {
  if (pickedByHand) return false;
  if (alreadyFellBack) return false;
  return providerId === defaultProviderId;
}

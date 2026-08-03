import { solveNextPush } from './solver.js';

/**
 * The solver runs here rather than on the page so a five-second search cannot freeze the
 * tab. This file stays a pure relay — everything worth testing lives in solver.js, which
 * needs no worker to run.
 *
 * No budget is sent across, so solveNextPush falls back to its own generous defaults —
 * unlike hintService.js's main-thread fallback, a search here does not block the page,
 * so there is nothing to guard against by shrinking it.
 */
self.onmessage = ({ data: { id, snapshot } }) => {
  try {
    self.postMessage({ id, hint: solveNextPush(snapshot) });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};

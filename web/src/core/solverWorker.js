import { solveNextPush } from './solver.js';

/**
 * The solver runs here rather than on the page so a five-second search cannot freeze the
 * tab. This file stays a pure relay — everything worth testing lives in solver.js, which
 * needs no worker to run.
 */
self.onmessage = ({ data: { id, snapshot, budget } }) => {
  try {
    self.postMessage({ id, hint: solveNextPush(snapshot, budget) });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};

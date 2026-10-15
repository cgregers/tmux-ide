import { createMachineAgents } from "@tmux-ide/daemon/machine-agents";
import assert from "node:assert/strict";
let closed = 0;
const catalog = { selectedMachineId: "local", groups: [] };
const owner = createMachineAgents({
  manager: {
    getMachine() {
      throw Error("unexpected machine discovery");
    },
  },
  catalog: {
    getSnapshot: () => catalog,
    subscribe(listener) {
      listener(catalog);
      return () => {
        closed++;
      };
    },
  },
});
owner.start();
assert.deepEqual(owner.getSnapshot(), []);
owner.dispose();
assert.equal(closed, 1);
console.log("Emitted Node package subpath import, explicit ownership and disposal: PASS");

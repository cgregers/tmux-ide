// Test-only SSH stand-in. All sockets/files belong to the invoking isolated test.
const process = require("node:process");
const { setInterval } = require("node:timers");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const directory = process.env.GPUI_TEST_REMOTE_DIRECTORY;
if (!directory) process.exit(2);
const { daemon, scope } = JSON.parse(fs.readFileSync(path.join(directory, "fixture.json"), "utf8"));
const args = process.argv.slice(2);
const index = args.indexOf("-L");
if (index < 0 && args.includes("slow-fixture")) {
  fs.writeFileSync(path.join(directory, "slow-open"), "");
  setInterval(() => {}, 1000);
} else if (index < 0) {
  process.stdout.write(JSON.stringify({ version: 1, daemon }));
} else {
  const port = Number(args[index + 1].split(":")[1]);
  const trace = (event) => fs.appendFileSync(path.join(directory, "transport.log"), event + "\n");
  const server = http.createServer((request, response) => {
    let result;
    if (request.url === "/identity") result = { ...daemon, ok: true };
    else if (request.headers.authorization !== `Bearer ${daemon.authToken}`) {
      response.writeHead(401);
      response.end();
      return;
    } else if (request.url === "/api/v2/capabilities")
      result = {
        status: "ok",
        daemon: {
          protocolVersion: daemon.protocolVersion,
          productVersion: daemon.productVersion,
          instanceId: daemon.instanceId,
          startedAt: daemon.startedAt,
        },
        capabilities: { appWindowMutation: { available: false, reason: "fixture" } },
      };
    else if (request.url.endsWith("/sessions"))
      result = { version: 1, server: scope, sessions: [] };
    else result = { version: 1, servers: [{ ...scope, label: "fixture", state: "online" }] };
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(result));
  });
  let stopped = false;
  function stop() {
    if (stopped) return;
    stopped = true;
    trace("closed");
    server.closeAllConnections();
    server.close();
    process.exit(0);
  }
  process.on("SIGTERM", stop);
  server.listen(port, "127.0.0.1", () => trace("opened"));
  setInterval(() => {
    if (fs.existsSync(path.join(directory, "disconnect"))) stop();
  }, 20);
}

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readlink,
  readdir,
  realpath,
  rm,
  rename,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installApp, uninstallApp, rollbackApp } from "./install-transaction.mjs";
async function fixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "gpui-reactivation-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const stagedApp = join(root, "source.app");
  await mkdir(stagedApp);
  await writeFile(join(stagedApp, "binary"), "one");
  return {
    root,
    stagedApp,
    installRoot: join(root, "managed"),
    version: "one",
    verify: async () => true,
  };
}
async function detached(f) {
  await installApp(f);
  await uninstallApp(f);
}
async function isDetached(f) {
  await assert.rejects(readlink(join(f.installRoot, "current")), { code: "ENOENT" });
  await assert.rejects(readlink(join(f.installRoot, "TmuxIDE.app")), { code: "ENOENT" });
  assert.deepEqual(await readdir(join(f.installRoot, "versions")), ["one"]);
}
test("reinstall detached identical version verifies retained copy and reactivates stable alias", async (t) => {
  const f = await fixture(t);
  await detached(f);
  const verified = [];
  const result = await installApp({
    ...f,
    verify: async (app) => {
      verified.push(app);
      return true;
    },
  });
  assert.equal(result.repeated, true);
  assert.ok(verified.includes(join(f.installRoot, "versions/one/TmuxIDE.app")));
  assert.equal(await readlink(join(f.installRoot, "current")), "versions/one/TmuxIDE.app");
  assert.equal(await readlink(join(f.installRoot, "TmuxIDE.app")), "current");
  assert.deepEqual(await readdir(join(f.installRoot, "versions")), ["one"]);
});
test("reactivation preserves existing previous version and rollback", async (t) => {
  const f = await fixture(t);
  await installApp(f);
  await writeFile(join(f.stagedApp, "binary"), "two");
  await installApp({ ...f, version: "two" });
  await uninstallApp(f);
  const result = await installApp({ ...f, version: "two" });
  assert.equal(result.previous, "one");
  const rolled = await rollbackApp(f);
  assert.equal(rolled.version, "one");
  assert.equal(await readFile(join(rolled.app, "binary"), "utf8"), "one");
});
test("detached changed content or retained verifier refusal never activates", async (t) => {
  const f = await fixture(t);
  await detached(f);
  await assert.rejects(
    installApp({ ...f, verify: async (app) => !app.includes("/versions/one/") }),
    /verification denied/,
  );
  await isDetached(f);
  await writeFile(join(f.stagedApp, "binary"), "different");
  await assert.rejects(installApp(f), /already used/);
  await isDetached(f);
});
test("detached retained directory replacement during activation is refused", async (t) => {
  const f = await fixture(t);
  await detached(f);
  const version = join(f.installRoot, "versions/one");
  await assert.rejects(
    installApp({
      ...f,
      beforeActivate: async () => {
        await rename(version, join(f.root, "retained"));
        await mkdir(version, { mode: 0o700 });
        await writeFile(join(version, "foreign"), "preserve");
      },
    }),
    /identity changed/,
  );
  assert.equal(await readFile(join(version, "foreign"), "utf8"), "preserve");
  await assert.rejects(readlink(join(f.installRoot, "current")), { code: "ENOENT" });
});
test("an older retained version cannot replace a different active version through install", async (t) => {
  const f = await fixture(t);
  await installApp(f);
  await installApp({ ...f, version: "two" });
  await assert.rejects(installApp(f), /already used/);
  assert.equal(await readlink(join(f.installRoot, "current")), "versions/two/TmuxIDE.app");
});
for (const mutation of ["payload", "rollback-record"]) {
  test(`detached ${mutation} change after verification is refused`, async (t) => {
    const f = await fixture(t);
    await detached(f);
    const version = join(f.installRoot, "versions/one");
    await assert.rejects(
      installApp({
        ...f,
        beforeActivate: async () => {
          if (mutation === "payload")
            await writeFile(join(version, "TmuxIDE.app/binary"), "changed");
          else {
            const file = join(version, "record.json");
            const record = JSON.parse(await readFile(file, "utf8"));
            record.previous = "unexpected";
            await writeFile(file, JSON.stringify(record));
          }
        },
      }),
      /changed/,
    );
    await assert.rejects(readlink(join(f.installRoot, "current")), { code: "ENOENT" });
    assert.deepEqual(await readdir(join(f.installRoot, "versions")), ["one"]);
  });
}

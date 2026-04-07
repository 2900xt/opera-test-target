const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const { app, resetStore } = require("./index");

// Helper: start a temporary server, run callback, then close it
function withServer(fn) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, async () => {
      const { port } = server.address();
      const base = `http://localhost:${port}`;
      try {
        await fn(base);
        resolve();
      } catch (err) {
        reject(err);
      } finally {
        server.close();
      }
    });
  });
}

// Helper: simple HTTP request returning { status, body }
async function request(method, url, body) {
  const opts = { method };
  if (body !== undefined) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const json = await res.json();
  return { status: res.status, body: json };
}

describe("PATCH /todos/:id", () => {
  beforeEach(() => resetStore());

  it("toggles done from false to true", () =>
    withServer(async (base) => {
      // Create a todo first
      const created = await request("POST", `${base}/todos`, { title: "Buy milk" });
      assert.strictEqual(created.status, 201);
      assert.strictEqual(created.body.done, false);

      const patched = await request("PATCH", `${base}/todos/${created.body.id}`);
      assert.strictEqual(patched.status, 200);
      assert.strictEqual(patched.body.done, true);
      assert.strictEqual(patched.body.id, created.body.id);
      assert.strictEqual(patched.body.title, "Buy milk");
    }));

  it("toggles done from true back to false", () =>
    withServer(async (base) => {
      const created = await request("POST", `${base}/todos`, { title: "Walk dog" });
      const id = created.body.id;

      // Toggle on
      await request("PATCH", `${base}/todos/${id}`);
      // Toggle off
      const patched = await request("PATCH", `${base}/todos/${id}`);
      assert.strictEqual(patched.status, 200);
      assert.strictEqual(patched.body.done, false);
    }));

  it("returns 404 for non-existent id", () =>
    withServer(async (base) => {
      const res = await request("PATCH", `${base}/todos/9999`);
      assert.strictEqual(res.status, 404);
      assert.ok(res.body.error);
    }));

  it("returns 400 for non-numeric id", () =>
    withServer(async (base) => {
      const res = await request("PATCH", `${base}/todos/abc`);
      assert.strictEqual(res.status, 400);
      assert.ok(res.body.error);
    }));

  it("does not affect other todos", () =>
    withServer(async (base) => {
      const a = await request("POST", `${base}/todos`, { title: "Todo A" });
      const b = await request("POST", `${base}/todos`, { title: "Todo B" });

      await request("PATCH", `${base}/todos/${a.body.id}`);

      const list = await request("GET", `${base}/todos`);
      const todoA = list.body.find((t) => t.id === a.body.id);
      const todoB = list.body.find((t) => t.id === b.body.id);

      assert.strictEqual(todoA.done, true);
      assert.strictEqual(todoB.done, false);
    }));
});

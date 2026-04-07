const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const { app, resetStore, todos } = require("./index");

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

// Helper: simple HTTP request returning { status, body, headers }
async function request(method, url, body) {
  const opts = { method };
  if (body !== undefined) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const json = await res.json();
  return { status: res.status, body: json, headers: res.headers };
}

// Helper: raw HTTP request returning { status, text, headers } — safe for empty bodies (e.g. 204)
async function rawRequest(method, url, body) {
  const opts = { method };
  if (body !== undefined) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const text = await res.text();
  return { status: res.status, text, headers: res.headers };
}

// ─── Original Endpoints ───────────────────────────────────────────────

describe("GET /todos", () => {
  beforeEach(() => resetStore());

  it("returns an empty array when no todos exist", () =>
    withServer(async (base) => {
      const res = await request("GET", `${base}/todos`);
      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(res.body, []);
    }));

  it("returns all created todos", () =>
    withServer(async (base) => {
      await request("POST", `${base}/todos`, { title: "First" });
      await request("POST", `${base}/todos`, { title: "Second" });

      const res = await request("GET", `${base}/todos`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.length, 2);
      assert.strictEqual(res.body[0].title, "First");
      assert.strictEqual(res.body[1].title, "Second");
    }));

  it("returns JSON content-type", () =>
    withServer(async (base) => {
      const res = await request("GET", `${base}/todos`);
      assert.ok(
        res.headers.get("content-type").includes("application/json"),
        "Expected application/json content-type"
      );
    }));
});

describe("POST /todos", () => {
  beforeEach(() => resetStore());

  it("creates a todo and returns 201", () =>
    withServer(async (base) => {
      const res = await request("POST", `${base}/todos`, { title: "New todo" });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.title, "New todo");
      assert.strictEqual(res.body.done, false);
      assert.strictEqual(typeof res.body.id, "number");
    }));

  it("returns 400 when title is missing", () =>
    withServer(async (base) => {
      const res = await request("POST", `${base}/todos`, {});
      assert.strictEqual(res.status, 400);
      assert.ok(res.body.error);
    }));

  it("assigns incrementing ids", () =>
    withServer(async (base) => {
      const a = await request("POST", `${base}/todos`, { title: "A" });
      const b = await request("POST", `${base}/todos`, { title: "B" });
      assert.strictEqual(a.body.id + 1, b.body.id);
    }));
});

// ─── PATCH /todos/:id ─────────────────────────────────────────────────

describe("PATCH /todos/:id", () => {
  beforeEach(() => resetStore());

  it("toggles done from false to true", () =>
    withServer(async (base) => {
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

  it("returns JSON content-type on success", () =>
    withServer(async (base) => {
      const created = await request("POST", `${base}/todos`, { title: "Check headers" });
      const patched = await request("PATCH", `${base}/todos/${created.body.id}`);
      assert.strictEqual(patched.status, 200);
      assert.ok(
        patched.headers.get("content-type").includes("application/json"),
        "Expected application/json content-type"
      );
    }));

  it("returns full todo object in response", () =>
    withServer(async (base) => {
      const created = await request("POST", `${base}/todos`, { title: "Full object" });
      const patched = await request("PATCH", `${base}/todos/${created.body.id}`);
      assert.strictEqual(typeof patched.body.id, "number");
      assert.strictEqual(typeof patched.body.title, "string");
      assert.strictEqual(typeof patched.body.done, "boolean");
    }));

  it("handles a todo whose done field was deleted", () =>
    withServer(async (base) => {
      // Create a todo, then manually remove its done field
      const created = await request("POST", `${base}/todos`, { title: "No done field" });
      const todo = todos.find((t) => t.id === created.body.id);
      delete todo.done;

      // PATCH should treat missing done as false, then toggle to true
      const patched = await request("PATCH", `${base}/todos/${created.body.id}`);
      assert.strictEqual(patched.status, 200);
      assert.strictEqual(patched.body.done, true, "Should toggle missing done to true");
    }));
});

// ─── DELETE /todos/:id ────────────────────────────────────────────────

describe("DELETE /todos/:id", () => {
  beforeEach(() => resetStore());

  it("removes a todo and returns 204 with empty body", () =>
    withServer(async (base) => {
      const created = await request("POST", `${base}/todos`, { title: "Delete me" });
      assert.strictEqual(created.status, 201);
      const id = created.body.id;

      const del = await rawRequest("DELETE", `${base}/todos/${id}`);
      assert.strictEqual(del.status, 204);
      assert.strictEqual(del.text, "");

      // Verify the todo is gone
      const list = await request("GET", `${base}/todos`);
      assert.strictEqual(list.status, 200);
      assert.ok(!list.body.find((t) => t.id === id), "Deleted todo should not appear in list");
    }));

  it("returns 404 for non-existent id", () =>
    withServer(async (base) => {
      const res = await request("DELETE", `${base}/todos/9999`);
      assert.strictEqual(res.status, 404);
      assert.ok(res.body.error);
    }));

  it("returns 404 for non-numeric id", () =>
    withServer(async (base) => {
      const res = await request("DELETE", `${base}/todos/abc`);
      assert.strictEqual(res.status, 404);
      assert.ok(res.body.error);
    }));

  it("does not remove other todos", () =>
    withServer(async (base) => {
      const a = await request("POST", `${base}/todos`, { title: "Keep me" });
      const b = await request("POST", `${base}/todos`, { title: "Delete me" });

      await rawRequest("DELETE", `${base}/todos/${b.body.id}`);

      const list = await request("GET", `${base}/todos`);
      assert.strictEqual(list.body.length, 1);
      assert.strictEqual(list.body[0].id, a.body.id);
    }));

  it("handles deleting from an empty list gracefully", () =>
    withServer(async (base) => {
      const res = await request("DELETE", `${base}/todos/1`);
      assert.strictEqual(res.status, 404);
      assert.ok(res.body.error);
    }));

  it("actually removes the todo from the in-memory store", () =>
    withServer(async (base) => {
      const created = await request("POST", `${base}/todos`, { title: "Check store" });
      assert.strictEqual(todos.length, 1, "Store should have 1 todo before delete");

      await rawRequest("DELETE", `${base}/todos/${created.body.id}`);
      assert.strictEqual(todos.length, 0, "Store should be empty after delete");
    }));
});

// ─── Error Handling ───────────────────────────────────────────────────

describe("Error handling", () => {
  beforeEach(() => resetStore());

  it("returns 404 JSON for unknown routes", () =>
    withServer(async (base) => {
      const res = await request("GET", `${base}/nonexistent-route`);
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.error, "Route not found");
    }));

  it("returns 404 JSON for unknown nested routes", () =>
    withServer(async (base) => {
      const res = await request("POST", `${base}/foo/bar/baz`);
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.error, "Route not found");
    }));

  it("returns 404 for unknown route with various HTTP methods", () =>
    withServer(async (base) => {
      for (const method of ["GET", "POST", "PUT", "DELETE", "PATCH"]) {
        const res = await request(method, `${base}/unknown`);
        assert.strictEqual(
          res.status,
          404,
          `Expected 404 for ${method} /unknown`
        );
      }
    }));

  it("PATCH /todos/abc returns JSON error", () =>
    withServer(async (base) => {
      const res = await request("PATCH", `${base}/todos/abc`);
      assert.strictEqual(res.status, 400);
      assert.ok(res.body.error);
    }));

  it("DELETE /todos/999 returns 404 JSON error", () =>
    withServer(async (base) => {
      const res = await request("DELETE", `${base}/todos/999`);
      assert.strictEqual(res.status, 404);
      assert.ok(res.body.error);
    }));

  it("error responses have consistent JSON shape with string error field", () =>
    withServer(async (base) => {
      const routes = [
        { method: "GET", path: "/does-not-exist" },
        { method: "PATCH", path: "/todos/abc" },
        { method: "PATCH", path: "/todos/9999" },
        { method: "DELETE", path: "/todos/9999" },
        { method: "DELETE", path: "/todos/abc" },
      ];
      for (const { method, path } of routes) {
        const res = await request(method, `${base}${path}`);
        assert.ok(
          typeof res.body.error === "string" && res.body.error.length > 0,
          `Expected string error for ${method} ${path}, got: ${JSON.stringify(res.body)}`
        );
      }
    }));

  it("error responses are valid JSON with correct content-type", () =>
    withServer(async (base) => {
      const res = await request("GET", `${base}/nope`);
      assert.strictEqual(res.status, 404);
      assert.ok(
        res.headers.get("content-type").includes("application/json"),
        "Error responses should have application/json content-type"
      );
    }));
});

// ─── Integration Tests ────────────────────────────────────────────────

describe("Integration: full workflow", () => {
  beforeEach(() => resetStore());

  it("create → toggle → delete lifecycle", () =>
    withServer(async (base) => {
      // Create
      const created = await request("POST", `${base}/todos`, { title: "Lifecycle test" });
      assert.strictEqual(created.status, 201);
      assert.strictEqual(created.body.done, false);
      const id = created.body.id;

      // Toggle done on
      const toggled = await request("PATCH", `${base}/todos/${id}`);
      assert.strictEqual(toggled.status, 200);
      assert.strictEqual(toggled.body.done, true);

      // Verify via GET
      const listBefore = await request("GET", `${base}/todos`);
      assert.strictEqual(listBefore.body.length, 1);
      assert.strictEqual(listBefore.body[0].done, true);

      // Delete
      const del = await rawRequest("DELETE", `${base}/todos/${id}`);
      assert.strictEqual(del.status, 204);

      // Verify deletion via GET
      const listAfter = await request("GET", `${base}/todos`);
      assert.strictEqual(listAfter.body.length, 0);
    }));

  it("multiple operations in sequence maintain correct state", () =>
    withServer(async (base) => {
      // Create three todos
      const t1 = await request("POST", `${base}/todos`, { title: "Todo 1" });
      const t2 = await request("POST", `${base}/todos`, { title: "Todo 2" });
      const t3 = await request("POST", `${base}/todos`, { title: "Todo 3" });

      // Toggle t1 and t3
      await request("PATCH", `${base}/todos/${t1.body.id}`);
      await request("PATCH", `${base}/todos/${t3.body.id}`);

      // Delete t2
      await rawRequest("DELETE", `${base}/todos/${t2.body.id}`);

      // Verify final state
      const list = await request("GET", `${base}/todos`);
      assert.strictEqual(list.body.length, 2, "Should have 2 todos remaining");

      const remaining1 = list.body.find((t) => t.id === t1.body.id);
      const remaining3 = list.body.find((t) => t.id === t3.body.id);

      assert.ok(remaining1, "Todo 1 should still exist");
      assert.ok(remaining3, "Todo 3 should still exist");
      assert.strictEqual(remaining1.done, true, "Todo 1 should be toggled done");
      assert.strictEqual(remaining3.done, true, "Todo 3 should be toggled done");
      assert.ok(
        !list.body.find((t) => t.id === t2.body.id),
        "Todo 2 should be deleted"
      );
    }));

  it("data persists across operations within the same session", () =>
    withServer(async (base) => {
      // Create a todo
      await request("POST", `${base}/todos`, { title: "Persistent" });

      // Fetch it
      const list1 = await request("GET", `${base}/todos`);
      assert.strictEqual(list1.body.length, 1);

      // Toggle it
      await request("PATCH", `${base}/todos/${list1.body[0].id}`);

      // Fetch again — toggle should persist
      const list2 = await request("GET", `${base}/todos`);
      assert.strictEqual(list2.body[0].done, true, "Toggle should persist across requests");

      // Create another
      await request("POST", `${base}/todos`, { title: "Second" });

      // Both should exist
      const list3 = await request("GET", `${base}/todos`);
      assert.strictEqual(list3.body.length, 2, "Both todos should persist");
    }));

  it("deleting a toggled todo works correctly", () =>
    withServer(async (base) => {
      const created = await request("POST", `${base}/todos`, { title: "Toggle then delete" });
      const id = created.body.id;

      // Toggle
      await request("PATCH", `${base}/todos/${id}`);
      // Delete the toggled todo
      const del = await rawRequest("DELETE", `${base}/todos/${id}`);
      assert.strictEqual(del.status, 204);

      const list = await request("GET", `${base}/todos`);
      assert.strictEqual(list.body.length, 0);
    }));

  it("cannot toggle or delete an already-deleted todo", () =>
    withServer(async (base) => {
      const created = await request("POST", `${base}/todos`, { title: "Will be gone" });
      const id = created.body.id;

      await rawRequest("DELETE", `${base}/todos/${id}`);

      // Attempt to toggle deleted todo
      const patchRes = await request("PATCH", `${base}/todos/${id}`);
      assert.strictEqual(patchRes.status, 404, "PATCH on deleted todo should 404");

      // Attempt to delete again
      const delRes = await request("DELETE", `${base}/todos/${id}`);
      assert.strictEqual(delRes.status, 404, "DELETE on deleted todo should 404");
    }));
});

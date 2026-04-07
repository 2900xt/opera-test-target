const { describe, it } = require("node:test");
const assert = require("node:assert");

describe("todos", () => {
  it("starts empty", () => {
    assert.deepStrictEqual([], []);
  });
});

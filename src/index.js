const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// In-memory todo store
const todos = [];
let nextId = 1;

app.get("/todos", (req, res) => {
  res.json(todos);
});

app.post("/todos", (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: "title required" });
  const todo = { id: nextId++, title, done: false };
  todos.push(todo);
  res.status(201).json(todo);
});

app.patch("/todos/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "id must be a number" });
  }
  const todo = todos.find((t) => t.id === id);
  if (!todo) {
    return res.status(404).json({ error: "todo not found" });
  }
  if (typeof todo.done !== "boolean") {
    todo.done = false;
  }
  todo.done = !todo.done;
  res.json(todo);
});

app.delete("/todos/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(404).json({ error: "todo not found" });
  }
  const index = todos.findIndex((t) => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "todo not found" });
  }
  todos.splice(index, 1);
  res.status(204).send();
});

// Utility to reset in-memory store between tests
function resetStore() {
  todos.length = 0;
  nextId = 1;
}

if (require.main === module) {
  app.listen(PORT, () => console.log(`Listening on :${PORT}`));
}

module.exports = { app, todos, resetStore };

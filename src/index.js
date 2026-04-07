const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// In-memory todo store
const todos = [];
let nextId = 1;

app.get("/todos", (req, res, next) => {
  try {
    res.json(todos);
  } catch (err) {
    next(err);
  }
});

app.post("/todos", (req, res, next) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: "title required" });
    const todo = { id: nextId++, title, done: false };
    todos.push(todo);
    res.status(201).json(todo);
  } catch (err) {
    next(err);
  }
});

app.patch("/todos/:id", (req, res, next) => {
  try {
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
  } catch (err) {
    next(err);
  }
});

app.delete("/todos/:id", (req, res, next) => {
  try {
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
  } catch (err) {
    next(err);
  }
});

// 404 handler — must come after all route definitions
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Generic error handler — must be the last middleware
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
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

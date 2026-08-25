## graphify
This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase or architecture questions, when graph.json exists, first run `graphify query "<question>"`.
- Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts.
- `graphify update .` is triggered automatically by the post-commit hook.

# Graphify Mandate

Before any code review, change, or troubleshooting that touches source files, you MUST consult the codebase graph first:

1. **Discovery** — run `graphify query "<question>"` to find relevant symbols, callers, callees, and community structure.
2. **Relationships** — use `graphify path "A" "B"` when tracing between two points of interest.
3. **Explanation** — use `graphify explain "X"` for plain-language context on a symbol or component.
4. **Fallback** — only reach for grep/glob/read when graphify returns no hits or the query is about non-code content (config values, asset files, prose).

After editing any source file, run `graphify update .` to keep the graph fresh before finishing.

This rule overrides direct file reads for code-adjacent work. The graph is your primary navigation layer; filesystem tools are secondary.

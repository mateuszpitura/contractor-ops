---
title: Hybrid retrieval
type: meta
tags: [meta, retrieval, bm25]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - .planning/brain/scripts/bm25-index.py
  - .planning/brain/scripts/retrieve.py
updated: 2026-06-10
---

# Hybrid retrieval (BM25)

BM25 index built over wiki chunks for semantic/BM25 hybrid search via `scripts/retrieve.py`.

## Build (re-run after wiki edits)

```bash
cd .planning/brain
# --all skips dot-path vault roots; chunk per file:
find wiki -name '*.md' -exec python3 scripts/contextual-prefix.py {} --no-llm \;
python3 scripts/bm25-index.py build
python3 scripts/bm25-index.py stats
```

## Query

```bash
python3 scripts/retrieve.py "invoice approval payment gate"
```

## Note

`contextual-prefix.py --all` returns 0 pages when vault lives under `.planning/` (path filter excludes dot segments). Use per-file loop above.

## Embeddings / rerank (optional)

`retrieve.py` can rerank via Ollama when configured. **BM25 alone is sufficient** for agent wiki lookup; embeddings not provisioned in CI. To enable locally: install Ollama + model, then follow claude-obsidian `wiki-retrieve` skill `bin/setup-retrieve.sh`.

## Related

- [[agent-discovery]]
- [[refresh-triggers]]

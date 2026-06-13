# TODO - RAG debug completeness audit (end-to-end)

- [x] Implement debug-only artifact `06_GROUNDED_META.json`
  - [x] Update `core/3.query/grounding.ts` to compute:
    - [x] `selected_chunk_ids`
    - [x] `grounded_chunk_count`
    - [x] `grounded_token_estimate`
  - [x] Update `core/3.query/agents/shared/base-agent.ts` to dump `06_GROUNDED_META.json` under `RAG_DEBUG_DUMP==="true"`
- [x] Verify no grounding/prompt/ranking/chunk-selection logic changes


- [ ] Run TypeScript build/tests
- [ ] Confirm FULL PIPELINE TRACE COMPLETE = YES/NO (by locating the new artifact in debug output)


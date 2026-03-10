# Million Cells Grid - Dominator Stress Test

A 1,000,000-cell grid (1000×1000) stress test for the Dominator reactive UI framework, proving ultra-high-performance rendering with fine-grained signals.

## Run

```bash
cd packages/stress-million-cells-grid
pnpm install
pnpm dev
```

Open http://localhost:5175

## Performance Targets

| Metric | Target | Description |
|--------|--------|-------------|
| Frame time | <10-12ms | Time per RAF frame during updates |
| FPS | 60 stable | Frames per second under load |
| Live DOM | <1000 nodes | Only visible viewport rendered |
| Batch size | 1000-3000 | Random cell updates per frame |
| Signal updates/sec | Millions | Via batch() for efficient batching |

## Architecture

### Data Storage
- **Sparse Map**: `Map<string, number>` using `${row}-${col}` keys
- Avoids allocating 1M-element arrays
- Only non-zero cells stored in memory

### Virtualization
- Render only visible viewport + overscan (25 rows/cols)
- Target: ~2500 max visible cells, ~400-800 typical VNodes
- Dynamic viewport recalculation on scroll

### Update Strategy
- RAF loop with `batch()` for mass writes
- 1000-3000 random cell updates per frame
- Values range 0-100

### Computed Derivatives
- `rowSums`: Per-row heat accumulation
- `colAverages`: Per-column statistics
- `highValueCount`: Cells with value ≥80

### Branching Conditionals
The main.ts implements deep conditionals per cell:
```typescript
if (value >= 80)  // red bg + star icon + glow
else if (value >= 50)  // orange heat bar
else if (value >= 20)  // value text
else if (value > 0)  // blue low + mini bar
```

## Optimization Notes

1. **batch() usage**: All random updates wrapped in `batch()` to coalesce signal notifications into single effect run
2. **Sparse storage**: Map<string, number> avoids massive array allocations
3. **Virtualization**: Only render visible cells + overscan, not the full 1M grid
4. **Stable keys**: `${row}-${col}` ensures consistent DOM reconciliation
5. **Minimal effect deps**: Effects read specific signals, not entire grid
6. **will-change hints**: CSS `will-change: transform` on viewport spacer
7. **Event delegation**: Single scroll listener on container instead of per-cell
8. **Reuse cell elements**: Update cell innerHTML/classList instead of recreating

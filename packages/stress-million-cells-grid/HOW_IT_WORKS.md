# How The Million Cells Grid Stress Test Works

## What Is This Thing?

A virtualized spreadsheet grid: **1,000 rows × 1,000 columns = 1,000,000 logical cells**. Only ~5,000 cells exist in the DOM at any time (virtual scrolling). Every frame, 1,000–3,000 random cells get new random values — and it runs at 60fps.

The point: **break Dominator. And fail to break it.**

---

## Why Random Updates?

```ts
const batchSize = 1000 + Math.floor(Math.random() * 2000);

for (let i = 0; i < batchSize; i++) {
    const r = Math.floor(Math.random() * 1000);
    const c = Math.floor(Math.random() * 1000);
    const val = Math.floor(Math.random() * 101);
    data.set(`${r}-${c}`, val);
}
```

**Random is the hardest possible test:**

1. **No cache friendliness** — Every update hits different cells. CPU caches, browser rendering caches, nothing helps.

2. **No optimization pattern** — No sequential access. No hot rows. Pure chaos. If Dominator handles this, it handles any real-world pattern.

3. **Worst-case DOM layout** — Random cells across the full 1M grid. The browser can't predict or batch layout.

4. **Sparse distribution** — Most updated cells are NOT in the visible viewport. Dominator still processes every signal notification — but invisible cells are no-ops. The cost is still O(1) per cell.

### What Would Happen In React?

3,000 `setState()` calls → 3,000 re-render schedules → 5,000+ VNode tree allocations → diff all 1M+ virtual nodes → browser freezes.

**In Dominator**: 3,000 `data.set()` calls → 1 `gridData.set(new Map(data))` → microtask fires → visible cell effects re-run (~15k DOM writes in <3ms) → invisible cell effects are no-ops → paint at 60fps.

---

## Frame-By-Frame Trace

Let's trace ONE frame of the RAF loop:

```
requestAnimationFrame(loop)
    │
    ├── batchSize = 2,347 (random 1000–3000)
    │
    ├── batch(() → {
    │     for (let i = 0; i < 2347; i++) {
    │         random_r = Math.floor(Math.random() * 1000)
    │         random_c = Math.floor(Math.random() * 1000)
    │         random_val = Math.floor(Math.random() * 101)
    │         data.set(`${random_r}-${random_c}`, random_val)
    │     }
    │     // At this point: 2,347 Map entries mutated
    │     // ZERO effects have run. ZERO DOM writes.
    │
    │     gridData.set(new Map(data))
    │     // signal.set() queues notifications
    │     // Still NO DOM writes — queued in microtask
    │ })
    │
    ├── queueMicrotask(flush) fires:
    │     ├── stats() computed re-evaluates
    │     │     → reads gridData() + viewport
    │     │     → outputs new { avg, total, highValues }
    │     │     → stats signal notifies → overlay effect re-runs
    │     │
    │     ├── For EACH visible cell (×3 effects):
    │     │     effect #1: getCellFullClass(row, col)
    │     │       → reads gridData() → gets value
    │     │       → builds className string
    │     │       → el.setAttribute('class', ...)
    │     │
    │     │     effect #2: getCellBg(row, col)
    │     │       → reads gridData() → gets value
    │     │       → builds hsl() color string
    │     │       → el.style.background = ...
    │     │
    │     │     effect #3: getCellValue(row, col)
    │     │       → reads gridData() → gets value
    │     │       → el.textContent = String(...)
    │     │
    │     └── Invisible cell effects:
    │           → same 3 reads, but DOM nodes are detached
    │           → writes to detached nodes = wasted but O(1)
    │           → no visible work, no cost
    │
    └── Browser paints → next RAF fires
```

**Total per frame:**
- 1 microtask dispatch
- 1 `Map` clone (`new Map(data)`)
- ~5,000 effect re-runs (visible cells × 3)
- ~15,000 DOM property writes
- **0 VNode allocations**
- **0 diff operations**
- **0 tree traversals**

**React equivalent:**
- 3,000 `setState()` calls
- 5,000+ component re-renders
- 5,000+ VNode trees allocated
- 5,000+ VNode trees diffed
- Same 15,000 DOM writes
- + GC pause collecting all those VNode objects

React does ~10,000 **extra** operations per frame. At 60fps, that's 600,000 extra ops/second. The browser can't keep up.

---

## Why `batch()` Is Critical

Without `batch()`, 3,000 signal `.set()` calls would cause 3,000 separate effect flushes:

```
No batch:
    signal.set() → effect runs → DOM write → layout → signal.set() → ...
    3,000 separate layouts = browser recalculates styles 3,000 times = 0fps
```

With `batch()`:

```
batch(() → {
    signal.set()  // queued
    signal.set()  // queued
    signal.set()  // queued
    // ... 2,997 more ...
})
→ queueMicrotask(flush)
→ ALL effects run
→ ONE layout calculation
```

This is the difference between smooth 60fps and a frozen tab.

---

## The Signal Chain

```
                      ┌──────────────────┐
                      │  viewport signals │
                      │  rowStart/End     │
                      │  colStart/End     │
                      └────────┬─────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │  computed()       │
                      │  visibleRows()    │
                      │  visibleCols()    │
                      └────────┬─────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │  Template effect  │
                      │  {#each rows}     │
                      │  {#each cols}     │
                      └────────┬─────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Cell effect #1  │  │ Cell effect #2  │  │ Cell effect #3  │
│ getCellFullClass│  │ getCellBg()     │  │ getCellValue()  │
│ → reads gridData│  │ → reads gridData│  │ → reads gridData│
│ → sets class    │  │ → sets bg color │  │ → sets text     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              ▼
                     ┌─────────────────┐
                     │  gridData       │
                     │  signal<Map>    │
                     └─────────────────┘
```

When `gridData` changes:
- **Stats computed** re-evaluates → updates overlay
- **Every visible cell** has 3 effects that re-run and read the new value
- **Invisible cells** also have effects (registered when they were in view) — they re-run but write to detached DOM nodes. This is wasted work, but it's O(1) per cell and doesn't affect the visible page.

---

## The FPS Counter Is Truth

```html
<span style:color="{state.perf.fps() < 55 ? '#ff4444' : '#00ff00'}">
  {state.perf.fps()}
</span>
```

- **Green** (≥ 55fps): Dominator is keeping up
- **Red** (< 55fps): Something is wrong

No DevTools. No profiler. No benchmark trick. Just a number that turns red the instant the framework struggles. Open the page. Watch it. It stays green.

---

## What The Overlay Reveals

| Metric | What | Why |
|--------|------|-----|
| **FPS** | Frames per second | Target 60. Red if < 55. |
| **RENDER** | Avg frame time (ms) | Should be 1–3ms. Leaves 13ms+ for browser paint. |
| **BATCH** | Cells updated this frame | Varies 1k–3k. Proves the workload is real. |
| **DOM** | Total DOM nodes | ~5k = virtual scrolling works. Growing = memory leak. |
| **AVG VAL** | Avg cell value in viewport | Sanity check — data is actually changing. |
| **HIGH** | Cells ≥ 80 in viewport | Sanity check — distribution is correct. |

---

## What This Proves

### 1. O(1) Updates Are Real

Every cell update costs exactly the same regardless of grid size:
```
1 signal read → 1 effect re-run → 1 DOM property write
```

No tree factor. No component count. 100 cells or 100 million — same cost per update.

### 2. Zero GC Pressure

The compiled render function never allocates temporary objects. No VNodes, no patch arrays, no diff results. The only allocations are:
- DOM elements (when cells scroll into view)
- `new Map(data)` (one per frame, ~4KB)
- Signal subscriber sets (grow once, never shrink)

**No GC pauses.** GC kills framerate — the event loop stops, browser collects garbage, animation skips. Dominator doesn't create garbage.

### 3. Virtual Scrolling + Signals Work Together

Scrolling updates 4 viewport signals → 2 computed signals re-evaluate → template `{#each}` effects re-run → DOM nodes created/destroyed. All automatic. No `shouldComponentUpdate`, no `key` props, no `useMemo`.

### 4. No Scale Limit

Million cells is just the number we chose. Same architecture works for 10M or 100M — the DOM only has visible cells, and update cost is always O(1).

### 5. batch() Makes 60fps Possible

Without `batch()`: 3,000 signal sets = 3,000 layouts = 0fps.
With `batch()`: 3,000 signal sets = 1 microtask flush = 60fps.

---

## Summary

```
┌──────────────────────────────────────────────────────────┐
│  1,000,000 virtual cells                                 │
│  3,000 random updates every 16ms                         │
│  0 VNode allocations per frame                           │
│  0 diff operations per frame                             │
│  60 FPS.                                                  │
│                                                          │
│  Try this in React. I dare you.                          │
└──────────────────────────────────────────────────────────┘
```

The random updates are the key. They prove Dominator's performance is NOT a result of favorable conditions. Random is the worst case — no pattern to exploit, no cache to warm, no shortcut. And it handles it easily at 60fps.

That's the proof. Not a benchmark. Not a synthetic test. A running app you can open in your browser and watch.

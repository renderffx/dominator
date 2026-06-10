# Dominator: SSA-Based UI Foundation

Dominator is a high-performance UI engine that compiles templates into a Static Single Assignment (SSA) instruction set. It eliminates the virtual DOM reconciliation layer, targeting the DOM directly via a linear pipeline of imperative updates.

## Technical Fundamentals

- **SSA Instruction Set**: Templates map directly to atomic DOM operations.
- **Fine-Grained Reactivity**: State changes target specific instruction offsets.
- **Batched Scheduling**: Coordinated microtask queue for DOM commits.
- **Zero Reconciliation**: No tree diffing or runtime overhead.

## Showcase: Ralph Loop

The Ralph Loop is a high-performance benchmark demonstrating Dominator's ability to handle extreme state pressure. It renders 1,000+ independent nodes updated via a high-frequency `requestAnimationFrame` loop.

- **Location**: `packages/ralph-loop`
- **Performance**: 5k+ property updates per frame at 60 FPS.
- **Architecture**: Signal-based physics and instruction reification.

## Technical Architecture

### SSA Pipeline

The compiler transforms DNR templates into SSA form. Dynamic expressions are reified into `effect` blocks that maintain a 1:1 mapping with DOM nodes. This ensures that state updates have a time complexity of $O(1)$ relative to the tree size.

### Instruction Set

- `create(tag)`: Node allocation.
- `attr(id, key, val)`: Atomic reactive attribute binding.
- `append(parent, child)`: Tree assembly.
- `each(source, scope)`: Block-level reactive iteration.

## Development

### Installation

```bash
pnpm install
```

### Execution

```bash
# Run Ralph Loop Benchmark
pnpm --filter @dominator/ralph-loop dev

# Run Pixel Canvas Demo
pnpm --filter @dominator/pixel-canvas dev
```

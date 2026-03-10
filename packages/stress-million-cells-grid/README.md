# @dominator/stress-million-cells-grid

Extreme performance benchmark for the Dominator reactive framework featuring a 1-million cell grid.

## Design Aesthetic
- **Timeless Minimalism**: Strict black/white/grayscale palette.
- **Monospace Focus**: Clean typography using system-ui and monospace for data.
- **Negative Space**: Minimal distractions, focus on data density and movement.
- **Sharp Geometry**: Square corners, thin lines, subtle glow effects on high-value cells.

## Performance Targets
- **Stability**: Constant 60 FPS.
- **Efficiency**: <10-12ms total frame time under 3k cell updates/frame.
- **Footprint**: <1,000 live DOM nodes maintained by 2D virtualization.
- **Responsiveness**: Immediate cell selection and 2D scrolling.

## Optimizations
- **2D Virtualization**: Renders only the viewport + overscan for both axes.
- **Sparse Storage**: `Map<string, number>` prevents million-element array allocations.
- **Batched RAF**: Centralized `requestAnimationFrame` loop with `batch()` for mutations.
- **CSS Isolation**: `contain: strict` on the viewport wrapper for layout/paint optimization.
- **Text Re-patching**: Leverages Dominator's fine-grained `effect` tracking for text nodes.

## Running Locally
```bash
cd packages/stress-million-cells-grid
pnpm dev
```
Open http://localhost:5176

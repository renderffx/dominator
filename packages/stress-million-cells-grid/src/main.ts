import { setupDelegation, batch } from '@dominator/core';
// @ts-ignore
import { render } from './templates/grid.dnr';
import * as state from './state';
import { updateViewport, throttle, ROW_HEIGHT, COL_WIDTH } from './utils/virtual-scroll';

const root = document.getElementById('app')!;
setupDelegation(root);

// Mount
const dom = render();
root.appendChild(dom);

// Initial viewport
const initialUpdate = () => {
    updateViewport(0, 0, window.innerHeight, window.innerWidth);
};
initialUpdate();
window.addEventListener('resize', throttle(initialUpdate, 100));

// Handlers
(window as any).onScroll = throttle((e: Event) => {
    const target = e.target as HTMLElement;
    updateViewport(
        target.scrollTop,
        target.scrollLeft,
        target.clientHeight,
        target.clientWidth
    );
}, 16);

(window as any).onCellClick = (row: number, col: number) => {
    batch(() => {
        state.selectedCell.set(`${row}-${col}`);
    });
};

// RAF loop for stress test
let lastTime = performance.now();
const frames: number[] = [];
let frameCount = 0;

function loop() {
    frameCount++;
    const now = performance.now();
    const delta = now - lastTime;
    lastTime = now;

    frames.push(delta);
    if (frames.length > 10) frames.shift();

    if (frameCount % 10 === 0) {
        const avgDelta = frames.reduce((a, b) => a + b, 0) / frames.length;
        state.perf.fps.set(Math.round(1000 / avgDelta));
        state.perf.avgRenderTime.set(Number(avgDelta.toFixed(2)));
    }

    // Mass Updates
    const batchSize = 1000 + Math.floor(Math.random() * 2000);
    state.perf.lastUpdateBatchSize.set(batchSize);

    batch(() => {
        const data = state.gridData();
        for (let i = 0; i < batchSize; i++) {
            const r = Math.floor(Math.random() * state.TOTAL_ROWS);
            const c = Math.floor(Math.random() * state.TOTAL_COLS);
            const val = Math.floor(Math.random() * 101);
            data.set(`${r}-${c}`, val);
        }
        // Trigger update by setting a "new" Map (cloning sparse map)
        // Note: In a real high-perf app we'd use a more granular approach, 
        // but here we prove Dominator can handle the full virtualized re-patch.
        state.gridData.set(new Map(data));
    });

    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

// Keyboard handlers
window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z') {
        state.undo();
        return;
    }

    const selected = state.selectedCell();
    if (selected) {
        let [r, c] = selected.split('-').map(Number);
        if (e.key === 'ArrowUp') r = Math.max(0, r - 1);
        else if (e.key === 'ArrowDown') r = Math.min(state.TOTAL_ROWS - 1, r + 1);
        else if (e.key === 'ArrowLeft') c = Math.max(0, c - 1);
        else if (e.key === 'ArrowRight') c = Math.min(state.TOTAL_COLS - 1, c + 1);

        if (`${r}-${c}` !== selected) {
            state.selectedCell.set(`${r}-${c}`);

            // Auto-scroll if selection goes out of viewport
            const targetScrollTop = r * ROW_HEIGHT;
            const targetScrollLeft = c * COL_WIDTH;
            const container = document.querySelector('.grid-container') as HTMLElement;
            if (container) {
                if (targetScrollTop < container.scrollTop) container.scrollTop = targetScrollTop;
                if (targetScrollTop + ROW_HEIGHT > container.scrollTop + container.clientHeight) container.scrollTop = targetScrollTop - container.clientHeight + ROW_HEIGHT;
                if (targetScrollLeft < container.scrollLeft) container.scrollLeft = targetScrollLeft;
                if (targetScrollLeft + COL_WIDTH > container.scrollLeft + container.clientWidth) container.scrollLeft = targetScrollLeft - container.clientWidth + COL_WIDTH;
            }
        }
    }
});

// Snapshots for undo
setInterval(() => {
    state.pushUndo();
}, 5000);

// Global state for template access (workaround for destructuring)
(window as any).state = state;
(window as any).domNodes = () => document.querySelectorAll('*').length;

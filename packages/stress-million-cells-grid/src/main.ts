import { batch } from '@dominator/core';
import './style.css';
import {
    gridData,
    setCellValue,
    getCellKey,
    viewport,
    ROWS,
    COLS,
    fps,
    avgRenderMs,
    batchSize,
    memoryDelta,
    liveDomNodes,
    totalSignalUpdates,
    updatePerfMetrics,
    incrementSignalUpdates,
    selectedCell,
} from './state.js';
import { updateViewport, virtualScrollRoot } from './utils/virtual-scroll.js';

const MIN_UPDATES = 1000;
const MAX_UPDATES = 3000;

let updateCount = 0;
let lastMemoryCheck = performance.now();
let initialMemory = 0;

const initMemory = () => {
    if (performance.memory) {
        initialMemory = performance.memory.usedJSHeapSize;
    }
};

const doRandomUpdates = () => {
    const count = MIN_UPDATES + Math.floor(Math.random() * (MAX_UPDATES - MIN_UPDATES));
    const changes: Array<{ row: number; col: number; value: number }> = [];
    
    for (let i = 0; i < count; i++) {
        const row = Math.floor(Math.random() * ROWS);
        const col = Math.floor(Math.random() * COLS);
        const value = Math.floor(Math.random() * 101);
        changes.push({ row, col, value });
    }
    
    const startMs = performance.now();
    
    batch(() => {
        for (const { row, col, value } of changes) {
            setCellValue(row, col, value);
        }
    });
    
    const renderMs = performance.now() - startMs;
    updatePerfMetrics(renderMs, count);
    incrementSignalUpdates(count);
    updateCount += count;
    
    if (performance.memory && performance.now() - lastMemoryCheck > 5000) {
        const currentMemory = performance.memory.usedJSHeapSize;
        if (initialMemory === 0) initMemory();
        lastMemoryCheck = performance.now();
    }
};

const updateLiveDomCount = () => {
    const root = document.querySelector('.million-cells-app');
    if (root) {
        const count = root.querySelectorAll('*').length;
        liveDomNodes.set(count);
    }
};

const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        return;
    }
    
    const sel = selectedCell();
    if (!sel) return;
    
    if (e.key === 'ArrowUp' && sel.row > 0) {
        selectedCell.set({ row: sel.row - 1, col: sel.col });
    } else if (e.key === 'ArrowDown' && sel.row < ROWS - 1) {
        selectedCell.set({ row: sel.row + 1, col: sel.col });
    } else if (e.key === 'ArrowLeft' && sel.col > 0) {
        selectedCell.set({ row: sel.row, col: sel.col - 1 });
    } else if (e.key === 'ArrowRight' && sel.col < COLS - 1) {
        selectedCell.set({ row: sel.row, col: sel.col + 1 });
    }
};

let rafId: number | null = null;
let isRunning = true;

const rafLoop = () => {
    if (!isRunning) return;
    
    doRandomUpdates();
    updateLiveDomCount();
    
    rafId = requestAnimationFrame(rafLoop);
};

const startApp = () => {
    const appContainer = document.getElementById('app');
    if (!appContainer) return;
    
    const gridEl = document.createElement('div');
    gridEl.className = 'grid-placeholder';
    gridEl.innerHTML = `
        <div class="loading">Loading Dominator Million Cells Grid...</div>
    `;
    appContainer.appendChild(gridEl);
    
    setTimeout(() => {
        const vp = viewport();
        console.log(`Initial viewport: ${vp.endRow - vp.startRow} rows x ${vp.endCol - vp.startCol} cols`);
        
        const container = virtualScrollRoot();
        if (container) {
            updateViewport(container);
        }
        
        rafLoop();
        
        document.addEventListener('keydown', handleKeyDown);
        
        setInterval(() => {
            const root = virtualScrollRoot();
            if (root) {
                updateViewport(root);
            }
        }, 100);
    }, 100);
};

startApp();

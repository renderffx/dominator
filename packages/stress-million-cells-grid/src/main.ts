import { batch, signal } from '@dominator/core';
import './style.css';
import {
    gridData,
    setCellValue,
    getCellKey,
    viewport,
    ROWS,
    COLS,
    TOTAL_CELLS,
    fps,
    avgRenderMs,
    batchSize,
    memoryDelta,
    liveDomNodes,
    totalSignalUpdates,
    updatePerfMetrics,
    incrementSignalUpdates,
    selectedCell,
    undoStack,
    pushUndo,
    performUndo,
    highValueCount,
    visibleRows,
    visibleCols,
    CELL_WIDTH,
    CELL_HEIGHT,
} from './state.js';
import { updateViewport, virtualScrollRoot } from './utils/virtual-scroll.js';

const MIN_UPDATES = 1000;
const MAX_UPDATES = 3000;

let lastMemoryCheck = performance.now();
let initialMemory = 0;

const initMemory = () => {
    if (performance.memory) {
        initialMemory = performance.memory.usedJSHeapSize;
    }
};

const doRandomUpdates = () => {
    const count = MIN_UPDATES + Math.floor(Math.random() * (MAX_UPDATES - MIN_UPDATES));
    const changes: Array<{ key: string; prevValue: number | undefined; newValue: number }> = [];
    
    for (let i = 0; i < count; i++) {
        const row = Math.floor(Math.random() * ROWS);
        const col = Math.floor(Math.random() * COLS);
        const value = Math.floor(Math.random() * 101);
        const key = getCellKey(row, col);
        const prevValue = gridData().get(key);
        changes.push({ key, prevValue, newValue: value });
    }
    
    const startMs = performance.now();
    
    batch(() => {
        for (const { key, newValue } of changes) {
            const [rowStr, colStr] = key.split('-');
            const row = parseInt(rowStr, 10);
            const col = parseInt(colStr, 10);
            setCellValue(row, col, newValue);
        }
        
        pushUndo({
            changes: changes.map(c => ({
                key: c.key,
                prevValue: c.prevValue,
                newValue: c.newValue
            }))
        });
    });
    
    const renderMs = performance.now() - startMs;
    updatePerfMetrics(renderMs, count);
    incrementSignalUpdates(count);
    
    if (performance.memory && performance.now() - lastMemoryCheck > 5000) {
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
        performUndo();
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

let viewportSpacer: HTMLElement;
let currentRenderedRows: number[] = [];
let currentRenderedCols: number[] = [];
let lastUpdate = 0;

const renderApp = () => {
    const app = document.getElementById('app');
    if (!app) return;
    
    app.innerHTML = `
        <header class="header">
            <h1>Million Cells Grid</h1>
            <div class="perf-overlay">
                <div class="perf-item">
                    <span class="perf-label">FPS</span>
                    <span class="perf-value" id="perf-fps">0</span>
                </div>
                <div class="perf-item">
                    <span class="perf-label">Render</span>
                    <span class="perf-value" id="perf-render">0ms</span>
                </div>
                <div class="perf-item">
                    <span class="perf-label">Batch</span>
                    <span class="perf-value" id="perf-batch">0</span>
                </div>
                <div class="perf-item">
                    <span class="perf-label">DOM</span>
                    <span class="perf-value" id="perf-dom">0</span>
                </div>
                <div class="perf-item">
                    <span class="perf-label">Memory</span>
                    <span class="perf-value" id="perf-memory">0MB</span>
                </div>
                <div class="perf-item">
                    <span class="perf-label">Updates</span>
                    <span class="perf-value" id="perf-updates">0</span>
                </div>
            </div>
            <div class="header-actions">
                <button id="undo-btn" disabled>Undo</button>
            </div>
        </header>
        
        <main class="grid-main">
            <div class="grid-scroll" id="grid-scroll" style="width: ${COLS * CELL_WIDTH}px; height: ${ROWS * CELL_HEIGHT}px; overflow: auto;">
                <div class="viewport-spacer" id="viewport-spacer"></div>
            </div>
            
            <aside class="sidebar">
                <section class="stats-section">
                    <h3>Grid Stats</h3>
                    <div class="stat-row">
                        <span>Total Cells:</span>
                        <strong>${TOTAL_CELLS.toLocaleString()}</strong>
                    </div>
                    <div class="stat-row">
                        <span>Non-Empty:</span>
                        <strong id="stat-nonempty">0</strong>
                    </div>
                    <div class="stat-row">
                        <span>High Value (80+):</span>
                        <strong id="stat-high">0</strong>
                    </div>
                </section>
                
                <section class="stats-section">
                    <h3>Viewport</h3>
                    <div class="stat-row">
                        <span>Visible Rows:</span>
                        <strong id="vp-rows">0</strong>
                    </div>
                    <div class="stat-row">
                        <span>Visible Cols:</span>
                        <strong id="vp-cols">0</strong>
                    </div>
                    <div class="stat-row">
                        <span>VNodes:</span>
                        <strong id="vp-vnodes">0</strong>
                    </div>
                </section>
                
                <section class="stats-section" id="selected-section" style="display: none;">
                    <h3>Selected Cell</h3>
                    <div class="stat-row">
                        <span>Row:</span>
                        <strong id="sel-row">-</strong>
                    </div>
                    <div class="stat-row">
                        <span>Col:</span>
                        <strong id="sel-col">-</strong>
                    </div>
                    <div class="stat-row">
                        <span>Value:</span>
                        <strong id="sel-value">-</strong>
                    </div>
                    <button class="action-btn" id="randomize-btn">Randomize</button>
                    <button class="action-btn" id="clear-btn">Clear</button>
                </section>
                
                <section class="controls-section">
                    <h3>Controls</h3>
                    <p class="hint">Arrow keys to navigate cells</p>
                    <p class="hint">Click to select</p>
                    <p class="hint">Ctrl+Z to undo</p>
                    <p class="hint">Updates: RAF batch (1000-3000/frame)</p>
                </section>
            </aside>
        </main>
    `;
    
    const gridScroll = document.getElementById('grid-scroll')!;
    viewportSpacer = document.getElementById('viewport-spacer')!;
    
    virtualScrollRoot.set(gridScroll);
    
    const renderViewport = () => {
        const vp = viewport();
        const rows = visibleRows();
        const cols = visibleCols();
        
        if (rows.length === currentRenderedRows.length && cols.length === currentRenderedCols.length &&
            rows[0] === currentRenderedRows[0] && cols[0] === currentRenderedCols[0]) {
            return;
        }
        
        currentRenderedRows = [...rows];
        currentRenderedCols = [...cols];
        
        viewportSpacer.innerHTML = '';
        
        const startRow = rows[0] ?? 0;
        const startCol = cols[0] ?? 0;
        
        viewportSpacer.style.width = `${cols.length * CELL_WIDTH}px`;
        viewportSpacer.style.height = `${rows.length * CELL_HEIGHT}px`;
        viewportSpacer.style.transform = `translate(${startCol * CELL_WIDTH}px, ${startRow * CELL_HEIGHT}px)`;
        
        const grid = gridData();
        
        for (const row of rows) {
            const rowEl = document.createElement('div');
            rowEl.className = 'grid-row';
            rowEl.style.display = 'flex';
            
            for (const col of cols) {
                const key = getCellKey(row, col);
                const value = grid.get(key) ?? 0;
                
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = String(row);
                cell.dataset.col = String(col);
                cell.style.width = `${CELL_WIDTH}px`;
                cell.style.height = `${CELL_HEIGHT}px`;
                
                renderCellContent(cell, value);
                
                cell.onclick = () => {
                    selectedCell.set({ row, col });
                };
                
                rowEl.appendChild(cell);
            }
            
            viewportSpacer.appendChild(rowEl);
        }
        
        updateStats();
    };
    
    const renderCellContent = (cell: HTMLElement, value: number) => {
        cell.style.backgroundColor = '';
        cell.innerHTML = '';
        
        if (value >= 80) {
            cell.className = 'cell high';
            cell.style.backgroundColor = '#ef4444';
            cell.innerHTML = '<span class="cell-icon">&#9733;</span>';
        } else if (value >= 50) {
            cell.className = 'cell medium';
            cell.style.backgroundColor = '#f97316';
            cell.innerHTML = `<div class="heat-bar" style="width: ${value}%"></div>`;
        } else if (value >= 20) {
            cell.className = 'cell low';
            cell.style.backgroundColor = '#6b7280';
            cell.innerHTML = `<span class="cell-value">${value}</span>`;
        } else if (value > 0) {
            cell.className = 'cell none';
            cell.style.backgroundColor = '#1e293b';
            cell.innerHTML = `<div class="mini-bar" style="width: ${value * 2}%"></div>`;
        } else {
            cell.className = 'cell';
            cell.style.backgroundColor = '#1e293b';
        }
    };
    
    const updateCellValue = (row: number, col: number) => {
        const key = getCellKey(row, col);
        const value = gridData().get(key) ?? 0;
        
        const cell = viewportSpacer.querySelector(`[data-row="${row}"][data-col="${col}"]`) as HTMLElement;
        if (!cell) return;
        
        renderCellContent(cell, value);
        
        const sel = selectedCell();
        if (sel && sel.row === row && sel.col === col) {
            cell.classList.add('selected');
        }
    };
    
    const updateSelection = () => {
        const sel = selectedCell();
        const section = document.getElementById('selected-section');
        
        document.querySelectorAll('.cell.selected').forEach(c => c.classList.remove('selected'));
        
        if (sel) {
            section!.style.display = 'block';
            const rowEl = document.getElementById('sel-row');
            const colEl = document.getElementById('sel-col');
            const valEl = document.getElementById('sel-value');
            if (rowEl) rowEl.textContent = String(sel.row);
            if (colEl) colEl.textContent = String(sel.col);
            if (valEl) valEl.textContent = String(gridData().get(getCellKey(sel.row, sel.col)) ?? 0);
            
            const cell = viewportSpacer.querySelector(`[data-row="${sel.row}"][data-col="${sel.col}"]`) as HTMLElement;
            if (cell) cell.classList.add('selected');
        } else if (section) {
            section.style.display = 'none';
        }
    };
    
    const updateStats = () => {
        const nonempty = document.getElementById('stat-nonempty');
        const high = document.getElementById('stat-high');
        const vpRowsEl = document.getElementById('vp-rows');
        const vpColsEl = document.getElementById('vp-cols');
        const vpVnodesEl = document.getElementById('vp-vnodes');
        
        if (nonempty) nonempty.textContent = gridData().size.toLocaleString();
        if (high) high.textContent = String(highValueCount());
        
        const vp = viewport();
        if (vpRowsEl) vpRowsEl.textContent = String(vp.endRow - vp.startRow);
        if (vpColsEl) vpColsEl.textContent = String(vp.endCol - vp.startCol);
        if (vpVnodesEl) vpVnodesEl.textContent = String((vp.endRow - vp.startRow) * (vp.endCol - vp.startCol));
    };
    
    const updatePerf = () => {
        const fpsEl = document.getElementById('perf-fps');
        const renderEl = document.getElementById('perf-render');
        const batchEl = document.getElementById('perf-batch');
        const domEl = document.getElementById('perf-dom');
        const memEl = document.getElementById('perf-memory');
        const updEl = document.getElementById('perf-updates');
        
        if (fpsEl) {
            fpsEl.textContent = String(fps());
            fpsEl.className = `perf-value ${fps() >= 55 ? 'good' : fps() >= 30 ? 'warn' : 'bad'}`;
        }
        if (renderEl) {
            renderEl.textContent = `${avgRenderMs().toFixed(1)}ms`;
            renderEl.className = `perf-value ${avgRenderMs() <= 12 ? 'good' : avgRenderMs() <= 20 ? 'warn' : 'bad'}`;
        }
        if (batchEl) batchEl.textContent = String(batchSize());
        if (domEl) domEl.textContent = String(liveDomNodes());
        if (memEl) memEl.textContent = `${memoryDelta()}MB`;
        if (updEl) updEl.textContent = totalSignalUpdates().toLocaleString();
    };
    
    const update = () => {
        const now = performance.now();
        if (now - lastUpdate < 16) return;
        lastUpdate = now;
        
        const rows = visibleRows();
        const cols = visibleCols();
        
        for (const row of rows) {
            for (const col of cols) {
                updateCellValue(row, col);
            }
        }
        
        updateStats();
        updateSelection();
        updatePerf();
        
        const undoBtnEl = document.getElementById('undo-btn') as HTMLButtonElement;
        if (undoBtnEl) undoBtnEl.disabled = undoStack().length === 0;
    };
    
    const onScroll = () => {
        updateViewport(gridScroll);
        renderViewport();
    };
    
    gridScroll.addEventListener('scroll', onScroll, { passive: true });
    
    const undoBtnEl = document.getElementById('undo-btn');
    if (undoBtnEl) {
        undoBtnEl.onclick = () => performUndo();
    }
    
    const randBtn = document.getElementById('randomize-btn');
    if (randBtn) {
        randBtn.onclick = () => {
            const sel = selectedCell();
            if (sel) setCellValue(sel.row, sel.col, Math.floor(Math.random() * 100));
        };
    }
    
    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) {
        clearBtn.onclick = () => {
            const sel = selectedCell();
            if (sel) setCellValue(sel.row, sel.col, 0);
        };
    }
    
    setTimeout(() => {
        updateViewport(gridScroll);
        renderViewport();
    }, 100);
    
    setInterval(update, 100);
};

document.addEventListener('DOMContentLoaded', () => {
    renderApp();
    
    const rafLoop = () => {
        doRandomUpdates();
        updateLiveDomCount();
        requestAnimationFrame(rafLoop);
    };
    
    rafLoop();
    document.addEventListener('keydown', handleKeyDown);
    
    setInterval(() => {
        const root = virtualScrollRoot();
        if (root) {
            updateViewport(root);
        }
    }, 500);
});

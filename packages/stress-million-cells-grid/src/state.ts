import { signal, computed, batch } from '@dominator/core';

export const ROWS = 1000;
export const COLS = 1000;
export const TOTAL_CELLS = ROWS * COLS;

export const OVERSCAN = 25;

export interface CellData {
    row: number;
    col: number;
    value: number;
}

export const gridData = signal<Map<string, number>>(new Map());

export const getCellKey = (row: number, col: number): string => `${row}-${col}`;

export const getCellValue = (row: number, col: number): number => {
    const key = getCellKey(row, col);
    return gridData().get(key) ?? 0;
};

export const setCellValue = (row: number, col: number, value: number) => {
    const key = getCellKey(row, col);
    const newGrid = new Map(gridData());
    if (value === 0) {
        newGrid.delete(key);
    } else {
        newGrid.set(key, Math.min(100, Math.max(0, value)));
    }
    gridData.set(newGrid);
};

export interface ViewportState {
    startRow: number;
    endRow: number;
    startCol: number;
    endCol: number;
}

export const viewport = signal<ViewportState>({
    startRow: 0,
    endRow: 50,
    startCol: 0,
    endCol: 50,
});

export const containerSize = signal<{ width: number; height: number }>({
    width: 800,
    height: 600,
});

export const scrollPos = signal<{ x: number; y: number }>({ x: 0, y: 0 });

export const CELL_WIDTH = 60;
export const CELL_HEIGHT = 32;

export const visibleRows = computed(() => {
    const vp = viewport();
    const rows: number[] = [];
    for (let r = vp.startRow; r < vp.endRow; r++) {
        rows.push(r);
    }
    return rows;
});

export const visibleCols = computed(() => {
    const vp = viewport();
    const cols: number[] = [];
    for (let c = vp.startCol; c < vp.endCol; c++) {
        cols.push(c);
    }
    return cols;
});

export const rowSums = computed(() => {
    const grid = gridData();
    const sums: Map<number, number> = new Map();
    grid.forEach((value: number, key: string) => {
        const [rowStr] = key.split('-');
        const row = parseInt(rowStr, 10);
        sums.set(row, (sums.get(row) ?? 0) + value);
    });
    return sums;
});

export const colAverages = computed(() => {
    const grid = gridData();
    const sums: Map<number, number> = new Map();
    const counts: Map<number, number> = new Map();
    grid.forEach((value: number, key: string) => {
        const [, colStr] = key.split('-');
        const col = parseInt(colStr, 10);
        sums.set(col, (sums.get(col) ?? 0) + value);
        counts.set(col, (counts.get(col) ?? 0) + 1);
    });
    const averages: Map<number, number> = new Map();
    sums.forEach((sum: number, col: number) => {
        averages.set(col, Math.round(sum / (counts.get(col) ?? 1)));
    });
    return averages;
});

export const highValueCount = computed(() => {
    let count = 0;
    gridData().forEach((v: number) => { if (v >= 80) count++; });
    return count;
});

export const selectedCell = signal<{ row: number; col: number } | null>(null);

export const selectionMode = signal<'cell' | 'none'>('cell');

export interface UndoEntry {
    changes: Array<{ key: string; prevValue: number | undefined; newValue: number | undefined }>;
}

const MAX_UNDO = 20;

export const undoStack = signal<UndoEntry[]>([]);

export const pushUndo = (entry: UndoEntry) => {
    const stack = undoStack();
    const newStack = [...stack, entry];
    if (newStack.length > MAX_UNDO) {
        newStack.shift();
    }
    undoStack.set(newStack);
};

export const performUndo = () => {
    const stack = undoStack();
    if (stack.length === 0) return;
    
    const entry = stack[stack.length - 1];
    batch(() => {
        entry.changes.forEach((change: UndoEntry['changes'][0]) => {
            const newGrid = new Map(gridData());
            if (change.prevValue === undefined) {
                newGrid.delete(change.key);
            } else {
                newGrid.set(change.key, change.prevValue);
            }
            gridData.set(newGrid);
        });
    });
    undoStack.set(stack.slice(0, -1));
};

export const fps = signal(0);
export const avgRenderMs = signal(0);
export const batchSize = signal(0);
export const memoryDelta = signal(0);
export const liveDomNodes = signal(0);
export const totalSignalUpdates = signal(0);

let frameCount = 0;
let lastFpsUpdate = performance.now();

interface PerfMemory {
    usedJSHeapSize: number;
}

declare global {
    interface Performance {
        memory?: PerfMemory;
    }
}

export const updatePerfMetrics = (renderMs: number, batchSz: number) => {
    const now = performance.now();
    frameCount++;
    
    if (now - lastFpsUpdate >= 1000) {
        fps.set(frameCount);
        frameCount = 0;
        lastFpsUpdate = now;
    }
    
    avgRenderMs.set(renderMs);
    batchSize.set(batchSz);
    
    if (performance.memory) {
        memoryDelta.set(Math.round((performance.memory.usedJSHeapSize / 1048576) * 10) / 10);
    }
};

export const incrementSignalUpdates = (count: number) => {
    totalSignalUpdates.update((n: number) => n + count);
};

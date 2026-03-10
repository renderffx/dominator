import { signal, computed, Signal } from '@dominator/core';

export const TOTAL_ROWS = 1000;
export const TOTAL_COLS = 1000;
export const MAX_UNDO = 20;

// Sparse data: Map<`${row}-${col}`, value>
export const gridData = signal<Map<string, number>>(new Map());

// Viewport signals
export const viewport = {
    rowStart: signal(0),
    rowEnd: signal(80),
    colStart: signal(0),
    colEnd: signal(60),
};

// Selection
export const selectedCell = signal<string | null>(null);

// Undo stack
export const undoStack = signal<Map<string, number>[]>([]);

// Perf tracking
export const perf = {
    frameTimes: signal<number[]>([]),
    lastUpdateBatchSize: signal(0),
    fps: signal(0),
    avgRenderTime: signal(0),
};

// Computeds
export const visibleRows = computed(() => {
    const rows = [];
    const start = viewport.rowStart();
    const end = viewport.rowEnd();
    for (let i = start; i <= end && i < TOTAL_ROWS; i++) {
        rows.push({ id: i });
    }
    return rows;
});

export const visibleCols = computed(() => {
    const cols = [];
    const start = viewport.colStart();
    const end = viewport.colEnd();
    for (let i = start; i <= end && i < TOTAL_COLS; i++) {
        cols.push({ id: i });
    }
    return cols;
});

// Aggregate stats for visible cells
export const stats = computed(() => {
    const data = gridData();
    const rStart = viewport.rowStart();
    const rEnd = viewport.rowEnd();
    const cStart = viewport.colStart();
    const cEnd = viewport.colEnd();

    let sum = 0;
    let count = 0;
    let thresholdCount = 0;

    for (let r = rStart; r <= rEnd; r++) {
        for (let c = cStart; c <= cEnd; c++) {
            const val = data.get(`${r}-${c}`) || 0;
            sum += val;
            count++;
            if (val >= 80) thresholdCount++;
        }
    }

    return {
        avg: count > 0 ? (sum / count).toFixed(2) : 0,
        total: sum,
        highValues: thresholdCount
    };
});

// Helper functions for cell rendering
export function getCellValue(row: number, col: number) {
    const val = gridData().get(`${row}-${col}`);
    return val === undefined ? '' : val;
}

export function getCellBg(row: number, col: number) {
    const val = gridData().get(`${row}-${col}`) || 0;
    return `hsl(0, 0%, ${val}%)`;
}

export function getCellClass(row: number, col: number) {
    const val = gridData().get(`${row}-${col}`) || 0;
    let cls = '';
    if (val >= 80) cls += 'cell-high cell-glow ';
    if (val >= 50) cls += 'cell-mid ';
    if (val >= 20) cls += 'cell-low ';
    return cls.trim();
}

// Actions
export function pushUndo() {
    const current = new Map(gridData());
    undoStack.update(stack => {
        const next = [current, ...stack];
        if (next.length > MAX_UNDO) next.pop();
        return next;
    });
}

export function undo() {
    const stack = undoStack();
    if (stack.length > 0) {
        const prev = stack[0];
        gridData.set(prev);
        undoStack.set(stack.slice(1));
    }
}

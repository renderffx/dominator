import { batch, signal } from '@dominator/core';
import { 
    viewport, 
    scrollPos, 
    containerSize, 
    CELL_WIDTH, 
    CELL_HEIGHT,
    OVERSCAN,
    ROWS,
    COLS
} from '../state.js';

export const virtualScrollRoot = signal<HTMLElement | null>(null);

export const updateViewport = (container: HTMLElement) => {
    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;
    const clientWidth = container.clientWidth;
    const clientHeight = container.clientHeight;

    const totalWidth = COLS * CELL_WIDTH;
    const totalHeight = ROWS * CELL_HEIGHT;

    const startCol = Math.max(0, Math.floor(scrollLeft / CELL_WIDTH) - OVERSCAN);
    const startRow = Math.max(0, Math.floor(scrollTop / CELL_HEIGHT) - OVERSCAN);
    const endCol = Math.min(COLS, Math.ceil((scrollLeft + clientWidth) / CELL_WIDTH) + OVERSCAN);
    const endRow = Math.min(ROWS, Math.ceil((scrollTop + clientHeight) / CELL_HEIGHT) + OVERSCAN);

    batch(() => {
        scrollPos.set({ x: scrollLeft, y: scrollTop });
        containerSize.set({ width: clientWidth, height: clientHeight });
        viewport.set({
            startRow,
            endRow,
            startCol,
            endCol,
        });
    });
};

export const scrollToCell = (row: number, col: number, container: HTMLElement) => {
    const targetX = col * CELL_WIDTH;
    const targetY = row * CELL_HEIGHT;
    container.scrollTo({
        left: targetX - container.clientWidth / 2,
        top: targetY - container.clientHeight / 2,
        behavior: 'smooth',
    });
};

export const getVisibleCellCount = (): number => {
    const vp = viewport();
    return (vp.endRow - vp.startRow) * (vp.endCol - vp.startCol);
};

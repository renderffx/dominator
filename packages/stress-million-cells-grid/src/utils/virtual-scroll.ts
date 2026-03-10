import { viewport, TOTAL_ROWS, TOTAL_COLS } from '../state';
import { batch } from '@dominator/core';

export const ROW_HEIGHT = 24;
export const COL_WIDTH = 80;
const OVERSCAN_X = 5;
const OVERSCAN_Y = 10;

export function updateViewport(
    scrollTop: number,
    scrollLeft: number,
    containerHeight: number,
    containerWidth: number
) {
    const rowStart = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_Y);
    const rowEnd = Math.min(
        TOTAL_ROWS - 1,
        Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN_Y
    );

    const colStart = Math.max(0, Math.floor(scrollLeft / COL_WIDTH) - OVERSCAN_X);
    const colEnd = Math.min(
        TOTAL_COLS - 1,
        Math.ceil((scrollLeft + containerWidth) / COL_WIDTH) + OVERSCAN_X
    );

    batch(() => {
        if (viewport.rowStart() !== rowStart) viewport.rowStart.set(rowStart);
        if (viewport.rowEnd() !== rowEnd) viewport.rowEnd.set(rowEnd);
        if (viewport.colStart() !== colStart) viewport.colStart.set(colStart);
        if (viewport.colEnd() !== colEnd) viewport.colEnd.set(colEnd);
    });
}

export function throttle<T extends (...args: any[]) => any>(fn: T, ms: number): T {
    let last = 0;
    return ((...args: any[]) => {
        const now = performance.now();
        if (now - last >= ms) {
            fn(...args);
            last = now;
        }
    }) as T;
}

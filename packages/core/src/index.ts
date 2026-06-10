export * from './vnode.ts';
export * from './mount.ts';
export * from './patch.ts';
export * from './batch.ts';
export * from './events.ts';
export * from './pool.ts';
export * from './signal.ts';
export * from './reconcile.ts';
export * from './router.ts';
export * from './ssr.ts';

export interface DominatorApp<T> {

    state: T;
    render: (state: T) => void;
}

export const createApp = <T>(initialState: T, renderFn: (state: T) => void): DominatorApp<T> => {
    return {
        state: initialState,
        render: renderFn
    };
};

import { DependencyList, useCallback, useEffect, useRef, useState } from 'react';

type ServiceState<T> = {
    data: T | null;
    loading: boolean;
    refreshing: boolean;
    error: string | null;
};

export function useServiceRequest<T>(
    factory: () => Promise<T>,
    deps: DependencyList = []
) {
    const request = useCallback(factory, deps);
    const requestIdRef = useRef(0);
    const mountedRef = useRef(true);
    const [state, setState] = useState<ServiceState<T>>({
        data: null,
        loading: true,
        refreshing: false,
        error: null,
    });

    useEffect(() => {
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const execute = useCallback(
        async (isRefresh = false) => {
            const requestId = ++requestIdRef.current;

            setState(prev => ({
                ...prev,
                loading: !isRefresh && !prev.data,
                refreshing: isRefresh,
                error: null,
            }));

            try {
                const result = await request();

                if (!mountedRef.current || requestId !== requestIdRef.current) {
                    return;
                }

                setState(prev => ({
                    ...prev,
                    data: result,
                    loading: false,
                    refreshing: false,
                    error: null,
                }));
            } catch (error) {
                if (!mountedRef.current || requestId !== requestIdRef.current) {
                    return;
                }

                const message =
                    error instanceof Error ? error.message : 'Something went wrong';
                setState(prev => ({
                    ...prev,
                    loading: false,
                    refreshing: false,
                    error: message,
                }));
            }
        },
        [request]
    );

    useEffect(() => {
        execute(false);
    }, [execute]);

    return {
        data: state.data,
        loading: state.loading,
        refreshing: state.refreshing,
        error: state.error,
        reload: () => execute(false),
        refresh: () => execute(true),
    };
}

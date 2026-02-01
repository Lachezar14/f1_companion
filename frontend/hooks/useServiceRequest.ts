import { DependencyList, useCallback, useEffect, useState } from 'react';

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
    const [state, setState] = useState<ServiceState<T>>({
        data: null,
        loading: true,
        refreshing: false,
        error: null,
    });

    const execute = useCallback(
        async (isRefresh = false) => {
            setState(prev => ({
                ...prev,
                loading: !isRefresh,
                refreshing: isRefresh,
                error: null,
            }));

            try {
                const result = await request();
                setState({
                    data: result,
                    loading: false,
                    refreshing: false,
                    error: null,
                });
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : 'Something went wrong';
                setState({
                    data: null,
                    loading: false,
                    refreshing: false,
                    error: message,
                });
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

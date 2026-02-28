/**
 * Reactive State Management
 * Simple pub/sub pattern for vanilla TypeScript
 * No dependencies, client-side only
 */
type Listener<T> = (value: T) => void;
type Unsubscribe = () => void;
/**
 * Application state interface
 */
interface AppState {
    globe: {
        initialized: boolean;
        activeLayers: Set<string>;
        viewState: {
            longitude: number;
            latitude: number;
            zoom: number;
            pitch: number;
            bearing: number;
        };
    };
    loading: {
        news: boolean;
        markets: boolean;
        osint: boolean;
        intelligence: boolean;
    };
    selected: {
        country: string | null;
        event: string | null;
        asset: string | null;
    };
    panels: {
        news: boolean;
        insights: boolean;
        instability: boolean;
        risk: boolean;
        markets: boolean;
        signals: boolean;
        portfolio: boolean;
    };
    trading: {
        enabled: boolean;
        balance: number;
        dailyPnL: number;
        positions: number;
    };
    connections: {
        relay: 'disconnected' | 'connecting' | 'connected' | 'error';
        ais: boolean;
        opensky: boolean;
    };
}
/**
 * Global application store
 */
declare class Store {
    private observables;
    constructor(initialState: AppState);
    /**
     * Get an observable by key
     */
    get<K extends keyof AppState>(key: K): AppState[K];
    /**
     * Set a value by key
     */
    set<K extends keyof AppState>(key: K, value: AppState[K]): void;
    /**
     * Update a value by key using a function
     */
    update<K extends keyof AppState>(key: K, updater: (current: AppState[K]) => AppState[K]): void;
    /**
     * Subscribe to changes on a specific key
     */
    subscribe<K extends keyof AppState>(key: K, listener: Listener<AppState[K]>): Unsubscribe;
    /**
     * Get entire state snapshot (for debugging)
     */
    getState(): AppState;
}
/**
 * Initialize the global store
 */
export declare function initState(): Store;
/**
 * Get the global store instance
 */
export declare function getStore(): Store;
export type { AppState, Store, Unsubscribe };
//# sourceMappingURL=state.d.ts.map
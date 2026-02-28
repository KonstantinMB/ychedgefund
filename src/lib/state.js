/**
 * Reactive State Management
 * Simple pub/sub pattern for vanilla TypeScript
 * No dependencies, client-side only
 */
/**
 * Observable value that notifies listeners on change
 */
class Observable {
    constructor(initialValue) {
        this.listeners = new Set();
        this.value = initialValue;
    }
    /**
     * Get current value
     */
    get() {
        return this.value;
    }
    /**
     * Set new value and notify all listeners
     */
    set(newValue) {
        if (this.value !== newValue) {
            this.value = newValue;
            this.notify();
        }
    }
    /**
     * Update value using a function
     */
    update(updater) {
        this.set(updater(this.value));
    }
    /**
     * Subscribe to value changes
     */
    subscribe(listener) {
        this.listeners.add(listener);
        // Immediately call listener with current value
        listener(this.value);
        // Return unsubscribe function
        return () => {
            this.listeners.delete(listener);
        };
    }
    /**
     * Notify all listeners of current value
     */
    notify() {
        this.listeners.forEach(listener => listener(this.value));
    }
}
/**
 * Global application store
 */
class Store {
    constructor(initialState) {
        this.observables = new Map();
        // Create observables for each top-level state key
        Object.entries(initialState).forEach(([key, value]) => {
            this.observables.set(key, new Observable(value));
        });
    }
    /**
     * Get an observable by key
     */
    get(key) {
        const observable = this.observables.get(key);
        if (!observable) {
            throw new Error(`Observable '${String(key)}' not found in store`);
        }
        return observable.get();
    }
    /**
     * Set a value by key
     */
    set(key, value) {
        const observable = this.observables.get(key);
        if (!observable) {
            throw new Error(`Observable '${String(key)}' not found in store`);
        }
        observable.set(value);
    }
    /**
     * Update a value by key using a function
     */
    update(key, updater) {
        const observable = this.observables.get(key);
        if (!observable) {
            throw new Error(`Observable '${String(key)}' not found in store`);
        }
        observable.update(updater);
    }
    /**
     * Subscribe to changes on a specific key
     */
    subscribe(key, listener) {
        const observable = this.observables.get(key);
        if (!observable) {
            throw new Error(`Observable '${String(key)}' not found in store`);
        }
        return observable.subscribe(listener);
    }
    /**
     * Get entire state snapshot (for debugging)
     */
    getState() {
        const state = {};
        this.observables.forEach((observable, key) => {
            state[key] = observable.get();
        });
        return state;
    }
}
// Initial state
const initialState = {
    globe: {
        initialized: false,
        activeLayers: new Set(['military-bases', 'conflict-zones']),
        viewState: {
            longitude: 0,
            latitude: 20,
            zoom: 1.5,
            pitch: 0,
            bearing: 0,
        },
    },
    loading: {
        news: false,
        markets: false,
        osint: false,
        intelligence: false,
    },
    selected: {
        country: null,
        event: null,
        asset: null,
    },
    panels: {
        news: true,
        insights: true,
        instability: true,
        risk: true,
        markets: true,
        signals: false,
        portfolio: false,
    },
    trading: {
        enabled: false,
        balance: 1000000,
        dailyPnL: 0,
        positions: 0,
    },
    connections: {
        relay: 'disconnected',
        ais: false,
        opensky: false,
    },
};
// Global store instance
let store;
/**
 * Initialize the global store
 */
export function initState() {
    if (!store) {
        store = new Store(initialState);
        // Persist certain state to localStorage
        if (typeof window !== 'undefined') {
            // Load persisted state
            const persisted = localStorage.getItem('atlas-state');
            if (persisted) {
                try {
                    const parsed = JSON.parse(persisted);
                    if (parsed.panels) {
                        store.set('panels', parsed.panels);
                    }
                    if (parsed.globe?.activeLayers) {
                        store.update('globe', current => ({
                            ...current,
                            activeLayers: new Set(parsed.globe.activeLayers),
                        }));
                    }
                }
                catch (e) {
                    console.error('[State] Failed to parse persisted state:', e);
                }
            }
            // Persist on changes
            ['panels', 'globe'].forEach(key => {
                store.subscribe(key, () => {
                    const state = store.getState();
                    const toPersist = {
                        panels: state.panels,
                        globe: {
                            activeLayers: Array.from(state.globe.activeLayers),
                        },
                    };
                    localStorage.setItem('atlas-state', JSON.stringify(toPersist));
                });
            });
        }
    }
    return store;
}
/**
 * Get the global store instance
 */
export function getStore() {
    if (!store) {
        throw new Error('Store not initialized. Call initState() first.');
    }
    return store;
}
//# sourceMappingURL=state.js.map
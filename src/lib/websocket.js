/**
 * WebSocket Manager
 * Auto-reconnecting WebSocket client with event emitter pattern
 * For Railway relay connections (AIS, OpenSky, RSS streams)
 */
/**
 * Auto-reconnecting WebSocket manager
 */
export class WebSocketManager {
    constructor(config) {
        this.ws = null;
        this.listeners = new Map();
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.state = 'disconnected';
        this.intentionallyClosed = false;
        this.config = {
            reconnect: true,
            reconnectInterval: 3000,
            maxReconnectAttempts: 10,
            protocols: [],
            ...config,
        };
        // Initialize listener sets
        const events = [
            'open',
            'close',
            'error',
            'message',
            'reconnecting',
            'reconnected',
        ];
        events.forEach(event => {
            this.listeners.set(event, new Set());
        });
    }
    /**
     * Connect to WebSocket server
     */
    connect() {
        if (this.ws?.readyState === WebSocket.OPEN) {
            console.warn('[WebSocket] Already connected');
            return;
        }
        this.intentionallyClosed = false;
        this.setState('connecting');
        try {
            this.ws = new WebSocket(this.config.url, this.config.protocols);
            this.attachEventHandlers();
        }
        catch (error) {
            console.error('[WebSocket] Connection error:', error);
            this.setState('error');
            this.scheduleReconnect();
        }
    }
    /**
     * Disconnect from WebSocket server
     */
    disconnect() {
        this.intentionallyClosed = true;
        this.clearReconnectTimer();
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }
        this.setState('disconnected');
    }
    /**
     * Send data through WebSocket
     */
    send(data) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(data);
        }
        else {
            console.warn('[WebSocket] Cannot send - not connected');
        }
    }
    /**
     * Subscribe to WebSocket events
     */
    on(event, handler) {
        const handlers = this.listeners.get(event);
        if (handlers) {
            handlers.add(handler);
        }
        // Return unsubscribe function
        return () => {
            const handlers = this.listeners.get(event);
            if (handlers) {
                handlers.delete(handler);
            }
        };
    }
    /**
     * Unsubscribe from WebSocket events
     */
    off(event, handler) {
        const handlers = this.listeners.get(event);
        if (handlers) {
            handlers.delete(handler);
        }
    }
    /**
     * Get current connection state
     */
    getState() {
        return this.state;
    }
    /**
     * Get underlying WebSocket instance (for debugging)
     */
    getSocket() {
        return this.ws;
    }
    /**
     * Attach event handlers to WebSocket instance
     */
    attachEventHandlers() {
        if (!this.ws)
            return;
        this.ws.onopen = () => {
            console.log('[WebSocket] Connected to', this.config.url);
            this.reconnectAttempts = 0;
            this.setState('connected');
            const wasReconnecting = this.state === 'reconnecting';
            this.emit(wasReconnecting ? 'reconnected' : 'open');
        };
        this.ws.onclose = (event) => {
            console.log('[WebSocket] Disconnected:', event.code, event.reason);
            this.setState('disconnected');
            this.emit('close', event);
            if (!this.intentionallyClosed && this.config.reconnect) {
                this.scheduleReconnect();
            }
        };
        this.ws.onerror = (error) => {
            console.error('[WebSocket] Error:', error);
            this.setState('error');
            this.emit('error', error);
        };
        this.ws.onmessage = (event) => {
            try {
                // Try to parse JSON, fallback to raw data
                const data = typeof event.data === 'string'
                    ? JSON.parse(event.data)
                    : event.data;
                this.emit('message', data);
            }
            catch (e) {
                // If not JSON, pass raw data
                this.emit('message', event.data);
            }
        };
    }
    /**
     * Schedule reconnection attempt
     */
    scheduleReconnect() {
        if (!this.config.reconnect)
            return;
        if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            console.error('[WebSocket] Max reconnect attempts reached');
            this.setState('error');
            return;
        }
        this.clearReconnectTimer();
        this.setState('reconnecting');
        this.reconnectAttempts++;
        console.log(`[WebSocket] Reconnecting in ${this.config.reconnectInterval}ms (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);
        this.emit('reconnecting', {
            attempt: this.reconnectAttempts,
            maxAttempts: this.config.maxReconnectAttempts,
        });
        this.reconnectTimer = window.setTimeout(() => {
            this.connect();
        }, this.config.reconnectInterval);
    }
    /**
     * Clear reconnection timer
     */
    clearReconnectTimer() {
        if (this.reconnectTimer !== null) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
    /**
     * Set connection state
     */
    setState(state) {
        this.state = state;
    }
    /**
     * Emit event to all listeners
     */
    emit(event, data) {
        const handlers = this.listeners.get(event);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data);
                }
                catch (error) {
                    console.error(`[WebSocket] Error in ${event} handler:`, error);
                }
            });
        }
    }
}
/**
 * Create a WebSocket manager for the Railway relay
 */
export function createRelayConnection(url) {
    return new WebSocketManager({
        url,
        reconnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 20,
    });
}
//# sourceMappingURL=websocket.js.map
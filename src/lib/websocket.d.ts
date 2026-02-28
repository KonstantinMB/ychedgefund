/**
 * WebSocket Manager
 * Auto-reconnecting WebSocket client with event emitter pattern
 * For Railway relay connections (AIS, OpenSky, RSS streams)
 */
type WebSocketEvent = 'open' | 'close' | 'error' | 'message' | 'reconnecting' | 'reconnected';
type EventHandler = (data?: any) => void;
interface WebSocketConfig {
    url: string;
    reconnect?: boolean;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
    protocols?: string | string[];
}
/**
 * Connection state
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
/**
 * Auto-reconnecting WebSocket manager
 */
export declare class WebSocketManager {
    private ws;
    private config;
    private listeners;
    private reconnectAttempts;
    private reconnectTimer;
    private state;
    private intentionallyClosed;
    constructor(config: WebSocketConfig);
    /**
     * Connect to WebSocket server
     */
    connect(): void;
    /**
     * Disconnect from WebSocket server
     */
    disconnect(): void;
    /**
     * Send data through WebSocket
     */
    send(data: string | ArrayBuffer | Blob): void;
    /**
     * Subscribe to WebSocket events
     */
    on(event: WebSocketEvent, handler: EventHandler): () => void;
    /**
     * Unsubscribe from WebSocket events
     */
    off(event: WebSocketEvent, handler: EventHandler): void;
    /**
     * Get current connection state
     */
    getState(): ConnectionState;
    /**
     * Get underlying WebSocket instance (for debugging)
     */
    getSocket(): WebSocket | null;
    /**
     * Attach event handlers to WebSocket instance
     */
    private attachEventHandlers;
    /**
     * Schedule reconnection attempt
     */
    private scheduleReconnect;
    /**
     * Clear reconnection timer
     */
    private clearReconnectTimer;
    /**
     * Set connection state
     */
    private setState;
    /**
     * Emit event to all listeners
     */
    private emit;
}
/**
 * Create a WebSocket manager for the Railway relay
 */
export declare function createRelayConnection(url: string): WebSocketManager;
export {};
//# sourceMappingURL=websocket.d.ts.map
import WebSocket from 'ws';

/**
 * Room management for multiple clients
 */
class RoomManager {
    constructor() {
        this.rooms = new Map(); // roomId => Set<WebSocket>
        this.clients = new Map(); // ws => clientInfo
    }

    /**
     * Join a room
     */
    join(roomId, ws, clientInfo = {}) {
        // Create room if doesn't exist
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new Set());
        }

        // Add client to room
        this.rooms.get(roomId).add(ws);
        
        // Store client info
        this.clients.set(ws, {
            ...clientInfo,
            roomId: roomId,
            joinedAt: new Date(),
            lastActivity: new Date()
        });

        console.log(`[Room] Client joined room: ${roomId}`);
        return this.rooms.get(roomId).size;
    }

    /**
     * Leave a room
     */
    leave(roomId, ws) {
        const room = this.rooms.get(roomId);
        if (room) {
            room.delete(ws);
            
            // Remove empty rooms
            if (room.size === 0) {
                this.rooms.delete(roomId);
            }
        }
        
        this.clients.delete(ws);
        console.log(`[Room] Client left room: ${roomId}`);
    }

    /**
     * Broadcast to all clients in a room
     */
    broadcast(roomId, data, excludeWs = null) {
        const room = this.rooms.get(roomId);
        if (!room) return 0;

        let sent = 0;
        const message = typeof data === 'string' ? data : JSON.stringify(data);
        
        room.forEach(ws => {
            if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
                ws.send(message);
                sent++;
                
                // Update activity
                const clientInfo = this.clients.get(ws);
                if (clientInfo) {
                    clientInfo.lastActivity = new Date();
                }
            }
        });

        return sent;
    }

    /**
     * Broadcast binary data to room
     */
    broadcastBinary(roomId, data, excludeWs = null) {
        const room = this.rooms.get(roomId);
        if (!room) return 0;

        let sent = 0;
        room.forEach(ws => {
            if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
                ws.send(data);
                sent++;
            }
        });

        return sent;
    }

    /**
     * Get room info
     */
    getRoomInfo(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return null;

        const clients = Array.from(room).map(ws => {
            const info = this.clients.get(ws);
            return {
                id: info?.id || 'unknown',
                type: info?.type || 'unknown',
                joinedAt: info?.joinedAt,
                lastActivity: info?.lastActivity
            };
        });

        return {
            roomId,
            clientCount: room.size,
            clients
        };
    }

    /**
     * List all rooms
     */
    listRooms() {
        const rooms = [];
        this.rooms.forEach((clientSet, roomId) => {
            rooms.push({
                roomId,
                clientCount: clientSet.size,
                lastActivity: this.getLastActivity(roomId)
            });
        });
        return rooms;
    }

    /**
     * Get last activity in room
     */
    getLastActivity(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return null;

        let lastActivity = new Date(0);
        room.forEach(ws => {
            const info = this.clients.get(ws);
            if (info && info.lastActivity > lastActivity) {
                lastActivity = info.lastActivity;
            }
        });

        return lastActivity;
    }

    /**
     * Cleanup inactive clients
     */
    cleanup(maxIdleMinutes = 10) {
        const cutoff = new Date(Date.now() - maxIdleMinutes * 60 * 1000);
        const toRemove = [];

        this.clients.forEach((info, ws) => {
            if (info.lastActivity < cutoff) {
                toRemove.push({ ws, roomId: info.roomId });
            }
        });

        toRemove.forEach(({ ws, roomId }) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close(1000, 'Inactive');
            }
            this.leave(roomId, ws);
        });

        console.log(`[Room] Cleaned up ${toRemove.length} inactive clients`);
        return toRemove.length;
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            totalRooms: this.rooms.size,
            totalClients: this.clients.size,
            rooms: this.listRooms()
        };
    }
}

export default RoomManager;
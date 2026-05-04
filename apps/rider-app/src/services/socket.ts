import { io, Socket } from 'socket.io-client';
import { storage } from '../utils/storage';

const SOCKET_URL = __DEV__ ? 'https://hey-auto-server-production.up.railway.app' : 'https://hey-auto-server-production.up.railway.app';

class SocketService {
  private socket: Socket | null = null;

  connect() {
    const token = storage.getString('accessToken');
    if (!token || this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.log('[Socket] Connection error:', err.message);
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  on<T = any>(event: string, callback: (data: T) => void) {
    this.socket?.on(event, callback);
  }

  off(event: string) {
    this.socket?.off(event);
  }

  emit(event: string, data?: any) {
    this.socket?.emit(event, data);
  }

  requestNearbyDrivers(lat: number, lng: number) {
    this.emit('rider:nearby_drivers', { lat, lng });
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();

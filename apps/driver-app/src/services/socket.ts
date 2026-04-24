import { io, Socket } from 'socket.io-client';
import { storage } from '../utils/storage';

const SOCKET_URL = __DEV__ ? 'http://192.168.1.3:3000' : 'https://api.heyauto.in';

class SocketService {
  private socket: Socket | null = null;
  private locationInterval: ReturnType<typeof setInterval> | null = null;

  connect() {
    const token = storage.getString('accessToken');
    if (!token || this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      console.log('[Driver Socket] Connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Driver Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.log('[Driver Socket] Error:', err.message);
    });
  }

  disconnect() {
    this.stopLocationUpdates();
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

  updateLocation(lat: number, lng: number) {
    this.emit('driver:location_update', { lat, lng });
  }

  startLocationUpdates(getLocation: () => { lat: number; lng: number } | null) {
    this.stopLocationUpdates();
    this.locationInterval = setInterval(() => {
      const loc = getLocation();
      if (loc) this.updateLocation(loc.lat, loc.lng);
    }, 5000);
  }

  stopLocationUpdates() {
    if (this.locationInterval) {
      clearInterval(this.locationInterval);
      this.locationInterval = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();

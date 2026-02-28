import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents, AuthResponse, ActionResponse } from '@booty-bounties/shared';
import type { GameState, GameAction } from '@booty-bounties/shared';

type BBSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export class SocketService {
  private static instance: SocketService;
  private socket!: BBSocket;
  private connected = false;

  private constructor() {
    this.connect();
  }

  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  private connect(): void {
    this.socket = io(window.location.origin, {
      transports: ['websocket'],
      autoConnect: true,
    }) as BBSocket;

    this.socket.on('connect', () => {
      this.connected = true;
      console.log('[Socket] Connected:', this.socket.id);
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      console.warn('[Socket] Disconnected');
    });

    this.socket.on('server:error', (msg) => {
      console.error('[Socket] Server error:', msg);
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  auth(pirateName: string, password: string, cb: (res: AuthResponse) => void): void {
    this.socket.emit('auth:login', { pirateName, password }, cb);
  }

  register(pirateName: string, password: string, cb: (res: AuthResponse) => void): void {
    // Registration uses the same event; server creates account if it doesn't exist
    this.socket.emit('auth:login', { pirateName, password }, cb);
  }

  createGame(cb: (res: { success: boolean; gameId?: string; error?: string }) => void): void {
    this.socket.emit('game:create', cb);
  }

  joinGame(gameId: string, cb: (res: { success: boolean; gameId?: string; state?: GameState; error?: string }) => void): void {
    this.socket.emit('game:join', { gameId }, cb);
  }

  ready(): void {
    this.socket.emit('game:ready');
  }

  sendAction(action: GameAction, cb: (res: ActionResponse) => void): void {
    this.socket.emit('game:action', action, cb);
  }

  requestState(cb: (state: GameState) => void): void {
    this.socket.emit('game:requestState', cb);
  }

  on<K extends keyof ServerToClientEvents>(
    event: K,
    listener: ServerToClientEvents[K],
  ): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.socket as any).on(event, listener);
  }

  off<K extends keyof ServerToClientEvents>(event: K): void {
    (this.socket as any).off(event);
  }
}

import type { GameState, GameAction, Player } from './GameTypes';

// ─── Client → Server ─────────────────────────────────────────────────────────
export interface ClientToServerEvents {
  /** Authenticate / join a game */
  'auth:login': (payload: { pirateName: string; password: string }, cb: (res: AuthResponse) => void) => void;
  /** Create a new game lobby */
  'game:create': (cb: (res: CreateGameResponse) => void) => void;
  /** Join an existing game lobby */
  'game:join': (payload: { gameId: string }, cb: (res: JoinGameResponse) => void) => void;
  /** Player is ready to start */
  'game:ready': () => void;
  /** Submit an action */
  'game:action': (action: GameAction, cb: (res: ActionResponse) => void) => void;
  /** Request full game state (reconnect) */
  'game:requestState': (cb: (state: GameState) => void) => void;
}

// ─── Server → Client ─────────────────────────────────────────────────────────
export interface ServerToClientEvents {
  /** Full state sync (on connect/reconnect) */
  'game:stateSync': (state: GameState) => void;
  /** Incremental state patch */
  'game:statePatch': (patch: Partial<GameState>) => void;
  /** A player performed an action */
  'game:actionResult': (result: ActionResult) => void;
  /** Turn advanced */
  'game:turnAdvanced': (turn: number) => void;
  /** A player connected / disconnected */
  'game:playerConnected': (player: Pick<Player, 'id' | 'pirateName'>) => void;
  'game:playerDisconnected': (playerId: string) => void;
  /** Game over */
  'game:over': (winnerId: string, finalState: GameState) => void;
  /** Server error */
  'server:error': (message: string) => void;
}

// ─── Response Types ───────────────────────────────────────────────────────────
export interface AuthResponse {
  success: boolean;
  playerId?: string;
  pirateName?: string;
  error?: string;
}

export interface CreateGameResponse {
  success: boolean;
  gameId?: string;
  error?: string;
}

export interface JoinGameResponse {
  success: boolean;
  gameId?: string;
  state?: GameState;
  error?: string;
}

export interface ActionResponse {
  success: boolean;
  error?: string;
  apRemaining?: number;
}

export interface ActionResult {
  playerId: string;
  action: GameAction;
  success: boolean;
  statePatch: Partial<GameState>;
}

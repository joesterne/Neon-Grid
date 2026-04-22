export enum Direction {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT'
}

export interface Point {
  x: number;
  y: number;
}

export interface Player {
  uid: string;
  name: string;
  color: string;
  pos: Point;
  dir: Direction;
  trail: Point[];
  isAlive: boolean;
  score: number;
}

export interface Obstacle {
  type: 'wall' | 'destructible';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PowerUp {
  id: string;
  type: 'speed' | 'invulnerable' | 'trail-breaker';
  pos: Point;
  active: boolean;
}

export interface GameRoom {
  id: string;
  status: 'waiting' | 'playing' | 'finished';
  players: Record<string, Player>;
  arenaId: string;
  obstacles?: Obstacle[];
  powerUps: PowerUp[];
  createdAt: number;
  winner?: string;
  timeLeft?: number;
}

export interface State {
  roomId: string | null;
  user: any;
  room: GameRoom | null;
  mode: 'menu' | 'lobby' | 'game' | 'editor' | 'story' | 'leaderboard';
}

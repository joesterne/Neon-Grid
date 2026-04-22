import { Direction } from './types';

export const GRID_SIZE = 20;
export const CANVAS_SIZE = 800;
export const TICK_RATE = 100; // ms

export const COLORS = {
  CYAN: '#00f2ff',
  MAGENTA: '#ff00f2',
  YELLOW: '#fff200',
  GREEN: '#00ff41',
  RED: '#ff2d00',
  GRID: '#1a1a1a',
  BG: '#000000'
};

export const INITIAL_POSITIONS = [
  { x: 5, y: 5, dir: Direction.RIGHT },
  { x: 35, y: 35, dir: Direction.LEFT },
  { x: 35, y: 5, dir: Direction.DOWN },
  { x: 5, y: 35, dir: Direction.UP }
];

export const NEON_GLOW = {
  shadowColor: 'white',
  shadowBlur: 10,
  shadowOffset: { x: 0, y: 0 },
  shadowOpacity: 0.8
};

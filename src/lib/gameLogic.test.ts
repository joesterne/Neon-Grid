import { describe, it, expect } from 'vitest';
import { Direction } from '../types';
import { 
  getNextPosition, 
  isOutOfBounds, 
  checkCollision, 
  isValidDirectionChange 
} from './gameLogic';

describe('GameLogic Regression Suite', () => {
  describe('Movement Logic', () => {
    it('calculates the correct next position for all directions', () => {
      const center = { x: 20, y: 20 };
      expect(getNextPosition(center, Direction.UP)).toEqual({ x: 20, y: 19 });
      expect(getNextPosition(center, Direction.DOWN)).toEqual({ x: 20, y: 21 });
      expect(getNextPosition(center, Direction.LEFT)).toEqual({ x: 19, y: 20 });
      expect(getNextPosition(center, Direction.RIGHT)).toEqual({ x: 21, y: 20 });
    });

    it('prevents invalid 180-degree turns', () => {
      expect(isValidDirectionChange(Direction.UP, Direction.DOWN)).toBe(false);
      expect(isValidDirectionChange(Direction.LEFT, Direction.RIGHT)).toBe(false);
      expect(isValidDirectionChange(Direction.UP, Direction.LEFT)).toBe(true);
    });
  });

  describe('Collision System', () => {
    it('detects boundary breaches', () => {
      expect(isOutOfBounds({ x: -1, y: 10 })).toBe(true);
      expect(isOutOfBounds({ x: 40, y: 10 })).toBe(true);
      expect(isOutOfBounds({ x: 20, y: 20 })).toBe(false);
    });

    it('detects trail collisions', () => {
      const trail = [{ x: 10, y: 10 }, { x: 10, y: 11 }];
      const nextPos = { x: 10, y: 10 };
      const result = checkCollision(nextPos, trail, []);
      expect(result.collision).toBe(true);
    });

    it('detects wall collisions', () => {
      const obstacles = [{ type: 'wall' as const, x: 15, y: 15, width: 1, height: 1 }];
      const nextPos = { x: 15, y: 15 };
      const result = checkCollision(nextPos, [], obstacles);
      expect(result.collision).toBe(true);
      expect(result.hitObstacleIndex).toBe(0);
    });

    it('allows passthrough but registers hit for destructible tiles', () => {
      const obstacles = [{ type: 'destructible' as const, x: 15, y: 15, width: 1, height: 1 }];
      const nextPos = { x: 15, y: 15 };
      const result = checkCollision(nextPos, [], obstacles);
      expect(result.collision).toBe(false);
      expect(result.hitObstacleIndex).toBe(0);
    });
  });
});

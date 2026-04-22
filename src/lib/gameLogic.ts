import { Direction, Point, Player, Obstacle } from '../types';

export const ARENA_GRID_SIZE = 40;

export interface TickResult {
  nextPos: Point;
  collision: boolean;
  hitObstacleIndex: number;
}

export function getNextPosition(pos: Point, dir: Direction): Point {
  const next = { ...pos };
  switch (dir) {
    case Direction.UP: next.y -= 1; break;
    case Direction.DOWN: next.y += 1; break;
    case Direction.LEFT: next.x -= 1; break;
    case Direction.RIGHT: next.x += 1; break;
  }
  return next;
}

export function isOutOfBounds(pos: Point): boolean {
  return pos.x < 0 || pos.x >= ARENA_GRID_SIZE || pos.y < 0 || pos.y >= ARENA_GRID_SIZE;
}

export function checkCollision(
  nextPos: Point, 
  trail: Point[], 
  obstacles: Obstacle[]
): { collision: boolean; hitObstacleIndex: number } {
  // Boundary
  if (isOutOfBounds(nextPos)) {
    return { collision: true, hitObstacleIndex: -1 };
  }

  // Trail
  if (trail.some(t => t.x === nextPos.x && t.y === nextPos.y)) {
    return { collision: true, hitObstacleIndex: -1 };
  }

  // Obstacles
  const hitIdx = obstacles.findIndex(o => o.x === nextPos.x && o.y === nextPos.y);
  if (hitIdx !== -1) {
    const obstacle = obstacles[hitIdx];
    if (obstacle.type === 'wall') {
      return { collision: true, hitObstacleIndex: hitIdx };
    }
    // Destructible allows passing through but registers a hit
    return { collision: false, hitObstacleIndex: hitIdx };
  }

  return { collision: false, hitObstacleIndex: -1 };
}

export function isValidDirectionChange(currentDir: Direction, nextDir: Direction): boolean {
  if (currentDir === Direction.UP && nextDir === Direction.DOWN) return false;
  if (currentDir === Direction.DOWN && nextDir === Direction.UP) return false;
  if (currentDir === Direction.LEFT && nextDir === Direction.RIGHT) return false;
  if (currentDir === Direction.RIGHT && nextDir === Direction.LEFT) return false;
  return true;
}

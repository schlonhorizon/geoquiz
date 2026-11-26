import type { Bounds } from './viewport';

const cellSize = 48;

export function createCountryHitIndex() {
  const cells = new Map<string, { id: string; path: Path2D }[]>();
  return {
    add(id: string, path: Path2D, [[left, top], [right, bottom]]: Bounds) {
      for (let column = Math.floor(left / cellSize); column <= Math.floor(right / cellSize); column++) {
        for (let row = Math.floor(top / cellSize); row <= Math.floor(bottom / cellSize); row++) {
          const key = `${column}:${row}`;
          const cell = cells.get(key);
          if (cell) cell.push({ id, path });
          else cells.set(key, [{ id, path }]);
        }
      }
    },
    hit(context: CanvasRenderingContext2D, x: number, y: number) {
      const entries = cells.get(`${Math.floor(x / cellSize)}:${Math.floor(y / cellSize)}`) ?? [];
      for (let index = entries.length - 1; index >= 0; index--) {
        if (context.isPointInPath(entries[index].path, x, y)) return entries[index].id;
      }
    },
  };
}

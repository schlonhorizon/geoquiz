export function damerauLevenshtein(left: readonly string[], right: readonly string[]): number {
  const limit = left.length + right.length;
  const distance = Array.from({ length: left.length + 2 }, () => Array<number>(right.length + 2).fill(0));
  for (let row = 0; row <= left.length; row++) {
    distance[row + 1][0] = limit;
    distance[row + 1][1] = row;
  }
  for (let col = 0; col <= right.length; col++) {
    distance[0][col + 1] = limit;
    distance[1][col + 1] = col;
  }

  // Keep the last matching positions so a transposition may overlap other edits.
  const lastRows = new Map<string, number>();
  for (let row = 1; row <= left.length; row++) {
    let lastColumn = 0;
    for (let col = 1; col <= right.length; col++) {
      const previousRow = lastRows.get(right[col - 1]) ?? 0;
      const previousColumn = lastColumn;
      const cost = left[row - 1] === right[col - 1] ? 0 : 1;
      if (cost === 0) lastColumn = col;

      distance[row + 1][col + 1] = Math.min(
        distance[row][col] + cost,
        distance[row + 1][col] + 1,
        distance[row][col + 1] + 1,
        distance[previousRow][previousColumn] + (row - previousRow - 1) + 1 + (col - previousColumn - 1),
      );
    }
    lastRows.set(left[row - 1], row);
  }
  return distance[left.length + 1][right.length + 1];
}

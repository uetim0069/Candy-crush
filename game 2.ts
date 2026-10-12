export const SIZE = 8;
export const KINDS = 5;
export const MOVES = 25;
export const GOAL = 2000;

export type Tile = {
  id: number;
  kind: number;
  row: number;
  col: number;
  clearing?: boolean;
};

export type Grid = (Tile | null)[][];
export type Pos = { row: number; col: number };

let nextId = 1;
const rand = (n: number) => Math.floor(Math.random() * n);

/** Lay tiles out in a SIZE x SIZE grid. Tiles outside the board (spawning) are ignored. */
export function toGrid(tiles: Tile[]): Grid {
  const grid: Grid = Array.from({ length: SIZE }, () =>
    Array<Tile | null>(SIZE).fill(null),
  );
  for (const t of tiles) {
    if (t.row >= 0 && t.row < SIZE && t.col >= 0 && t.col < SIZE) {
      grid[t.row][t.col] = t;
    }
  }
  return grid;
}

/** Every horizontal or vertical run of 3+ identical tiles. */
export function findMatches(grid: Grid): Tile[][] {
  const groups: Tile[][] = [];

  for (let r = 0; r < SIZE; r++) {
    let c = 0;
    while (c < SIZE) {
      const t = grid[r][c];
      if (!t) {
        c++;
        continue;
      }
      let e = c + 1;
      while (e < SIZE && grid[r][e]?.kind === t.kind) e++;
      if (e - c >= 3) groups.push(grid[r].slice(c, e) as Tile[]);
      c = e;
    }
  }

  for (let c = 0; c < SIZE; c++) {
    let r = 0;
    while (r < SIZE) {
      const t = grid[r][c];
      if (!t) {
        r++;
        continue;
      }
      let e = r + 1;
      while (e < SIZE && grid[e][c]?.kind === t.kind) e++;
      if (e - r >= 3) {
        const run: Tile[] = [];
        for (let i = r; i < e; i++) run.push(grid[i][c] as Tile);
        groups.push(run);
      }
      r = e;
    }
  }

  return groups;
}

function runAt(k: number[][], r: number, c: number): boolean {
  const kind = k[r][c];
  if (kind < 0) return false;

  let n = 1;
  for (let i = c - 1; i >= 0 && k[r][i] === kind; i--) n++;
  for (let i = c + 1; i < SIZE && k[r][i] === kind; i++) n++;
  if (n >= 3) return true;

  n = 1;
  for (let i = r - 1; i >= 0 && k[i][c] === kind; i--) n++;
  for (let i = r + 1; i < SIZE && k[i][c] === kind; i++) n++;
  return n >= 3;
}

function findMoveInKinds(k: number[][]): [Pos, Pos] | null {
  const dirs = [
    [0, 1],
    [1, 0],
  ];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      for (const [dr, dc] of dirs) {
        const r2 = r + dr;
        const c2 = c + dc;
        if (r2 >= SIZE || c2 >= SIZE) continue;
        [k[r][c], k[r2][c2]] = [k[r2][c2], k[r][c]];
        const ok = runAt(k, r, c) || runAt(k, r2, c2);
        [k[r][c], k[r2][c2]] = [k[r2][c2], k[r][c]];
        if (ok) return [{ row: r, col: c }, { row: r2, col: c2 }];
      }
    }
  }
  return null;
}

/** First swap that would produce a match, or null when the board is stuck. */
export function findMove(grid: Grid): [Pos, Pos] | null {
  return findMoveInKinds(grid.map((row) => row.map((t) => t?.kind ?? -1)));
}

/** A fresh board with no existing matches and at least one available move. */
export function generateBoard(): Tile[] {
  let kinds: number[][] = [];
  for (let attempt = 0; attempt < 100; attempt++) {
    kinds = [];
    for (let r = 0; r < SIZE; r++) {
      kinds[r] = [];
      for (let c = 0; c < SIZE; c++) {
        const banned = new Set<number>();
        if (c >= 2 && kinds[r][c - 1] === kinds[r][c - 2]) banned.add(kinds[r][c - 1]);
        if (r >= 2 && kinds[r - 1][c] === kinds[r - 2][c]) banned.add(kinds[r - 1][c]);
        const options = Array.from({ length: KINDS }, (_, i) => i).filter(
          (i) => !banned.has(i),
        );
        kinds[r][c] = options[rand(options.length)];
      }
    }
    if (findMoveInKinds(kinds)) break;
  }

  const tiles: Tile[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      tiles.push({ id: nextId++, kind: kinds[r][c], row: r, col: c });
    }
  }
  return tiles;
}

/** Exchange the positions of two tiles. */
export function swapTiles(tiles: Tile[], aId: number, bId: number): Tile[] {
  const a = tiles.find((t) => t.id === aId);
  const b = tiles.find((t) => t.id === bId);
  if (!a || !b) return tiles;
  return tiles.map((t) => {
    if (t.id === aId) return { ...t, row: b.row, col: b.col };
    if (t.id === bId) return { ...t, row: a.row, col: a.col };
    return t;
  });
}

/**
 * Apply gravity to the surviving tiles and fill the gaps with new ones.
 * `entering` holds the new tiles parked above the board, `final` holds
 * every tile at its resting position. Render `entering` first, then
 * `final` a frame later so the browser animates the drop.
 */
export function collapse(tiles: Tile[]): { final: Tile[]; entering: Tile[] } {
  const final: Tile[] = [];
  const entering: Tile[] = [];

  for (let c = 0; c < SIZE; c++) {
    const column = tiles.filter((t) => t.col === c).sort((a, b) => b.row - a.row);
    column.forEach((t, i) => final.push({ ...t, row: SIZE - 1 - i }));

    const missing = SIZE - column.length;
    for (let i = 0; i < missing; i++) {
      const id = nextId++;
      const kind = rand(KINDS);
      final.push({ id, kind, row: i, col: c });
      entering.push({ id, kind, row: i - missing, col: c });
    }
  }

  return { final, entering };
}

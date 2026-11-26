import {
  CAT_NAP_SEC,
  CAT_SLEEP_BREATH_SEC,
  CAT_WALK_SPEED_MUL,
  CAT_SIT_SEC,
  CAT_SPOT_SIT_SEC,
  CAT_ZOOM_SPEED_MUL,
  DEFAULT_MAX_CONTEXT_TOKENS,
  HELPER_FOLLOW_RADIUS_TILES,
  HELPER_STAND_UP_DELAY_SEC,
  SEAT_REST_MAX_SEC,
  SEAT_REST_MIN_SEC,
  SLEEPING_SEAT_TIMER_SEC,
  TYPE_FRAME_DURATION_SEC,
  WALK_FRAME_DURATION_SEC,
  WALK_SPEED_PX_PER_SEC,
  WANDER_MOVES_BEFORE_REST_MAX,
  WANDER_MOVES_BEFORE_REST_MIN,
  WANDER_PAUSE_MAX_SEC,
  WANDER_PAUSE_MIN_SEC,
} from '../../constants.js';
import { findPath } from '../layout/tileMap.js';
import type { CharacterSprites } from '../sprites/spriteData.js';
import { isReadingToolName } from '../toolUtils.js';
import type { Character, Seat, SpriteData, TileType as TileTypeVal } from '../types.js';
import { CharacterState, Direction, TILE_SIZE } from '../types.js';
import { startBlink } from './blink.js';
import {
  type CatSpot,
  catSitDir,
  chooseCatErrand,
  clearCatErrand,
  isCatBehaviour,
  pickCatSpot,
} from './catBehaviour.js';
import { catHeavyPace, tickCatShape } from './catHeavy.js';
import { tickMail } from './mail.js';

/** Whether a tool should show the reading animation (vs typing). Taxonomy comes
 *  from the active HookProvider via the `providerCapabilities` message. */
export function isReadingTool(tool: string | null): boolean {
  if (!tool) return false;
  return isReadingToolName(tool);
}

/** Pixel center of a tile */
function tileCenter(col: number, row: number): { x: number; y: number } {
  return {
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2,
  };
}

/** Direction from one tile to an adjacent tile */
function directionBetween(
  fromCol: number,
  fromRow: number,
  toCol: number,
  toRow: number,
): Direction {
  const dc = toCol - fromCol;
  const dr = toRow - fromRow;
  if (dc > 0) return Direction.RIGHT;
  if (dc < 0) return Direction.LEFT;
  if (dr > 0) return Direction.DOWN;
  return Direction.UP;
}

export function createCharacter(
  id: number,
  palette: number,
  seatId: string | null,
  seat: Seat | null,
  repeat = 0,
): Character {
  const col = seat ? seat.seatCol : 1;
  const row = seat ? seat.seatRow : 1;
  const center = tileCenter(col, row);
  return {
    id,
    state: CharacterState.TYPE,
    dir: seat ? seat.facingDir : Direction.DOWN,
    x: center.x,
    y: center.y,
    tileCol: col,
    tileRow: row,
    path: [],
    moveProgress: 0,
    currentTool: null,
    palette,
    repeat,
    frame: 0,
    frameTimer: 0,
    wanderTimer: 0,
    wanderCount: 0,
    wanderLimit: randomInt(WANDER_MOVES_BEFORE_REST_MIN, WANDER_MOVES_BEFORE_REST_MAX),
    isActive: true,
    seatId,
    bubbleType: null,
    bubbleTimer: 0,
    seatTimer: 0,
    isSubagent: false,
    helperIdleSec: 0,
    parentAgentId: null,
    matrixEffect: null,
    matrixEffectTimer: 0,
    matrixEffectSeeds: [],
    ...startBlink(),
    contextTokens: 0,
    maxContextTokens: DEFAULT_MAX_CONTEXT_TOKENS,
  };
}

/** What an idle cat can do in the Cat theme (catBehaviour.ts); null = people, no errands. */
export interface CatContext {
  spots: readonly CatSpot[];
  /** A spot another cat is at or heading for. */
  taken: (spot: CatSpot) => boolean;
}

export function updateCharacter(
  ch: Character,
  dt: number,
  walkableTiles: Array<{ col: number; row: number }>,
  seats: Map<string, Seat>,
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
  cat: CatContext | null = null,
): void {
  ch.frameTimer += dt;
  tickCatShape(ch, dt);
  tickMail(ch, dt);
  // Mail from someone in the office: go over and take it, then on as usual.
  if (ch.mailVisit && runMailVisit(ch, dt, tileMap, blockedTiles, cat !== null)) return;
  // Work, or the Office theme, ends any cat errand at once.
  if ((ch.isActive || !cat) && (ch.catSitSec || ch.catSpot || (ch.speedMul ?? 1) !== 1)) {
    clearCatErrand(ch);
  }

  switch (ch.state) {
    case CharacterState.TYPE: {
      // Asleep in bed: slow breaths (a cat's curled-up frames), else typing's pace.
      const frameSec = ch.inBed && !ch.isActive ? CAT_SLEEP_BREATH_SEC : TYPE_FRAME_DURATION_SEC;
      if (ch.frameTimer >= frameSec) {
        ch.frameTimer -= frameSec;
        ch.frame = (ch.frame + 1) % 2;
      }
      // If no longer active, stand up and start wandering (after seatTimer expires)
      if (!ch.isActive) {
        if (ch.seatTimer > 0) {
          ch.seatTimer -= dt;
          break;
        }
        ch.seatTimer = 0; // clear sentinel
        ch.state = CharacterState.IDLE;
        ch.frame = 0;
        ch.frameTimer = 0;
        ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC);
        ch.wanderCount = 0;
        ch.wanderLimit = randomInt(WANDER_MOVES_BEFORE_REST_MIN, WANDER_MOVES_BEFORE_REST_MAX);
      }
      break;
    }

    case CharacterState.IDLE: {
      // A cat sitting on the floor (by a toy, napping, or just sitting): tail swishes, then on.
      if (cat && !ch.isActive && (ch.catSitSec ?? 0) > 0) {
        ch.catSitSec = (ch.catSitSec ?? 0) - dt;
        // tail swishes while sitting; slow breaths while napping
        const frameSec = ch.catNap ? CAT_SLEEP_BREATH_SEC : TYPE_FRAME_DURATION_SEC;
        if (ch.frameTimer >= frameSec) {
          ch.frameTimer -= frameSec;
          ch.frame = (ch.frame + 1) % 2;
        }
        if (ch.catSitSec <= 0) {
          clearCatErrand(ch);
          ch.frame = 0;
          ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC) / 2;
        }
        break;
      }
      if (cat) {
        // A cat never stands frozen mid-step: between walks it sits, tail swishing.
        if (ch.frameTimer >= TYPE_FRAME_DURATION_SEC) {
          ch.frameTimer -= TYPE_FRAME_DURATION_SEC;
          ch.frame = (ch.frame + 1) % 2;
        }
      } else {
        // No idle animation — static pose
        ch.frame = 0;
      }
      if (ch.seatTimer < 0) ch.seatTimer = 0; // clear turn-end sentinel
      // If became active, pathfind to seat
      if (ch.isActive) {
        if (!ch.seatId) {
          // No seat assigned — type in place
          ch.state = CharacterState.TYPE;
          ch.frame = 0;
          ch.frameTimer = 0;
          break;
        }
        const seat = seats.get(ch.seatId);
        if (seat) {
          const path = findPath(
            ch.tileCol,
            ch.tileRow,
            seat.seatCol,
            seat.seatRow,
            tileMap,
            blockedTiles,
          );
          if (path.length > 0) {
            ch.path = path;
            ch.moveProgress = 0;
            ch.state = CharacterState.WALK;
            ch.frame = 0;
            ch.frameTimer = 0;
          } else {
            // Already at seat or no path — sit down
            ch.state = CharacterState.TYPE;
            ch.dir = seat.facingDir;
            ch.frame = 0;
            ch.frameTimer = 0;
          }
        }
        break;
      }
      // Countdown wander timer
      ch.wanderTimer -= dt;
      if (ch.wanderTimer <= 0) {
        // Check if we've wandered enough — return to seat for a rest
        if (ch.wanderCount >= ch.wanderLimit && ch.seatId) {
          const seat = seats.get(ch.seatId);
          if (seat) {
            const path = findPath(
              ch.tileCol,
              ch.tileRow,
              seat.seatCol,
              seat.seatRow,
              tileMap,
              blockedTiles,
            );
            if (path.length > 0) {
              ch.path = path;
              ch.moveProgress = 0;
              ch.state = CharacterState.WALK;
              ch.frame = 0;
              ch.frameTimer = 0;
              break;
            }
          }
        }
        if (cat && startCatErrand(ch, cat, walkableTiles, tileMap, blockedTiles)) {
          ch.wanderCount++;
          ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC);
          break;
        }
        if (walkableTiles.length > 0) {
          const target = walkableTiles[Math.floor(Math.random() * walkableTiles.length)];
          const path = findPath(
            ch.tileCol,
            ch.tileRow,
            target.col,
            target.row,
            tileMap,
            blockedTiles,
          );
          if (path.length > 0) {
            ch.path = path;
            ch.moveProgress = 0;
            ch.state = CharacterState.WALK;
            ch.frame = 0;
            ch.frameTimer = 0;
            ch.wanderCount++;
          }
        }
        ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC);
      }
      break;
    }

    case CharacterState.WALK: {
      // Walk animation (quicker steps on a dash, slower for a strolling cat)
      const pace = (ch.speedMul ?? 1) * (cat ? CAT_WALK_SPEED_MUL * catHeavyPace(ch) : 1);
      const frameSec = WALK_FRAME_DURATION_SEC / pace;
      if (ch.frameTimer >= frameSec) {
        ch.frameTimer -= frameSec;
        ch.frame = (ch.frame + 1) % 4;
      }

      if (ch.path.length === 0) {
        // Path complete — snap to tile center and transition
        const center = tileCenter(ch.tileCol, ch.tileRow);
        ch.x = center.x;
        ch.y = center.y;
        ch.speedMul = 1;

        // A cat arriving where it was going: sit there facing the thing
        const spot = ch.catSpot;
        if (cat && !ch.isActive && spot && spot.col === ch.tileCol && spot.row === ch.tileRow) {
          ch.catSpot = null;
          ch.state = CharacterState.IDLE;
          ch.dir = spot.dir;
          ch.catSitSec = randomRange(CAT_SPOT_SIT_SEC[0], CAT_SPOT_SIT_SEC[1]);
          ch.catNap = false;
          ch.frame = 0;
          ch.frameTimer = 0;
          break;
        }
        ch.catSpot = null;

        if (ch.isActive) {
          if (!ch.seatId) {
            // No seat — type in place
            ch.state = CharacterState.TYPE;
          } else {
            const seat = seats.get(ch.seatId);
            if (seat && ch.tileCol === seat.seatCol && ch.tileRow === seat.seatRow) {
              ch.state = CharacterState.TYPE;
              ch.dir = seat.facingDir;
            } else {
              ch.state = CharacterState.IDLE;
            }
          }
        } else {
          // Check if arrived at assigned seat — sit down for a rest before wandering again
          if (ch.seatId) {
            const seat = seats.get(ch.seatId);
            if (seat && ch.tileCol === seat.seatCol && ch.tileRow === seat.seatRow) {
              ch.state = CharacterState.TYPE;
              ch.dir = seat.facingDir;
              // seatTimer < 0 is a sentinel from setAgentActive(false) meaning
              // "turn just ended" — skip the long rest so idle transition is immediate
              if (ch.seatTimer < 0) {
                ch.seatTimer = 0;
              } else {
                restInChair(ch);
              }
              ch.wanderCount = 0;
              ch.wanderLimit = randomInt(
                WANDER_MOVES_BEFORE_REST_MIN,
                WANDER_MOVES_BEFORE_REST_MAX,
              );
              ch.frame = 0;
              ch.frameTimer = 0;
              break;
            }
          }
          ch.state = CharacterState.IDLE;
          ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC);
        }
        ch.frame = 0;
        ch.frameTimer = 0;
        break;
      }

      stepAlongPath(ch, dt, pace);

      // If became active while wandering, repath to seat
      if (ch.isActive && ch.seatId) {
        const seat = seats.get(ch.seatId);
        if (seat) {
          const lastStep = ch.path[ch.path.length - 1];
          if (!lastStep || lastStep.col !== seat.seatCol || lastStep.row !== seat.seatRow) {
            const newPath = findPath(
              ch.tileCol,
              ch.tileRow,
              seat.seatCol,
              seat.seatRow,
              tileMap,
              blockedTiles,
            );
            if (newPath.length > 0) {
              ch.path = newPath;
              ch.moveProgress = 0;
            }
          }
        }
      }
      break;
    }
  }
}

/**
 * One frame of a mail visit (mail.ts): walk to the tile beside the sender, stand
 * there facing it for the visit's wait, then hand back to the usual FSM (an
 * active agent then walks to its seat). True while the visit owns the frame;
 * false (and the visit dropped) when the tile can't be reached.
 */
function runMailVisit(
  ch: Character,
  dt: number,
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
  cat: boolean,
): boolean {
  const visit = ch.mailVisit;
  if (!visit) return false;
  if (visit.arrived) {
    ch.state = CharacterState.IDLE;
    ch.dir = visit.dir;
    if (cat && ch.frameTimer >= TYPE_FRAME_DURATION_SEC) {
      ch.frameTimer -= TYPE_FRAME_DURATION_SEC;
      ch.frame = (ch.frame + 1) % 2;
    }
    visit.waitSec -= dt;
    if (visit.waitSec <= 0) {
      ch.mailVisit = undefined;
      ch.frame = 0;
      ch.frameTimer = 0;
      ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC);
    }
    return true;
  }
  const at = ch.tileCol === visit.col && ch.tileRow === visit.row;
  if (at && ch.moveProgress === 0) {
    const center = tileCenter(ch.tileCol, ch.tileRow);
    ch.x = center.x;
    ch.y = center.y;
    ch.path = [];
    visit.arrived = true;
    ch.state = CharacterState.IDLE;
    ch.dir = visit.dir;
    ch.frame = 0;
    ch.frameTimer = 0;
    return true;
  }
  const last = ch.path[ch.path.length - 1];
  if (!last || last.col !== visit.col || last.row !== visit.row) {
    // Finish the step under way, then head for the sender from there.
    const from = ch.moveProgress > 0 && ch.path[0] ? ch.path[0] : null;
    const rest = findPath(
      from ? from.col : ch.tileCol,
      from ? from.row : ch.tileRow,
      visit.col,
      visit.row,
      tileMap,
      blockedTiles,
    );
    if (!at && rest.length === 0 && !(from && from.col === visit.col && from.row === visit.row)) {
      ch.mailVisit = undefined;
      return false;
    }
    ch.path = from ? [from, ...rest] : rest;
    if (!from) ch.moveProgress = 0;
  }
  clearCatErrand(ch);
  ch.state = CharacterState.WALK;
  const pace = cat ? CAT_WALK_SPEED_MUL * catHeavyPace(ch) : 1;
  const frameSec = WALK_FRAME_DURATION_SEC / pace;
  if (ch.frameTimer >= frameSec) {
    ch.frameTimer -= frameSec;
    ch.frame = (ch.frame + 1) % 4;
  }
  if (ch.path.length > 0) stepAlongPath(ch, dt, pace);
  return true;
}

/** Move along `ch.path` for one frame; on reaching a tile, make it the character's tile. */
function stepAlongPath(ch: Character, dt: number, pace = ch.speedMul ?? 1): void {
  const nextTile = ch.path[0];
  ch.dir = directionBetween(ch.tileCol, ch.tileRow, nextTile.col, nextTile.row);

  ch.moveProgress += ((WALK_SPEED_PX_PER_SEC * pace) / TILE_SIZE) * dt;

  const fromCenter = tileCenter(ch.tileCol, ch.tileRow);
  const toCenter = tileCenter(nextTile.col, nextTile.row);
  const t = Math.min(ch.moveProgress, 1);
  ch.x = fromCenter.x + (toCenter.x - fromCenter.x) * t;
  ch.y = fromCenter.y + (toCenter.y - fromCenter.y) * t;

  if (ch.moveProgress >= 1) {
    ch.tileCol = nextTile.col;
    ch.tileRow = nextTile.row;
    ch.x = toCenter.x;
    ch.y = toCenter.y;
    ch.path.shift();
    ch.moveProgress = 0;
  }
}

type Tile = { col: number; row: number };

/** Tiles between two tiles, counting diagonals as one step. */
function tileDistance(a: Tile, b: Tile): number {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}

/** Within range of home (the lead's seat), and not on home itself. */
function atHome(at: Tile, home: Tile): boolean {
  const d = tileDistance(at, home);
  return d > 0 && d <= HELPER_FOLLOW_RADIUS_TILES;
}

/**
 * A helper (sub-agent) for one frame. It has no chair and never wanders: it
 * stays around `home` — its lead's seat, or the lead itself when the lead has
 * no seat — walks back when home moves, and settles there facing the way its
 * lead does (`facing`): sitting while it works (in the air: there is no chair
 * under it), standing while it waits. `pickSpot` names a free tile near home.
 */
export function updateHelper(
  ch: Character,
  dt: number,
  home: Tile | null,
  facing: Direction | null,
  pickSpot: () => Tile | null,
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
): void {
  ch.frameTimer += dt;
  ch.helperIdleSec = ch.isActive ? 0 : ch.helperIdleSec + dt;

  if (ch.state === CharacterState.WALK && ch.path.length > 0) {
    if (ch.frameTimer >= WALK_FRAME_DURATION_SEC) {
      ch.frameTimer -= WALK_FRAME_DURATION_SEC;
      ch.frame = (ch.frame + 1) % 4;
    }
    stepAlongPath(ch, dt);
    const end = ch.path[ch.path.length - 1];
    // Mid-tile, or still headed home: keep walking. Otherwise (the path is
    // done, or home moved away from where it ends) decide again.
    if (ch.moveProgress > 0 || (end && (!home || atHome(end, home)))) return;
    ch.path = [];
  }

  if (home && !atHome({ col: ch.tileCol, row: ch.tileRow }, home)) {
    const spot = pickSpot();
    const path = spot
      ? findPath(ch.tileCol, ch.tileRow, spot.col, spot.row, tileMap, blockedTiles)
      : [];
    if (path.length > 0) {
      ch.path = path;
      ch.moveProgress = 0;
      if (ch.state !== CharacterState.WALK) {
        ch.state = CharacterState.WALK;
        ch.frame = 0;
        ch.frameTimer = 0;
      }
      return;
    }
    // No way to get closer: stay where we are.
  }

  if (ch.state === CharacterState.WALK || wantsState(ch) !== ch.state) {
    settle(ch, facing);
    return;
  }
  // Settled: turn with the lead (a reseated lead faces a new way).
  if (facing !== null) ch.dir = facing;
  if (ch.state === CharacterState.TYPE && ch.frameTimer >= TYPE_FRAME_DURATION_SEC) {
    ch.frameTimer -= TYPE_FRAME_DURATION_SEC;
    ch.frame = (ch.frame + 1) % 2;
  }
}

/** Sitting while working, standing while waiting. The gap between two tool
 *  calls is not waiting: standing up and sitting back down every few seconds
 *  swaps the seated sprite for the standing one and back, so a helper stands
 *  only once it has been idle for HELPER_STAND_UP_DELAY_SEC. */
function wantsState(ch: Character): CharacterState {
  const working = ch.isActive || ch.helperIdleSec < HELPER_STAND_UP_DELAY_SEC;
  return working ? CharacterState.TYPE : CharacterState.IDLE;
}

/** Stop on the current tile, facing the lead's way, in the pose the helper's work calls for. */
function settle(ch: Character, facing: Direction | null): void {
  const center = tileCenter(ch.tileCol, ch.tileRow);
  ch.x = center.x;
  ch.y = center.y;
  ch.path = [];
  ch.moveProgress = 0;
  if (facing !== null) ch.dir = facing;
  ch.state = wantsState(ch);
  ch.frame = 0;
  ch.frameTimer = 0;
}

/** Get the correct sprite frame for a character's current state and direction */
export function getCharacterSprite(ch: Character, sprites: CharacterSprites): SpriteData {
  switch (ch.state) {
    case CharacterState.TYPE:
      // Resting in its chair (a turn over, or back from wandering). Helpers have no
      // chair: they stand once idle, and keep typing through the gaps between tools.
      if (!ch.isActive && !ch.isSubagent) {
        // A cat asleep in bed curls up (people's sheets have no sleeping frames).
        if (ch.inBed && sprites.sleeping) return sprites.sleeping[ch.dir][ch.frame % 2];
        // A cat resting in its seat keeps its tail swishing: the seated frame and the
        // paws-down typing frame differ only by the tail.
        if (isCatBehaviour() && ch.frame % 2) return sprites.typing[ch.dir][1];
        return sprites.seated[ch.dir];
      }
      if (isReadingTool(ch.currentTool)) {
        return sprites.reading[ch.dir][ch.frame % 2];
      }
      return sprites.typing[ch.dir][ch.frame % 2];
    case CharacterState.WALK:
      return sprites.walk[ch.dir][ch.frame % 4];
    case CharacterState.IDLE:
      // A cat sitting on the floor: tail swishing, or still with its eyes shut (a nap)
      if ((ch.catSitSec ?? 0) > 0) {
        if (!ch.catNap) return sprites.typing[ch.dir][ch.frame % 2];
        return sprites.sleeping ? sprites.sleeping[ch.dir][ch.frame % 2] : sprites.seated[ch.dir];
      }
      // Any other pause in the Cat theme: sit facing front or back (never a frozen side step)
      if (isCatBehaviour()) return sprites.typing[catSitDir(ch.dir)][ch.frame % 2];
      return sprites.walk[ch.dir][1];
    default:
      return sprites.walk[ch.dir][1];
  }
}

/**
 * A cat's errand when a wander pause ends: go and sit by something, nap or
 * sit where it is, or dash somewhere. Returns false for an ordinary wander
 * (or when the errand has nowhere to go), so the caller wanders instead.
 */
function startCatErrand(
  ch: Character,
  cat: CatContext,
  walkableTiles: Array<{ col: number; row: number }>,
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
): boolean {
  const errand = chooseCatErrand();
  if (errand === 'nap' || errand === 'sit') {
    const [min, max] = errand === 'nap' ? CAT_NAP_SEC : CAT_SIT_SEC;
    ch.catSitSec = randomRange(min, max);
    ch.catNap = errand === 'nap';
    if (ch.catNap) ch.blinkShut = ch.catSitSec; // eyes shut for the whole nap
    // front or back only: the side-on sit is not used
    if (ch.dir === Direction.LEFT || ch.dir === Direction.RIGHT) ch.dir = Direction.DOWN;
    ch.frame = 0;
    ch.frameTimer = 0;
    return true;
  }
  let target: { col: number; row: number } | null = null;
  if (errand === 'spot') {
    target = pickCatSpot(ch, cat.spots, cat.taken);
  } else if (errand === 'zoom' && walkableTiles.length > 0) {
    target = walkableTiles[Math.floor(Math.random() * walkableTiles.length)];
  }
  if (!target) return false;
  const path = findPath(ch.tileCol, ch.tileRow, target.col, target.row, tileMap, blockedTiles);
  if (path.length === 0) return false;
  ch.path = path;
  ch.moveProgress = 0;
  ch.state = CharacterState.WALK;
  ch.frame = 0;
  ch.frameTimer = 0;
  if (errand === 'spot') ch.catSpot = target as CatSpot;
  if (errand === 'zoom') ch.speedMul = CAT_ZOOM_SPEED_MUL;
  return true;
}

/** Sit out a usual rest in the chair before standing up to wander. */
export function restInChair(ch: Character): void {
  // An agent in bed stays there until the server reports it working again.
  ch.seatTimer = ch.inBed
    ? SLEEPING_SEAT_TIMER_SEC
    : randomRange(SEAT_REST_MIN_SEC, SEAT_REST_MAX_SEC);
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

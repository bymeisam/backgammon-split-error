// Decoder for the GNU Backgammon Position ID format: a 14-character base64
// string encoding a 10-byte (80-bit) key. The key holds two 25-slot runs
// (one per player: 24 points from that player's own ace point, then the
// bar), each slot stored in unary — one "1" bit per checker on that slot,
// terminated by a single "0" bit — packed LSB-first into bytes, which are
// then base64-encoded. Borne-off checkers aren't stored explicitly; they're
// the remainder after subtracting the 25 decoded slots from 15 per side.

const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64ToBytes(input: string): Uint8Array {
  const clean = input.trim().replace(/=+$/, "");
  const bytes: number[] = [];
  let buffer = 0;
  let bitsInBuffer = 0;

  for (const ch of clean) {
    const value = BASE64_CHARS.indexOf(ch);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bitsInBuffer += 6;
    if (bitsInBuffer >= 8) {
      bitsInBuffer -= 8;
      bytes.push((buffer >> bitsInBuffer) & 0xff);
    }
  }

  return new Uint8Array(bytes);
}

export interface DecodedPosition {
  /** Index i = checkers on point i+1 (1-24), from the on-roll player's own perspective. */
  mine: number[];
  /** Same, for the opponent, expressed at the matching point number in the on-roll player's frame. */
  opponent: number[];
  mineBar: number;
  opponentBar: number;
  mineOff: number;
  opponentOff: number;
}

export function decodeGnuPositionId(id: string): DecodedPosition {
  const bytes = base64ToBytes(id);

  let bitIndex = 0;
  const readBit = (): number => {
    const byteIndex = bitIndex >> 3;
    const bitOffset = bitIndex & 7;
    bitIndex++;
    if (byteIndex >= bytes.length) return 0;
    return (bytes[byteIndex] >> bitOffset) & 1;
  };
  const readSlotCount = (): number => {
    let count = 0;
    while (readBit() === 1) count++;
    return count;
  };

  // board[player][0..23] = that player's own points 1-24, board[player][24] = bar
  const board: number[][] = [new Array(25).fill(0), new Array(25).fill(0)];
  for (let player = 0; player < 2; player++) {
    for (let slot = 0; slot < 25; slot++) {
      board[player][slot] = readSlotCount();
    }
  }

  const mine = new Array(24).fill(0);
  const opponent = new Array(24).fill(0);

  // board[1] is the decision-maker ("mine"), already in their own frame, so
  // it reads straight across. board[0] is the opponent, in *their* own
  // frame, so it needs the 25 - point mirror to land at the matching
  // physical point in the mover's frame.
  for (let point = 1; point <= 24; point++) {
    mine[point - 1] = board[1][point - 1];
    opponent[point - 1] = board[0][24 - point];
  }

  const mineBar = board[1][24];
  const opponentBar = board[0][24];

  const mineOnBoard = board[1].reduce((a, b) => a + b, 0);
  const opponentOnBoard = board[0].reduce((a, b) => a + b, 0);
  const mineOff = 15 - mineOnBoard;
  const opponentOff = 15 - opponentOnBoard;

  return { mine, opponent, mineBar, opponentBar, mineOff, opponentOff };
}

// For a fixed-perspective board view (app/matches/[matchId]/replay): when
// the decision on screen belongs to the opponent (relative to some fixed
// "my" color), decodeGnuPositionId's own output already has mine/opponent
// swapped from what a fixed viewer wants — "mine" is always "whoever's on
// roll", not a stable color. Re-mirroring the finished output the exact
// same way the decoder already mirrors its own two raw board arrays
// internally (board[0][24 - point]) swaps it back: mine/opponent trade
// places, and each 24-point array is index-reversed so a checker on
// physical point N under one frame is correctly read from physical point
// (25 - N) under the other. Pure and decoder-independent — no change to
// decodeGnuPositionId itself, and calling it twice (flip of a flip) is
// exactly the identity transform, same as mirroring any coordinate twice.
export function flipPerspective(decoded: DecodedPosition): DecodedPosition {
  const mine = new Array(24).fill(0);
  const opponent = new Array(24).fill(0);
  for (let point = 1; point <= 24; point++) {
    mine[point - 1] = decoded.opponent[24 - point];
    opponent[point - 1] = decoded.mine[24 - point];
  }

  return {
    mine,
    opponent,
    mineBar: decoded.opponentBar,
    opponentBar: decoded.mineBar,
    mineOff: decoded.opponentOff,
    opponentOff: decoded.mineOff,
  };
}

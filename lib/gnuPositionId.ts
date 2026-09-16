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

  for (let point = 1; point <= 24; point++) {
    mine[point - 1] = board[0][point - 1];
    // Opponent's checkers physically at my-frame point `point` sit at
    // the opponent's own point (25 - point), since the board mirrors.
    opponent[point - 1] = board[1][24 - point];
  }

  const mineBar = board[0][24];
  const opponentBar = board[1][24];

  const mineOnBoard = board[0].reduce((a, b) => a + b, 0);
  const opponentOnBoard = board[1].reduce((a, b) => a + b, 0);
  const mineOff = 15 - mineOnBoard;
  const opponentOff = 15 - opponentOnBoard;

  return { mine, opponent, mineBar, opponentBar, mineOff, opponentOff };
}

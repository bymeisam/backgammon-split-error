// Decoder for the GNU Backgammon Match ID format: a 12-character base64
// string encoding a 9-byte (72-bit, 66 bits used) little-endian key holding
// the match state around one position — cube value and owner, who is on
// roll, whose turn it is, the dice, the match length and both scores.
// Galaxy sends one on every analysed event as
// `reviews[0].source_match.formatted_value`; this app reads a decision's
// cube state and roll from it, and it's where the score, Crawford flag and
// match length at a decision come from — none of these is stored as a
// column (see docs/field-mapping.md, "GNU Match ID" and "Derived from raw").
//
// Bit layout (bit 0 = least significant bit of byte 0):
//   0-3   log2(cube value)
//   4-5   cube owner: 0 = player 0, 1 = player 1, 3 = centred
//   6     dice owner (player on roll)
//   7     Crawford game
//   8-10  game state
//   11    turn (player who must make the next decision)
//   12    double offered
//   13-14 resignation offered
//   15-17 die 1
//   18-20 die 2
//   21-35 match length (0 = money game)
//   36-50 score of player 0
//   51-65 score of player 1
//
// Player 1 = black, player 0 = white on Galaxy — verified against every
// CHECKER row's Decision.color and dice owner (docs/field-mapping.md).

const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export type GnuPlayer = 0 | 1;

export interface DecodedMatchId {
  cubeValue: number;
  // Player index owning the cube, or null when centred.
  cubeOwner: GnuPlayer | null;
  // Player on roll — the player the board's position ID is drawn from.
  diceOwner: GnuPlayer;
  crawford: boolean;
  gameState: number;
  // Player who must make the next decision (the receiver while a double is
  // pending).
  turn: GnuPlayer;
  doubleOffered: boolean;
  resignationOffered: number;
  dice: [number, number];
  // 0 = money game.
  matchLength: number;
  // Indexed by GnuPlayer: score[0] = player 0 (white), score[1] = player 1
  // (black).
  score: [number, number];
}

export const GNU_PLAYER_BLACK: GnuPlayer = 1;
export const GNU_PLAYER_WHITE: GnuPlayer = 0;

// Galaxy colour -> GNU player index. Anything other than "black"/"white"
// (CUBE rows often store an empty colour) has no mapping.
export function gnuPlayerForColor(color: string | null | undefined): GnuPlayer | null {
  if (color === "black") return GNU_PLAYER_BLACK;
  if (color === "white") return GNU_PLAYER_WHITE;
  return null;
}

function decodeBytes(id: string): Uint8Array | null {
  if (id.length !== 12) return null;
  const bytes = new Uint8Array(9);
  let buffer = 0;
  let bits = 0;
  let out = 0;
  for (const ch of id) {
    const value = BASE64_CHARS.indexOf(ch);
    if (value === -1) return null;
    buffer = ((buffer << 6) | value) & 0xffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[out++] = (buffer >> bits) & 0xff;
    }
  }
  return out === 9 ? bytes : null;
}

// Returns null for anything that isn't a well-formed 12-character Match ID
// (wrong length, non-base64 characters, a cube owner of 2, which GNU never
// writes) rather than guessing.
export function decodeGnuMatchId(id: string | null | undefined): DecodedMatchId | null {
  if (typeof id !== "string") return null;
  const bytes = decodeBytes(id);
  if (!bytes) return null;

  let lo = BigInt(0);
  for (let i = 7; i >= 0; i--) lo = (lo << BigInt(8)) | BigInt(bytes[i]);
  const hi = bytes[8];
  const field = (shift: number, width: number): number =>
    Number((lo >> BigInt(shift)) & ((BigInt(1) << BigInt(width)) - BigInt(1)));

  const ownerBits = field(4, 2);
  if (ownerBits === 2) return null;

  return {
    cubeValue: 1 << field(0, 4),
    cubeOwner: ownerBits === 3 ? null : (ownerBits as GnuPlayer),
    diceOwner: field(6, 1) as GnuPlayer,
    crawford: field(7, 1) === 1,
    gameState: field(8, 3),
    turn: field(11, 1) as GnuPlayer,
    doubleOffered: field(12, 1) === 1,
    resignationOffered: field(13, 2),
    dice: [field(15, 3), field(18, 3)],
    matchLength: field(21, 15),
    score: [field(36, 15), field(51, 13) | ((hi & 3) << 13)],
  };
}

// The match length the app uses (0 = money; not stored — the
// Match.matchLength column was dropped 2026-10-07), from a
// decoded Match ID. The one place the even-length rule lives: Galaxy
// matches are always odd lengths (1, 3, 5, 7...), and an even decoded length
// means a money game — five old single-game "matches" decode to 8 (72588,
// 72587, 72577, 19719) or 16 (249289) with final scores no match of that
// length can end on; old money-game Match IDs apparently reuse the length
// bits. decodeGnuMatchId keeps returning the literal bits; everything that
// turns them into a length or a money flag (gameScoreFromMatchId,
// crawfordStateFor) goes through here. See
// docs/field-mapping.md, "GNU Match ID".
export function effectiveMatchLength(m: DecodedMatchId): number {
  return m.matchLength % 2 === 0 ? 0 : m.matchLength;
}

// The Crawford state at a decision (no longer stored: Game.crawfordState was
// dropped 2026-10-07), in Galaxy's own metadata.crawford_state
// vocabulary: "crawford" for the Crawford game itself, "post_crawford" for a
// later game in which a player still needs exactly one point, "none"
// otherwise — and always for a money game (including an even decoded length,
// see effectiveMatchLength) and a 1-point match, where the Crawford rule has
// nothing to apply to. Matches Galaxy's own label on every game of length 2+
// (local check, 2026-10-06: 7,471 of 7,471; the 60 money games, the other
// part of an earlier "7,531" count, agree too). For 1-point
// matches Galaxy changed its own label over time ("crawford" up to match
// 40136106, "none" from 40310886 on, with the GNU Crawford bit clear in
// both); "none" follows its current behaviour.
export type CrawfordState = "none" | "crawford" | "post_crawford";

export function crawfordStateFor(m: DecodedMatchId): CrawfordState {
  const length = effectiveMatchLength(m);
  if (length <= 1) return "none";
  if (m.crawford) return "crawford";
  const away = length - 1;
  return m.score[0] === away || m.score[1] === away ? "post_crawford" : "none";
}

// Inverse of decodeGnuMatchId — builds a Match ID from its fields. Used by
// tests and fixtures to write readable match states instead of opaque
// strings; the app itself only ever decodes.
export function encodeGnuMatchId(m: DecodedMatchId): string {
  const big = (n: number | boolean, shift: number): bigint => BigInt(Number(n)) << BigInt(shift);
  const ownerBits = m.cubeOwner === null ? 3 : m.cubeOwner;
  const lo =
    big(Math.log2(m.cubeValue), 0) |
    big(ownerBits, 4) |
    big(m.diceOwner, 6) |
    big(m.crawford, 7) |
    big(m.gameState, 8) |
    big(m.turn, 11) |
    big(m.doubleOffered, 12) |
    big(m.resignationOffered, 13) |
    big(m.dice[0], 15) |
    big(m.dice[1], 18) |
    big(m.matchLength, 21) |
    big(m.score[0], 36) |
    big(m.score[1] & 8191, 51);
  const bytes: number[] = [];
  for (let i = 0; i < 8; i++) bytes.push(Number((lo >> BigInt(8 * i)) & BigInt(255)));
  bytes.push((m.score[1] >> 13) & 3);
  let out = "";
  for (let i = 0; i < 9; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += BASE64_CHARS[(n >> 18) & 63] + BASE64_CHARS[(n >> 12) & 63] + BASE64_CHARS[(n >> 6) & 63] + BASE64_CHARS[n & 63];
  }
  return out;
}

// The roll a decision shows, from its own Match ID's dice (bits 15–20) —
// the one rule for it (since 2026-10-07; the old Decision.roll column is
// dropped). A checker move ("move") shows the dice it was played with,
// higher die first (6-3, never 3-6), as Galaxy's own client shows them —
// display only: the Match ID's own die order (die 1, die 2) carries no
// meaning the app uses, and nothing is stored (since 2026-10-07; before
// that the Match ID's order was shown). A double is two equal dice. Every
// other decision shows none: a cube decision is made before the roll, and a
// resignation isn't a move. Empty too when the Match ID is missing or its
// dice aren't 1–6. The Match ID's dice match the move played on every local
// checker row; the old column, filled by a scan back to the preceding
// dice_rolled event, was wrong on 224 of 595,845 (e.g. decision 749213,
// match 35478993 g6: column 3-3, Match ID 5-2 for `23/21 15/10`) and gave
// the dice in the other order on 7,831. See docs/field-mapping.md, "Derived
// from raw".
export function diceRollFor(analysedEvent: string | null | undefined, m: DecodedMatchId | null): number[] {
  if (analysedEvent !== "move" || !m) return [];
  const [a, b] = m.dice;
  if (a < 1 || a > 6 || b < 1 || b > 6) return [];
  return a >= b ? [a, b] : [b, a];
}

// The player index a decision's actor (event.user_id) is, read from that
// decision's own Match ID — the dice owner for a checker move, the turn for
// a cube decision (on cube_pass the turn is the receiver, the actor).
// Resignation rows are left out: on 70 of 1,893 checkable ones the actor is
// not the turn player (local check, 2026-10-06), so they can't vouch for a
// mapping.
export function actorPlayerFor(analysedEvent: string, m: DecodedMatchId): GnuPlayer | null {
  if (analysedEvent === "move") return m.diceOwner;
  if (analysedEvent === "cube_double" || analysedEvent === "cube_pass") return m.turn;
  return null;
}

// Collects "player index -> userId" evidence across a match (colours are
// fixed for a whole match: 0 matches locally where a user's colour changes
// between games) and resolves it. Evidence comes from each decision's own
// colour where Galaxy filled it in, and from actorPlayerFor otherwise.
export class PlayerUserIds {
  private readonly byPlayer: [Set<string>, Set<string>] = [new Set(), new Set()];
  private readonly users = new Set<string>();

  add(userId: string, player: GnuPlayer | null): void {
    if (!userId) return;
    this.users.add(userId);
    if (player !== null) this.byPlayer[player].add(userId);
  }

  // The userId playing as `player`, or null when the evidence is missing or
  // contradictory. When only the other player is known and exactly one
  // other userId was seen in the match, that one is used.
  userIdFor(player: GnuPlayer): string | null {
    const direct = this.byPlayer[player];
    if (direct.size === 1) return [...direct][0];
    if (direct.size > 1) return null;
    const other = this.byPlayer[player === 0 ? 1 : 0];
    if (other.size !== 1) return null;
    const otherId = [...other][0];
    const rest = [...this.users].filter((u) => u !== otherId);
    return rest.length === 1 ? rest[0] : null;
  }

  // The player index `userId` plays as, or null if unknown. If `userId`
  // never shows up but the other seat is known to be someone else, it's the
  // remaining seat.
  playerFor(userId: string): GnuPlayer | null {
    const players: GnuPlayer[] = [GNU_PLAYER_BLACK, GNU_PLAYER_WHITE];
    for (const p of players) if (this.userIdFor(p) === userId) return p;
    for (const p of players) {
      const id = this.userIdFor(p);
      const other: GnuPlayer = p === 0 ? 1 : 0;
      if (id !== null && id !== userId && this.userIdFor(other) === null) return other;
    }
    return null;
  }
}

// One decision's (or event's) seat evidence: its own colour if Galaxy filled
// it in, plus the seat actorPlayerFor reads from its Match ID. Shared by
// anything that maps a Match ID seat to a userId (gameScoreFromMatchId's
// callers), so seats always resolve the same way.
export function addSeatEvidence(
  players: PlayerUserIds,
  e: { userId: string; color: string | null | undefined; analysedEvent: string | null | undefined; matchId: DecodedMatchId | null }
): void {
  const colorPlayer = gnuPlayerForColor(e.color);
  if (colorPlayer !== null) players.add(e.userId, colorPlayer);
  players.add(e.userId, e.matchId && e.analysedEvent ? actorPlayerFor(e.analysedEvent, e.matchId) : null);
}

// The user's and opponent's score and the Crawford state at a decision, from
// its Match ID (pass a game's first decision for the score entering the
// game). Not stored: Game.userScore/opponentScore/crawfordState were
// dropped 2026-10-07 because nothing read them; this is the derivation for
// any future view that needs them. Money game (effectiveMatchLength 0,
// which includes an even decoded length): all three null — a score means
// nothing there. Scores go through the user's own seat (PlayerIdentity.isMe;
// black = player 1, white = player 0) and are left out when that seat isn't
// known (no isMe row yet, or no seat evidence).
export function gameScoreFromMatchId(
  m: DecodedMatchId,
  players: PlayerUserIds,
  myUserId: string | null | undefined
): { crawfordState: CrawfordState | null; userScore?: number | null; opponentScore?: number | null } {
  if (effectiveMatchLength(m) === 0) return { crawfordState: null, userScore: null, opponentScore: null };
  const crawfordState = crawfordStateFor(m);
  const mySeat = myUserId ? players.playerFor(myUserId) : null;
  if (mySeat === null) return { crawfordState };
  return { crawfordState, userScore: m.score[mySeat], opponentScore: m.score[mySeat === 1 ? 0 : 1] };
}

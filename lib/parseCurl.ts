export type ParsedCurl = {
  matchId: string;
  authorization: string;
};

export function parseCurl(input: string): ParsedCurl {
  const text = input.trim();
  if (!text) {
    throw new Error("Paste a curl command first.");
  }

  const urlMatch = text.match(/https?:\/\/[^\s'"]+/);
  if (!urlMatch) {
    throw new Error("Couldn't find a URL in the pasted curl command.");
  }

  const idMatch = urlMatch[0].match(/game_reviews\/(\d+)\/\d+/);
  if (!idMatch) {
    throw new Error(
      "Couldn't find a match ID in the URL (expected .../game_reviews/{matchId}/{gameIndex})."
    );
  }

  const headerMatch = text.match(/['"]\s*authorization\s*:\s*([^'"]+?)\s*['"]/i);
  if (!headerMatch) {
    throw new Error("Couldn't find an authorization header in the pasted curl command.");
  }

  return {
    matchId: idMatch[1],
    authorization: headerMatch[1].trim(),
  };
}

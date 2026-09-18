export function parseAuthorizationFromCurl(input: string): string {
  const text = input.trim();
  if (!text) {
    throw new Error("Paste a curl command first.");
  }

  const headerMatch = text.match(/['"]\s*authorization\s*:\s*([^'"]+?)\s*['"]/i);
  if (!headerMatch) {
    throw new Error("Couldn't find an authorization header in the pasted curl command.");
  }

  return headerMatch[1].trim();
}

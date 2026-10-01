// Client-side calls to this app's own Galaxy-proxying API routes
// (/api/galaxy/...). Every one is a JSON POST carrying the in-memory Galaxy
// token as `authorization` (see app/providers/GameStatsAuthProvider.tsx), plus any
// route-specific fields.
export function galaxyPost(
  path: string,
  token: string,
  extra: Record<string, unknown> = {}
): Promise<Response> {
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authorization: token, ...extra }),
  });
}

// The parsed JSON body of an OK response; for a non-OK one, throws the
// route's own `{ error }` message, falling back to the status code.
export async function jsonOrThrow(res: Response): Promise<unknown> {
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status}).`);
  return json;
}

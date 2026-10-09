// Reads the server's JSON answer, and says so plainly when there is no
// answer to read, as when the server is not running or restarting.
export async function readAnswer<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: { error?: string } | undefined;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }
  if (!response.ok || body === undefined) {
    throw new Error(body?.error ?? "the server is not reachable; is it running?");
  }
  return body as T;
}

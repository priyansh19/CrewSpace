import detectPort from "detect-port";

export async function findAvailablePort(start: number): Promise<number> {
  const port = await detectPort(start);
  return port;
}

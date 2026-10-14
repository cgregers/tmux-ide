/** Revalidate a captured route immediately before the single create effect. */
export async function createOnFleetRoute<T>(
  route: { read(): Promise<unknown>; assertCurrent(): void },
  current: () => boolean,
  create: () => Promise<T>,
): Promise<T> {
  if (!current()) throw new Error("Server selection changed");
  await route.read();
  if (!current()) throw new Error("Server selection changed");
  route.assertCurrent();
  return create();
}

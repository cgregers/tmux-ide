/** Session navigation remains valid outside the bounded server list. Creation
 * and explicit server selection require a visible, exact destination. */
export function assertFleetSelectionCurrent(
  selection: { assertCurrent(): void; descriptor?: unknown },
  hasPublishedServer: boolean,
  forCreation = false,
): void {
  selection.assertCurrent();
  if ((forCreation || "descriptor" in selection) && !hasPublishedServer)
    throw new Error("Server selection changed");
}

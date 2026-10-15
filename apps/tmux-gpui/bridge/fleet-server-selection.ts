/** Complete one explicit server navigation; no fallback and no mutation retry. */
export async function completeFleetServerSelection(options: {
  select(): Promise<unknown>;
  refresh(current: () => boolean): Promise<void>;
  current(): boolean;
  retire(): void;
}): Promise<void> {
  try {
    await options.select();
    if (!options.current()) {
      options.retire();
      return;
    }
    await options.refresh(options.current);
    if (!options.current()) options.retire();
  } catch {
    options.retire();
  }
}

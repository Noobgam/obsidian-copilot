// this one is completely undocumented.
// https://forum.obsidian.md/t/efficiently-get-all-tags-through-the-api/38400
export function getAllVaultTags(): string[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obsidianResponse = (app.metadataCache as any).getTags();
  return Object.keys(obsidianResponse);
}

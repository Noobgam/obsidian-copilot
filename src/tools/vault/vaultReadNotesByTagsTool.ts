import { CopilotTool } from '@/tools/tools';
import { Vault } from 'obsidian';
import { getNotesFromTags } from '@/utils';

export class VaultReadNotesByTagsTool extends CopilotTool {
  private readonly vault: Vault;
  constructor(vault: Vault) {
    super();
    this.name = 'VaultReadNotesByTagsTool';
    this.description = `Given a comma separated list of tags, e.g. "#funny,#study"
    Returns a JSON formatted as [note_path] = note_content`;
    this.vault = vault;
  }

  async execute(arg: string): Promise<string> {
    const files = await getNotesFromTags(this.vault, arg.split(','));
    const res: Record<string, string> = {};
    for (const file of files) {
      res[file.name] = await this.vault.cachedRead(file);
    }
    return JSON.stringify(res);
  }
}

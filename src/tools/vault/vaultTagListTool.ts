import { CopilotTool } from '@/tools/tools';
import { getAllVaultTags } from '@/obsidianUtils';

export class VaultTagListTool extends CopilotTool {
  constructor() {
    super();
    this.name = 'VaultTagListTool';
    this.description = `Lists all available tags in the vault.
    These tags can be used for lookups.`;
  }

  execute(arg: string): Promise<string> {
    return Promise.resolve(getAllVaultTags().join(','));
  }
}

import { Tool } from '@langchain/core/tools';

export abstract class CopilotTool extends Tool {
  name: string;
  description: string;
  abstract execute(input: string): Promise<string>;

  _call(arg: string): Promise<string> {
    return this.execute(arg);
  }
}

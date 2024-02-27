import CopilotPlugin from '@/main';
import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import React from 'react';
import { createRoot } from 'react-dom/client';
import SettingsMain from './components/SettingsMain';

interface MainSettings {
  azureOpenAIApiInstanceName: string;
  azureOpenAIApiDeploymentName: string;
  azureOpenAIApiVersion: string;
  azureOpenAIApiEmbeddingDeploymentName: string;
  openRouterModel: string;
  defaultModel: string;
  defaultModelDisplayName: string;
  embeddingModel: string;
  temperature: number;
  maxTokens: number;
  contextTurns: number;
  userSystemPrompt: string;
  openAIProxyBaseUrl: string;
  openAIProxyModelName: string;
  openAIEmbeddingProxyBaseUrl: string;
  openAIEmbeddingProxyModelName: string;
  ollamaModel: string;
  ollamaBaseUrl: string;
  lmStudioBaseUrl: string;
  ttlDays: number;
  stream: boolean;
  embeddingProvider: string;
  defaultSaveFolder: string;
  debug: boolean;
  enableEncryption: boolean;
}

interface ChatNoteContextSettings {
  chatNoteContextPath: string;
  chatNoteContextTags: string[];
  debug: boolean;
}

export const API_KEY_SETTINGS = [
  'openAIApiKey',
  'huggingfaceApiKey',
  'cohereApiKey',
  'anthropicApiKey',
  'azureOpenAIApiKey',
  'googleApiKey',
  'openRouterAiApiKey',
] as const;

export type ApiKeySettings = {
  [K in (typeof API_KEY_SETTINGS)[number]]: string;
};

export type EncryptionSettings = { enableEncryption: boolean; } & ApiKeySettings;

export type CopilotSettings =
  MainSettings &
  EncryptionSettings &
  ApiKeySettings &
  ChatNoteContextSettings;

export class CopilotSettingTab extends PluginSettingTab {
  plugin: CopilotPlugin;

  constructor(app: App, plugin: CopilotPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  async reloadPlugin() {
    try {
      // Save the settings before reloading
      await this.plugin.saveSettings();

      // Reload the plugin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = this.plugin.app as any;
      await app.plugins.disablePlugin('copilot');
      await app.plugins.enablePlugin('copilot');

      app.setting.openTabById('copilot').display();
      new Notice('Plugin reloaded successfully.');
    } catch (error) {
      new Notice('Failed to reload the plugin. Please reload manually.');
      console.error('Error reloading plugin:', error);
    }
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.style.userSelect = 'text';
    const div = containerEl.createDiv('div');
    const sections = createRoot(div);

    sections.render(
      <SettingsMain
        plugin={this.plugin}
        reloadPlugin={this.reloadPlugin.bind(this)}
      />
    );

    const devModeHeader = containerEl.createEl('h1', {
      text: 'Additional Settings',
    });
    devModeHeader.style.marginTop = '40px';

    new Setting(containerEl)
      .setName('Enable Encryption')
      .setDesc(
        createFragment((frag) => {
          frag.appendText('Enable encryption for the API keys.');
        })
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableEncryption)
          .onChange(async (value) => {
            this.plugin.settings.enableEncryption = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Debug mode')
      .setDesc(
        createFragment((frag) => {
          frag.appendText(
            'Debug mode will log all API requests and prompts to the console.'
          );
        })
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.debug).onChange(async (value) => {
          this.plugin.settings.debug = value;
          await this.plugin.saveSettings();
        })
      );
  }
}

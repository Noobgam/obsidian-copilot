import { LangChainParams, SetChainOptions } from '@/aiParams';
import ChainFactory, { ChainType } from '@/chainFactory';
import { AI_SENDER, ChatModelDisplayNames } from '@/constants';
import { ProxyChatOpenAI } from '@/langchainWrappers';
import { ChatMessage } from '@/sharedState';
import { extractChatHistory, getModelName, isSupportedChain } from '@/utils';
import VectorDBManager, { MemoryVector } from '@/vectorDBManager';
import { ChatOllama } from '@langchain/community/chat_models/ollama';
import { RunnableSequence } from '@langchain/core/runnables';
import { BaseChatMemory } from 'langchain/memory';
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
} from 'langchain/prompts';
import { MultiQueryRetriever } from 'langchain/retrievers/multi_query';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { Notice } from 'obsidian';
import ChatModelManager from './chatModelManager';
import EmbeddingsManager from './embeddingManager';
import MemoryManager from './memoryManager';
import PromptManager from './promptManager';

export default class ChainManager {
  private static chain: RunnableSequence;
  private static retrievalChain: RunnableSequence;

  private static isOllamaModelActive = false;
  private static isOpenRouterModelActive = false;
  public chatModelManager: ChatModelManager;
  public langChainParams: LangChainParams;
  public memoryManager: MemoryManager;
  private vectorStore: MemoryVectorStore;
  private promptManager: PromptManager;
  private embeddingsManager: EmbeddingsManager;

  /**
   * Constructor for initializing langChainParams and instantiating singletons.
   *
   * @param {LangChainParams} langChainParams - the parameters for language chaining
   * @return {void}
   */
  constructor(langChainParams: LangChainParams) {
    // Instantiate singletons
    this.langChainParams = langChainParams;
    this.memoryManager = MemoryManager.getInstance(this.langChainParams);
    this.chatModelManager = ChatModelManager.getInstance(this.langChainParams);
    this.promptManager = PromptManager.getInstance(this.langChainParams);
    this.createChainWithNewModel(this.langChainParams.modelDisplayName);
  }

  /**
   * Update the active model and create a new chain
   * with the specified model display name.
   *
   * @param {string} newModelDisplayName - the display name of the new model in the dropdown
   * @return {void}
   */
  createChainWithNewModel(newModelDisplayName: string): void {
    ChainManager.isOllamaModelActive =
      newModelDisplayName === ChatModelDisplayNames.OLLAMA;
    ChainManager.isOpenRouterModelActive =
      newModelDisplayName === ChatModelDisplayNames.OPENROUTERAI;
    // model and model display name must be update at the same time!
    let newModel = getModelName(newModelDisplayName);

    switch (newModelDisplayName) {
      case ChatModelDisplayNames.OLLAMA:
        newModel = this.langChainParams.ollamaModel;
        break;
      case ChatModelDisplayNames.LM_STUDIO:
        newModel = 'check_model_in_lm_studio_ui';
        break;
      case ChatModelDisplayNames.OPENROUTERAI:
        newModel = this.langChainParams.openRouterModel;
        break;
    }

    try {
      this.langChainParams.model = newModel;
      this.langChainParams.modelDisplayName = newModelDisplayName;
      this.chatModelManager.setChatModel(newModelDisplayName);
      // Must update the chatModel for chain because ChainFactory always
      // retrieves the old chain without the chatModel change if it exists!
      // Create a new chain with the new chatModel
      this.createChain(this.langChainParams.chainType, {
        ...this.langChainParams.options,
        forceNewCreation: true,
      });
      console.log(`Setting model to ${newModelDisplayName}: ${newModel}`);
    } catch (error) {
      console.error('createChainWithNewModel failed: ', error);
      console.log('model:', this.langChainParams.model);
    }
  }

  /* Create a new chain, or update chain with new model */
  createChain(chainType: ChainType, options?: SetChainOptions): void {
    this.validateChainType(chainType);
    try {
      this.setChain(chainType, options);
    } catch (error) {
      new Notice('Error creating chain:', error);
      console.error('Error creating chain:', error);
    }
  }

  async setChain(
    chainType: ChainType,
    options: SetChainOptions = {}
  ): Promise<void> {
    if (
      !this.chatModelManager.validateChatModel(
        this.chatModelManager.getChatModel()
      )
    ) {
      // No need to throw error and trigger multiple Notices to user
      console.error('setChain failed: No chat model set.');
      return;
    }
    this.validateChainType(chainType);
    // MUST set embeddingsManager when switching to QA mode
    if (chainType === ChainType.RETRIEVAL_QA_CHAIN) {
      this.embeddingsManager = EmbeddingsManager.getInstance(
        this.langChainParams
      );
    }

    // Get chatModel, memory, prompt, and embeddingAPI from respective managers
    const chatModel = this.chatModelManager.getChatModel();
    const memory = this.memoryManager.getMemory();
    const chatPrompt = this.promptManager.getChatPrompt();

    switch (chainType) {
      case ChainType.LLM_CHAIN: {
        // For initial load of the plugin
        if (options.forceNewCreation) {
          // setChain is async, this is to ensure Ollama has the right model passed in from the setting
          if (ChainManager.isOllamaModelActive) {
            (chatModel as ChatOllama).model = this.langChainParams.ollamaModel;
          } else if (ChainManager.isOpenRouterModelActive) {
            (chatModel as ProxyChatOpenAI).modelName =
              this.langChainParams.openRouterModel;
          }

          ChainManager.chain = ChainFactory.createNewLLMChain({
            llm: chatModel,
            memory: memory,
            prompt: options.prompt || chatPrompt,
            abortController: options.abortController,
          }) as RunnableSequence;
        } else {
          // For navigating back to the plugin view
          ChainManager.chain = ChainFactory.getLLMChainFromMap({
            llm: chatModel,
            memory: memory,
            prompt: options.prompt || chatPrompt,
            abortController: options.abortController,
          }) as RunnableSequence;
        }

        this.langChainParams.chainType = ChainType.LLM_CHAIN;
        break;
      }
      case ChainType.RETRIEVAL_QA_CHAIN: {
        if (!options.noteContent) {
          new Notice('No note content provided');
          throw new Error('No note content provided');
        }

        this.setNoteContent(options.noteContent);
        const docHash = VectorDBManager.getDocumentHash(options.noteContent);
        const parsedMemoryVectors: MemoryVector[] | undefined =
          await VectorDBManager.getMemoryVectors(docHash);
        if (parsedMemoryVectors) {
          // Index already exists
          const embeddingsAPI = this.embeddingsManager.getEmbeddingsAPI();
          if (!embeddingsAPI) {
            console.error(
              'Error getting embeddings API. Please check your settings.'
            );
            return;
          }
          const vectorStore = await VectorDBManager.rebuildMemoryVectorStore(
            parsedMemoryVectors,
            embeddingsAPI
          );

          // Create new conversational retrieval chain
          ChainManager.retrievalChain =
            ChainFactory.createConversationalRetrievalChain({
              llm: chatModel,
              retriever: vectorStore.asRetriever(),
            });
          console.log('Existing vector store for document hash: ', docHash);
        } else {
          // Index doesn't exist
          await this.buildIndex(options.noteContent, docHash);
          if (!this.vectorStore) {
            console.error('Error creating vector store.');
            return;
          }

          const retriever = MultiQueryRetriever.fromLLM({
            llm: chatModel,
            retriever: this.vectorStore.asRetriever(),
            verbose: false,
          });

          ChainManager.retrievalChain =
            ChainFactory.createConversationalRetrievalChain({
              llm: chatModel,
              retriever: retriever,
            });
          console.log(
            'New conversational retrieval qa chain with multi-query retriever created for ' +
              'document hash: ',
            docHash
          );
        }

        this.langChainParams.chainType = ChainType.RETRIEVAL_QA_CHAIN;
        console.log('Set chain:', ChainType.RETRIEVAL_QA_CHAIN);
        break;
      }
      default:
        this.validateChainType(chainType);
        break;
    }
  }

  async runChain(
    userMessage: string,
    abortController: AbortController,
    updateCurrentAiMessage: (message: string) => void,
    addMessage: (message: ChatMessage) => void,
    options: {
      debug?: boolean;
      ignoreSystemMessage?: boolean;
      updateLoading?: (loading: boolean) => void;
    } = {}
  ) {
    const { debug = false, ignoreSystemMessage = false } = options;

    // Check if chat model is initialized
    if (
      !this.chatModelManager.validateChatModel(
        this.chatModelManager.getChatModel()
      )
    ) {
      const errorMsg =
        'Chat model is not initialized properly, check your API key in Copilot setting and make sure you have API access.';
      new Notice(errorMsg);
      console.error(errorMsg);
      return;
    }
    // Check if chain is initialized properly
    if (!ChainManager.chain || !isSupportedChain(ChainManager.chain)) {
      console.error(
        'Chain is not initialized properly, re-initializing chain: ',
        this.langChainParams.chainType
      );
      this.setChain(
        this.langChainParams.chainType,
        this.langChainParams.options
      );
    }

    const {
      temperature,
      maxTokens,
      systemMessage,
      chatContextTurns,
      chainType,
    } = this.langChainParams;

    const memory = this.memoryManager.getMemory();
    const chatPrompt = this.promptManager.getChatPrompt();
    const systemPrompt = ignoreSystemMessage ? '' : systemMessage;
    // Whether to ignore system prompt (for commands)
    if (ignoreSystemMessage) {
      const effectivePrompt = ignoreSystemMessage
        ? ChatPromptTemplate.fromMessages([
            new MessagesPlaceholder('history'),
            HumanMessagePromptTemplate.fromTemplate('{input}'),
          ])
        : chatPrompt;

      this.setChain(chainType, {
        ...this.langChainParams.options,
        prompt: effectivePrompt,
      });
    } else {
      this.setChain(chainType, this.langChainParams.options);
    }

    let fullAIResponse = '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chatModel = (ChainManager.chain as any).last.bound;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chatStream = await ChainManager.chain.stream({
      input: userMessage,
    } as any);

    try {
      switch (chainType) {
        case ChainType.LLM_CHAIN:
          if (debug) {
            console.log(
              `*** DEBUG INFO ***\n` +
                `user message: ${userMessage}\n` +
                // ChatOpenAI has modelName, some other ChatModels like ChatOllama have model
                `model: ${chatModel.modelName || chatModel.model}\n` +
                `chain type: ${chainType}\n` +
                `temperature: ${temperature}\n` +
                `maxTokens: ${maxTokens}\n` +
                `system prompt: ${systemPrompt}\n` +
                `chat context turns: ${chatContextTurns}\n`
            );
            console.log('chain RunnableSequence:', ChainManager.chain);
            console.log('Chat memory:', memory);
          }

          for await (const chunk of chatStream) {
            if (abortController.signal.aborted) break;
            fullAIResponse += chunk.content;
            updateCurrentAiMessage(fullAIResponse);
          }
          break;
        case ChainType.RETRIEVAL_QA_CHAIN:
          if (debug) {
            console.log(
              `*** DEBUG INFO ***\n` +
                `user message: ${userMessage}\n` +
                `model: ${chatModel.modelName || chatModel.model}\n` +
                `chain type: ${chainType}\n` +
                `temperature: ${temperature}\n` +
                `maxTokens: ${maxTokens}\n` +
                `system prompt: ${systemPrompt}\n` +
                `chat context turns: ${chatContextTurns}\n`
            );
            console.log('chain RunnableSequence:', ChainManager.chain);
            console.log(
              'embedding provider:',
              this.langChainParams.embeddingProvider
            );
          }
          fullAIResponse = await this.runRetrievalChain(
            userMessage,
            memory,
            updateCurrentAiMessage,
            abortController
          );
          break;
        default:
          console.error(
            'Chain type not supported:',
            this.langChainParams.chainType
          );
      }
    } catch (error) {
      const errorData = error?.response?.data?.error || error;
      const errorCode = errorData?.code || error;
      if (errorCode === 'model_not_found') {
        const modelNotFoundMsg =
          'You do not have access to this model or the model does not exist, please check with your API provider.';
        new Notice(modelNotFoundMsg);
        console.error(modelNotFoundMsg);
      } else {
        new Notice(`LangChain error: ${errorCode}`);
        console.error(errorData);
      }
    } finally {
      if (fullAIResponse) {
        // This line is a must for memory to work with RunnableSequence!
        await memory.saveContext(
          { input: userMessage },
          { output: fullAIResponse }
        );
        addMessage({
          message: fullAIResponse,
          sender: AI_SENDER,
          isVisible: true,
        });
      }
      updateCurrentAiMessage('');
    }
    return fullAIResponse;
  }

  async buildIndex(noteContent: string, docHash: string): Promise<void> {
    // Note: HF can give 503 errors frequently (it's free)
    console.log('Creating vector store...');
    try {
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
      });

      const docs = await textSplitter.createDocuments([noteContent]);
      const embeddingsAPI = this.embeddingsManager.getEmbeddingsAPI();
      if (!embeddingsAPI) {
        const errorMsg =
          'Failed to create vector store, embedding API is not set correctly, please check your settings.';
        new Notice(errorMsg);
        console.error(errorMsg);
        return;
      }
      this.vectorStore = await MemoryVectorStore.fromDocuments(
        docs,
        embeddingsAPI
      );
      // Serialize and save vector store to PouchDB
      VectorDBManager.setMemoryVectors(this.vectorStore.memoryVectors, docHash);
      console.log('Vector store created successfully.');
      new Notice('Vector store created successfully.');
    } catch (error) {
      new Notice('Failed to create vector store, please try again:', error);
      console.error('Failed to create vector store, please try again.:', error);
    }
  }

  private setNoteContent(noteContent: string): void {
    this.langChainParams.options.noteContent = noteContent;
  }

  private validateChainType(chainType: ChainType): void {
    if (chainType === undefined || chainType === null)
      throw new Error('No chain type set');
  }

  private async runRetrievalChain(
    userMessage: string,
    memory: BaseChatMemory,
    updateCurrentAiMessage: (message: string) => void,
    abortController: AbortController
  ): Promise<string> {
    const memoryVariables = await memory.loadMemoryVariables({});
    const chatHistory = extractChatHistory(memoryVariables);
    const qaStream = await ChainManager.retrievalChain.stream({
      question: userMessage,
      chat_history: chatHistory,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    let fullAIResponse = '';

    for await (const chunk of qaStream) {
      if (abortController.signal.aborted) break;
      fullAIResponse += chunk.content;
      updateCurrentAiMessage(fullAIResponse);
    }
    return fullAIResponse;
  }
}

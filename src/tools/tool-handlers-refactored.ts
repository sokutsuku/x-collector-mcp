// src/tools/tool-handlers-refactored.ts
// リファクタリング版：機能別ハンドラーを統合するメインクラス

import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { BrowserService } from '../services/browser.js';
import { SheetsService } from '../services/sheets.js';
import { DriveService } from '../services/drive.js';
import { MCPResponse } from '../types/interfaces.js';
import readline from 'readline';

// 個別ハンドラーをインポート
import { BrowserToolHandler } from './handlers/browser-handler.js';
import { TwitterToolHandler } from './handlers/twitter-handler.js';
import { SheetsToolHandler } from './handlers/sheets-handler.js';
import { DriveToolHandler } from './handlers/drive-handler.js';

export class MCPToolHandlers {
  // サービス層
  private browserService: BrowserService;
  private sheetsService: SheetsService;
  private driveService: DriveService;
  private rl: readline.Interface;

  // 機能別ハンドラー
  private browserHandler: BrowserToolHandler;
  private twitterHandler: TwitterToolHandler;
  private sheetsHandler: SheetsToolHandler;
  private driveHandler: DriveToolHandler;

  constructor() {
    // サービス層の初期化
    this.browserService = new BrowserService();
    this.sheetsService = new SheetsService();
    this.driveService = new DriveService();
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // 機能別ハンドラーの初期化
    this.browserHandler = new BrowserToolHandler(this.browserService);
    this.twitterHandler = new TwitterToolHandler(this.browserService, this.rl);
    this.sheetsHandler = new SheetsToolHandler(this.sheetsService);
    this.driveHandler = new DriveToolHandler(this.driveService);
  }

  /**
   * MCPサーバーにツールハンドラーを設定
   */
  setupHandlers(server: Server): void {
    // 全ハンドラーからツール定義を収集
    const allTools = [
      ...this.browserHandler.getToolDefinitions(),
      ...this.twitterHandler.getToolDefinitions(),
      ...this.sheetsHandler.getToolDefinitions(),
      ...this.driveHandler.getToolDefinitions()
    ];

    // ツール一覧の定義
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: allTools
    }));

    // ツール実行のハンドラー
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        // 各ハンドラーに順番に処理を委譲
        let result: MCPResponse | null = null;

        // 1. ブラウザ関連ツール
        result = await this.browserHandler.handleTool(name, args);
        if (result) return { content: result.content };

        // 2. Twitter関連ツール
        const twitterService = this.browserHandler.getTwitterService();
        result = await this.twitterHandler.handleTool(name, args, twitterService);
        if (result) return { content: result.content };

        // 3. Google Sheets関連ツール
        result = await this.sheetsHandler.handleTool(
          name, 
          args,
          this.twitterHandler.getLastCollectedTweets(),
          this.twitterHandler.getLastCollectedProfile()
        );
        if (result) return { content: result.content };

        // 4. Google Drive関連ツール
        result = await this.driveHandler.handleTool(name, args);
        if (result) return { content: result.content };

        // どのハンドラーでも処理されなかった場合
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);

      } catch (error) {
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error}`);
      }
    });
  }

  // ===============================================
  // 統合データアクセサー（後方互換性のため）
  // ===============================================

  /**
   * 最後に収集したツイートを取得
   */
  getLastCollectedTweets() {
    return this.twitterHandler.getLastCollectedTweets();
  }

  /**
   * 最後に取得したプロフィールを取得
   */
  getLastCollectedProfile() {
    return this.twitterHandler.getLastCollectedProfile();
  }

  /**
   * 操作状態を取得
   */
  isCurrentlyOperating(): boolean {
    return this.twitterHandler.isCurrentlyOperating();
  }

  /**
   * データを手動で設定（テスト用）
   */
  setLastCollectedTweets(tweets: any[]): void {
    this.twitterHandler.setLastCollectedTweets(tweets);
  }

  setLastCollectedProfile(profile: any): void {
    this.twitterHandler.setLastCollectedProfile(profile);
  }

  /**
   * 各サービスの状態確認
   */
  getServiceStatus() {
    return {
      browser: this.browserHandler.isBrowserReady(),
      sheets: this.sheetsHandler.isSheetsReady(),
      drive: this.driveHandler.isDriveReady(),
      twitter: this.browserHandler.getTwitterService() !== null
    };
  }

  /**
   * クリーンアップ
   */
  async cleanup(): Promise<void> {
    if (this.browserService.isReady()) {
      await this.browserService.closeBrowser();
    }
    this.rl.close();
  }
}
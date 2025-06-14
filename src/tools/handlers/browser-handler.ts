// src/tools/handlers/browser-handler.ts
// ブラウザ関連ツールの専用ハンドラー

import { BrowserService } from '../../services/browser.js';
import { TwitterService } from '../../services/twitter.js';
import { MCPResponse } from '../../types/interfaces.js';

export class BrowserToolHandler {
  private browserService: BrowserService;
  private twitterService: TwitterService | null = null;

  constructor(browserService: BrowserService) {
    this.browserService = browserService;
  }

  /**
   * ブラウザ関連のツール定義
   */
  getToolDefinitions() {
    return [
      {
        name: "start_browser",
        description: "ブラウザを起動します（人間らしい動作設定）",
        inputSchema: {
          type: "object",
          properties: {
            slowMo: {
              type: "number",
              description: "動作速度（ミリ秒）",
              default: 200
            },
            viewportWidth: {
              type: "number",
              description: "ブラウザ幅",
              default: 1366
            },
            viewportHeight: {
              type: "number",
              description: "ブラウザ高さ",
              default: 768
            }
          }
        },
      },
      {
        name: "take_screenshot",
        description: "現在のページのスクリーンショットを撮影",
        inputSchema: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "保存ファイル名",
              default: "x_screenshot.png"
            }
          }
        },
      },
      {
        name: "close_browser",
        description: "ブラウザを終了します",
        inputSchema: {
          type: "object",
          properties: {}
        },
      }
    ];
  }

  /**
   * ブラウザ関連ツールの実行ハンドラー
   */
  async handleTool(toolName: string, args: any): Promise<MCPResponse | null> {
    switch (toolName) {
      case "start_browser":
        return await this.handleStartBrowser(
          args?.slowMo as number | undefined,
          args?.viewportWidth as number | undefined,
          args?.viewportHeight as number | undefined
        );
      
      case "take_screenshot":
        return await this.handleTakeScreenshot(args?.filename as string | undefined);
      
      case "close_browser":
        return await this.handleCloseBrowser();
      
      default:
        return null; // このハンドラーでは処理しない
    }
  }

  // ===============================================
  // 実装メソッド
  // ===============================================

  private async handleStartBrowser(
    slowMo: number = 200,
    width: number = 1366,
    height: number = 768
  ): Promise<MCPResponse> {
    const result = await this.browserService.startBrowser({
      slowMo,
      viewportWidth: width,
      viewportHeight: height
    });

    // TwitterServiceを初期化
    const page = this.browserService.getCurrentPage();
    if (page) {
      this.twitterService = new TwitterService(page);
    }

    return result;
  }

  private async handleTakeScreenshot(filename?: string): Promise<MCPResponse> {
    return await this.browserService.takeScreenshot(filename);
  }

  private async handleCloseBrowser(): Promise<MCPResponse> {
    const result = await this.browserService.closeBrowser();
    this.twitterService = null;
    return result;
  }

  /**
   * TwitterServiceを取得
   */
  getTwitterService(): TwitterService | null {
    return this.twitterService;
  }

  /**
   * ブラウザの状態確認
   */
  isBrowserReady(): boolean {
    return this.browserService.isReady();
  }
}
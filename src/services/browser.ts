// src/services/browser.ts
// ブラウザ操作の専用サービス

import puppeteer, { Browser, Page } from 'puppeteer';
import { BrowserConfig, MCPResponse } from '../types/interfaces.js';
import { humanDelay, getRandomUserAgent, setupAntiDetection } from '../utils/human-behavior.js';

export class BrowserService {
  private browser: Browser | null = null;
  private page: Page | null = null;

  /**
   * ブラウザを起動
   */
  async startBrowser(config: BrowserConfig = {}): Promise<MCPResponse> {
    const {
      slowMo = 200,
      viewportWidth = 1366,
      viewportHeight = 768,
      headless = false
    } = config;

    try {
      this.browser = await puppeteer.launch({
        headless,
        slowMo,
        args: [
          '--no-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-automation',
          '--disable-dev-shm-usage',
          `--window-size=${viewportWidth},${viewportHeight}`
        ]
      });

      this.page = await this.browser.newPage();
      
      // User-Agent設定
      await this.page.setUserAgent(getRandomUserAgent());
      await this.page.setViewport({ width: viewportWidth, height: viewportHeight });
      
      // 自動化検出回避
      await setupAntiDetection(this.page);

      return {
        content: [{
          type: "text",
          text: `🚀 ブラウザを起動しました（${viewportWidth}x${viewportHeight}、slowMo: ${slowMo}ms）`
        }]
      };
    } catch (error) {
      throw new Error(`ブラウザの起動に失敗しました: ${error}`);
    }
  }

  /**
   * 指定したURLに移動
   */
  async navigateToUrl(url: string): Promise<void> {
    if (!this.page) {
      throw new Error("ブラウザが起動していません。先にstartBrowserを実行してください。");
    }

    await humanDelay(1000, 2000);
    await this.page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await humanDelay(2000, 4000);
  }

  /**
   * スクリーンショットを撮影
   */
  async takeScreenshot(filename?: string): Promise<MCPResponse> {
    if (!this.page) {
      throw new Error("ブラウザが起動していません。");
    }

    try {
      const finalFilename = filename || "screenshot.png";
      const fileWithExt = finalFilename.endsWith(".png") ? finalFilename : `${finalFilename}.png`;
      
      await this.page.screenshot({ 
        path: fileWithExt as `${string}.png`,
        fullPage: true,
        type: 'png'
      });
      
      return {
        content: [{
          type: "text",
          text: `📸 スクリーンショットを ${finalFilename} に保存しました。`
        }]
      };
    } catch (error) {
      throw new Error(`スクリーンショットの撮影に失敗しました: ${error}`);
    }
  }

  /**
   * ブラウザを終了
   */
  async closeBrowser(): Promise<MCPResponse> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }

    return {
      content: [{
        type: "text",
        text: "👋 ブラウザを終了しました。"
      }]
    };
  }

  /**
   * 現在のページを取得
   */
  getCurrentPage(): Page | null {
    return this.page;
  }

  /**
   * ブラウザの状態確認
   */
  isReady(): boolean {
    return this.browser !== null && this.page !== null;
  }

  /**
   * ページの存在確認
   */
  hasPage(): boolean {
    return this.page !== null;
  }
}
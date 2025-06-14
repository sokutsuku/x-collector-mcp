#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import puppeteer, { Browser, Page } from 'puppeteer';
import readline from 'readline';
import { GoogleAuth } from 'google-auth-library';
import { sheets_v4, google } from 'googleapis';

interface Tweet {
  id: string;
  text: string;
  timestamp: string;
  author: string;
  likes: number;
  retweets: number;
  replies: number;
  isRetweet: boolean;
  originalAuthor?: string;
}

interface UserProfile {
  username: string;
  displayName: string;
  bio: string;
  followers: number;
  following: number;
  tweets: number;
  verified: boolean;
  profileImageUrl?: string;
}

interface SheetData {
  spreadsheetId: string;
  worksheetName: string;
  range: string;
  data: any[][];
}

interface SheetInfo {
  spreadsheetId: string;
  title: string;
  url: string;
  worksheets: string[];
}

class XCollectorServer {
  private server: Server;
  private browser: Browser | null = null;
  private page: Page | null = null;
  private rl: readline.Interface;
  private isOperating: boolean = false;
  private auth: GoogleAuth | null = null;
  private sheets: sheets_v4.Sheets | null = null;

  constructor() {
    this.server = new Server(
      {
        name: "x-collector",
        version: "0.2.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    this.setupToolHandlers();
    
    // Cleanup on exit
    process.on('SIGINT', this.cleanup.bind(this));
    process.on('SIGTERM', this.cleanup.bind(this));
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
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
          name: "navigate_to_user",
          description: "指定したXユーザーのページに移動します",
          inputSchema: {
            type: "object",
            properties: {
              username: {
                type: "string",
                description: "Xのユーザー名（@なし）"
              }
            },
            required: ["username"]
          },
        },
        {
          name: "check_login_status",
          description: "ログイン状態をチェックし、必要に応じて手動ログインを促します",
          inputSchema: {
            type: "object",
            properties: {}
          },
        },
        {
          name: "collect_tweets_naturally",
          description: "人間らしいスクロールでツイートを収集します",
          inputSchema: {
            type: "object",
            properties: {
              maxTweets: {
                type: "number",
                description: "最大取得ツイート数",
                default: 20
              },
              scrollDelay: {
                type: "number",
                description: "スクロール間隔（ミリ秒）",
                default: 3000
              },
              readingTime: {
                type: "number",
                description: "読んでいる風の待機時間（ミリ秒）",
                default: 2000
              }
            }
          },
        },
        {
          name: "get_user_profile",
          description: "ユーザープロフィール情報を取得します",
          inputSchema: {
            type: "object",
            properties: {}
          },
        },
        {
          name: "search_tweets",
          description: "キーワードでツイートを検索します",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "検索キーワード"
              },
              maxResults: {
                type: "number",
                description: "最大取得件数",
                default: 10
              }
            },
            required: ["query"]
          },
        },
        {
          name: "pause_for_human_interaction",
          description: "人間の手動操作を待機します（カーソル操作権を返す）",
          inputSchema: {
            type: "object",
            properties: {
              message: {
                type: "string",
                description: "表示するメッセージ"
              },
              pauseDuration: {
                type: "number",
                description: "一時停止時間（秒）",
                default: 30
              }
            },
            required: ["message"]
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
        },
        // 🆕 Google Sheets関連ツール
        {
          name: "setup_google_sheets",
          description: "Google Sheets APIの初期設定と認証確認を行います",
          inputSchema: {
            type: "object",
            properties: {}
          },
        },
        {
          name: "create_master_sheet",
          description: "X データ保存用のマスタースプレッドシートを作成します",
          inputSchema: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "スプレッドシートのタイトル",
                default: "X Data Collection"
              },
              shareWithEmail: {
                type: "string",
                description: "共有するメールアドレス（オプション）"
              }
            }
          },
        },
        {
          name: "export_tweets_to_sheets",
          description: "収集したツイートをGoogle Sheetsの日付別ワークシートに出力します",
          inputSchema: {
            type: "object",
            properties: {
              spreadsheetId: {
                type: "string",
                description: "出力先スプレッドシートID"
              },
              tweets: {
                type: "array",
                description: "出力するツイートデータ（最後に収集したデータを使用）"
              },
              worksheetName: {
                type: "string",
                description: "ワークシート名（未指定時は今日の日付）"
              }
            },
            required: ["spreadsheetId"]
          },
        },
        {
          name: "export_profile_to_sheets",
          description: "ユーザープロフィール情報をGoogle Sheetsに出力します",
          inputSchema: {
            type: "object",
            properties: {
              spreadsheetId: {
                type: "string",
                description: "出力先スプレッドシートID"
              },
              profile: {
                type: "object",
                description: "出力するプロフィールデータ（最後に取得したデータを使用）"
              },
              worksheetName: {
                type: "string",
                description: "ワークシート名",
                default: "Profiles"
              }
            },
            required: ["spreadsheetId"]
          },
        },
        {
          name: "list_available_sheets",
          description: "アクセス可能なGoogle Sheetsの一覧を表示します",
          inputSchema: {
            type: "object",
            properties: {
              maxResults: {
                type: "number",
                description: "最大表示件数",
                default: 10
              }
            }
          },
        }
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case "start_browser":
            return await this.startBrowser(
              args?.slowMo as number | undefined, 
              args?.viewportWidth as number | undefined, 
              args?.viewportHeight as number | undefined
            );
          
          case "navigate_to_user":
            return await this.navigateToUser(args?.username as string);
          
          case "check_login_status":
            return await this.checkLoginStatus();
          
          case "collect_tweets_naturally":
            return await this.collectTweetsNaturally(
              args?.maxTweets as number | undefined, 
              args?.scrollDelay as number | undefined, 
              args?.readingTime as number | undefined
            );
          
          case "get_user_profile":
            return await this.getUserProfile();
          
          case "search_tweets":
            return await this.searchTweets(
              args?.query as string, 
              args?.maxResults as number | undefined
            );
          
          case "pause_for_human_interaction":
            return await this.pauseForHumanInteraction(
              args?.message as string, 
              args?.pauseDuration as number | undefined
            );
          
          case "take_screenshot":
            return await this.takeScreenshot(args?.filename as string | undefined);
          
          case "close_browser":
            return await this.closeBrowser();

          // 🆕 Google Sheets関連ハンドラー
          case "setup_google_sheets":
            return await this.setupGoogleSheets();
          
          case "create_master_sheet":
            return await this.createMasterSheet(
              args?.title as string | undefined,
              args?.shareWithEmail as string | undefined
            );
          
          case "export_tweets_to_sheets":
            return await this.exportTweetsToSheets(
              args?.spreadsheetId as string,
              args?.tweets as Tweet[] | undefined,
              args?.worksheetName as string | undefined
            );
          
          case "export_profile_to_sheets":
            return await this.exportProfileToSheets(
              args?.spreadsheetId as string,
              args?.profile as UserProfile | undefined,
              args?.worksheetName as string | undefined
            );
          
          case "list_available_sheets":
            return await this.listAvailableSheets(args?.maxResults as number | undefined);
          
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error}`);
      }
    });
  }

  // 既存のブラウザ関連メソッド（省略せずに全て含める）
  private async startBrowser(slowMo: number = 200, width: number = 1366, height: number = 768) {
    try {
      this.browser = await puppeteer.launch({
        headless: false,
        slowMo: slowMo,
        args: [
          '--no-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-automation',
          '--disable-dev-shm-usage',
          `--window-size=${width},${height}`
        ]
      });

      this.page = await this.browser.newPage();
      
      // 人間らしいUser-Agent設定
      const userAgents = [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ];
      
      await this.page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);
      await this.page.setViewport({ width, height });
      
      // 自動化検出を回避
      await this.page.evaluateOnNewDocument(function() {
        // @ts-ignore: This code runs in browser context where navigator exists
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined
        });
      });

      return {
        content: [{
          type: "text",
          text: `🚀 ブラウザを起動しました（${width}x${height}、slowMo: ${slowMo}ms）`
        }]
      };
    } catch (error) {
      throw new Error(`ブラウザの起動に失敗しました: ${error}`);
    }
  }

  private async navigateToUser(username: string) {
    if (!this.page) {
      throw new Error("ブラウザが起動していません。先にstart_browserを実行してください。");
    }

    try {
      console.log(`🌐 ${username}のページに移動中...`);
      
      // ランダムな待機で人間らしさを演出
      await this.humanDelay(1000, 2000);
      
      await this.page.goto(`https://x.com/${username}`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // ページ読み込み後の人間らしい待機
      await this.humanDelay(2000, 4000);

      return {
        content: [{
          type: "text",
          text: `📱 @${username} のページに移動しました。ログイン状態を確認してください。`
        }]
      };
    } catch (error) {
      throw new Error(`ユーザーページへの移動に失敗しました: ${error}`);
    }
  }

  private async checkLoginStatus() {
    if (!this.page) {
      throw new Error("ブラウザが起動していません。");
    }

    try {
      // ログインボタンやログインモーダルの存在をチェック
      const loginElements = [
        '[data-testid="loginButton"]',
        '[data-testid="signupButton"]',
        'a[href="/login"]',
        'text="ログイン"',
        'text="Sign in"'
      ];

      let needsLogin = false;
      for (const selector of loginElements) {
        const element = await this.page.$(selector);
        if (element) {
          needsLogin = true;
          break;
        }
      }

      if (needsLogin) {
        return {
          content: [{
            type: "text",
            text: "🔐 ログインが必要です。pause_for_human_interactionツールを使用して手動ログインを待機してください。"
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: "✅ ログイン済みです。データ収集を開始できます。"
          }]
        };
      }
    } catch (error) {
      throw new Error(`ログイン状態の確認に失敗しました: ${error}`);
    }
  }

  private async collectTweetsNaturally(maxTweets: number = 20, scrollDelay: number = 3000, readingTime: number = 2000) {
    if (!this.page) {
      throw new Error("ブラウザが起動していません。");
    }

    this.isOperating = true;
    console.log("🤖 自動操作を開始します。人間によるカーソル操作はブロックされます。");

    const tweets: Tweet[] = [];
    let scrollCount = 0;
    const maxScrolls = Math.ceil(maxTweets / 3); // 1スクロールで約3ツイート取得想定

    try {
      for (let i = 0; i < maxScrolls && tweets.length < maxTweets; i++) {
        console.log(`📜 スクロール ${i + 1}/${maxScrolls}`);
        
        // 人間らしいマウス移動とスクロール
        await this.humanMouseMove();
        await this.humanScroll();
        
        // 読んでいる風の待機
        await this.humanDelay(readingTime, readingTime + 1000);
        
        // ツイート情報を取得
        const pageTweets = await this.extractTweets();
        
        // 新しいツイートのみ追加
        for (const tweet of pageTweets) {
          if (!tweets.find(t => t.id === tweet.id) && tweets.length < maxTweets) {
            tweets.push(tweet);
          }
        }
        
        // 次のスクロールまでの待機
        if (i < maxScrolls - 1) {
          await this.humanDelay(scrollDelay, scrollDelay + 1000);
        }
        
        scrollCount++;
      }

      this.isOperating = false;
      console.log("✋ 自動操作が完了しました。カーソル操作権が戻りました。");

      // 📊 収集したツイートを内部保存（export用）
      (this as any).lastCollectedTweets = tweets;

      return {
        content: [{
          type: "text",
          text: `📊 ${tweets.length}件のツイートを収集しました（${scrollCount}回スクロール）\n\n` +
                tweets.slice(0, 5).map((tweet, index) => 
                  `${index + 1}. [@${tweet.author}] ${tweet.text.substring(0, 80)}...\n` +
                  `   👍 ${tweet.likes} 🔄 ${tweet.retweets} 💬 ${tweet.replies} | ${tweet.timestamp}`
                ).join('\n\n') +
                `\n\n💡 export_tweets_to_sheets でスプレッドシートに出力できます`
        }]
      };
    } catch (error) {
      this.isOperating = false;
      throw new Error(`ツイート収集に失敗しました: ${error}`);
    }
  }

  private async getUserProfile(): Promise<any> {
    if (!this.page) {
      throw new Error("ブラウザが起動していません。");
    }

    try {
      const profile = await this.page.evaluate(() => {
        const getTextContent = (selector: string): string => {
          const element = document.querySelector(selector);
          return element?.textContent?.trim() || '';
        };

        const getNumber = (text: string): number => {
          const match = text.match(/[\d,]+/);
          return match ? parseInt(match[0].replace(/,/g, '')) : 0;
        };

        // プロフィール情報を取得
        const displayName = getTextContent('[data-testid="UserName"] span');
        const username = getTextContent('[data-testid="UserName"] [dir="ltr"]')?.replace('@', '');
        const bio = getTextContent('[data-testid="UserDescription"]');
        
        // フォロワー等の数値情報
        const followingElement = document.querySelector('a[href$="/following"] span');
        const followersElement = document.querySelector('a[href$="/verified_followers"] span, a[href$="/followers"] span');
        
        const following = followingElement ? getNumber(followingElement.textContent || '') : 0;
        const followers = followersElement ? getNumber(followersElement.textContent || '') : 0;

        return {
          username: username || '',
          displayName: displayName || '',
          bio: bio || '',
          followers: followers,
          following: following,
          verified: !!document.querySelector('[data-testid="icon-verified"]'),
          tweets: 0 // Placeholder for tweet count, will be updated if available
        };
      });

      // 📊 プロフィールを内部保存（export用）
      (this as any).lastCollectedProfile = profile;

      return {
        content: [{
          type: "text",
          text: `👤 ユーザープロフィール情報\n\n` +
                `名前: ${profile.displayName}\n` +
                `ユーザー名: @${profile.username}\n` +
                `認証済み: ${profile.verified ? '✅' : '❌'}\n` +
                `フォロワー: ${profile.followers.toLocaleString()}人\n` +
                `フォロー中: ${profile.following.toLocaleString()}人\n` +
                `自己紹介: ${profile.bio}\n\n` +
                `💡 export_profile_to_sheets でスプレッドシートに出力できます`
        }]
      };
    } catch (error) {
      throw new Error(`プロフィール取得に失敗しました: ${error}`);
    }
  }

  private async searchTweets(query: string, maxResults: number = 10) {
    if (!this.page) {
      throw new Error("ブラウザが起動していません。");
    }

    try {
      // 検索ページに移動
      await this.page.goto(`https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=live`);
      await this.humanDelay(3000, 5000);

      // ツイート収集
      const result = await this.collectTweetsNaturally(maxResults, 2000, 1500);
      
      return {
        content: [{
          type: "text",
          text: `🔍 「${query}」の検索結果: ${result.content[0].text}`
        }]
      };
    } catch (error) {
      throw new Error(`検索に失敗しました: ${error}`);
    }
  }

  private async pauseForHumanInteraction(message: string, pauseDuration: number = 30): Promise<any> {
    this.isOperating = false;
    
    console.log(`\n🔔 ${message}`);
    console.log(`⏰ ${pauseDuration}秒間、手動操作が可能です。`);
    console.log('操作完了後、Enterキーを押してください...');
    
    return new Promise((resolve) => {
      // タイムアウト設定
      const timeout = setTimeout(() => {
        console.log('\n⏱️ タイムアウトしました。自動で継続します。');
        resolve({
          content: [{
            type: "text",
            text: `⏱️ ${pauseDuration}秒のタイムアウトが発生しました。操作を継続します。`
          }]
        });
      }, pauseDuration * 1000);

      // 手動入力待機
      this.rl.question('', () => {
        clearTimeout(timeout);
        resolve({
          content: [{
            type: "text",
            text: "✅ 手動操作が完了しました。自動操作を再開します。"
          }]
        });
      });
    });
  }

  private async takeScreenshot(filename: string | undefined = "x_screenshot.png"): Promise<any> {
    if (!this.page) {
      throw new Error("ブラウザが起動していません。");
    }

    try {
      const finalFilename = filename || "x_screenshot.png";
      // Ensure filename has proper extension
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

  private async closeBrowser(): Promise<any> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.isOperating = false;
    }

    return {
      content: [{
        type: "text",
        text: "👋 ブラウザを終了しました。"
      }]
    };
  }

  // 🆕 Google Sheets関連メソッド

  private async setupGoogleSheets(): Promise<any> {
    try {
      // Google認証の初期化
      this.auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      // Sheets APIクライアントの初期化
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });

      // 認証テスト
      const authClient = await this.auth.getClient();
      
      return {
        content: [{
          type: "text",
          text: `✅ Google Sheets APIの設定が完了しました\n\n` +
                `🔐 認証: Application Default Credentials\n` +
                `📊 スコープ: spreadsheets (読み書き可能)\n` +
                `🚀 準備完了: create_master_sheet でスプレッドシート作成可能`
        }]
      };
    } catch (error) {
      throw new Error(`Google Sheets API設定に失敗しました: ${error}`);
    }
  }

  private async createMasterSheet(title: string = "X Data Collection", shareWithEmail?: string): Promise<any> {
    try {
      if (!this.sheets) {
        await this.setupGoogleSheets();
      }

      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const actualTitle = title || `X Data Collection - ${today}`;

      // スプレッドシート作成
      const response = await this.sheets!.spreadsheets.create({
        requestBody: {
          properties: {
            title: actualTitle,
            locale: 'ja_JP',
            timeZone: 'Asia/Tokyo'
          },
          sheets: [
            {
              properties: {
                title: 'Tweets',
                gridProperties: {
                  rowCount: 1000,
                  columnCount: 10
                }
              }
            },
            {
              properties: {
                title: 'Profiles',
                gridProperties: {
                  rowCount: 100,
                  columnCount: 8
                }
              }
            },
            {
              properties: {
                title: today,
                gridProperties: {
                  rowCount: 1000,
                  columnCount: 10
                }
              }
            }
          ]
        }
      });

      const spreadsheetId = response.data.spreadsheetId!;
      const spreadsheetUrl = response.data.spreadsheetUrl!;

      // ヘッダー行を設定
      await this.setupSheetHeaders(spreadsheetId);

      // メール共有設定
      if (shareWithEmail && this.auth) {
        try {
          const drive = google.drive({ version: 'v3', auth: this.auth });
          await drive.permissions.create({
            fileId: spreadsheetId,
            requestBody: {
              role: 'editor',
              type: 'user',
              emailAddress: shareWithEmail
            }
          });
        } catch (shareError) {
          console.warn('メール共有に失敗しました:', shareError);
        }
      }

      return {
        content: [{
          type: "text",
          text: `📊 マスタースプレッドシートを作成しました\n\n` +
                `📄 タイトル: ${actualTitle}\n` +
                `🆔 ID: ${spreadsheetId}\n` +
                `🔗 URL: ${spreadsheetUrl}\n` +
                `📋 ワークシート: Tweets, Profiles, ${today}\n` +
                `${shareWithEmail ? `📧 共有設定: ${shareWithEmail}\n` : ''}` +
                `\n💡 このIDを使ってツイートやプロフィールをエクスポートできます`
        }]
      };
    } catch (error) {
      throw new Error(`マスタースプレッドシート作成に失敗しました: ${error}`);
    }
  }

  private async setupSheetHeaders(spreadsheetId: string): Promise<void> {
    if (!this.sheets) return;

    const requests = [
      // Tweets シートのヘッダー
      {
        updateCells: {
          range: {
            sheetId: 0, // Tweets sheet
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: 10
          },
          rows: [{
            values: [
              { userEnteredValue: { stringValue: 'タイムスタンプ' } },
              { userEnteredValue: { stringValue: 'ユーザー名' } },
              { userEnteredValue: { stringValue: 'ツイート内容' } },
              { userEnteredValue: { stringValue: 'いいね数' } },
              { userEnteredValue: { stringValue: 'リツイート数' } },
              { userEnteredValue: { stringValue: '返信数' } },
              { userEnteredValue: { stringValue: 'リツイート?' } },
              { userEnteredValue: { stringValue: '元ユーザー' } },
              { userEnteredValue: { stringValue: 'URL' } },
              { userEnteredValue: { stringValue: '収集日時' } }
            ]
          }],
          fields: 'userEnteredValue'
        }
      },
      // Profiles シートのヘッダー
      {
        updateCells: {
          range: {
            sheetId: 1, // Profiles sheet
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: 8
          },
          rows: [{
            values: [
              { userEnteredValue: { stringValue: 'ユーザー名' } },
              { userEnteredValue: { stringValue: '表示名' } },
              { userEnteredValue: { stringValue: 'フォロワー数' } },
              { userEnteredValue: { stringValue: 'フォロー数' } },
              { userEnteredValue: { stringValue: '認証済み' } },
              { userEnteredValue: { stringValue: '自己紹介' } },
              { userEnteredValue: { stringValue: 'ツイート数' } },
              { userEnteredValue: { stringValue: '収集日時' } }
            ]
          }],
          fields: 'userEnteredValue'
        }
      }
    ];

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests }
    });
  }

  private async exportTweetsToSheets(spreadsheetId: string, tweets?: Tweet[], worksheetName?: string): Promise<any> {
    try {
      if (!this.sheets) {
        await this.setupGoogleSheets();
      }

      // ツイートデータを取得（引数またはlast collected）
      const tweetsToExport = tweets || (this as any).lastCollectedTweets;
      if (!tweetsToExport || tweetsToExport.length === 0) {
        throw new Error('エクスポートするツイートデータがありません。先にcollect_tweets_naturallyを実行してください。');
      }

      // ワークシート名の決定（デフォルトは今日の日付）
      const today = new Date().toISOString().split('T')[0];
      const targetWorksheet = worksheetName || today;

      // ワークシートの存在確認・作成
      await this.ensureWorksheetExists(spreadsheetId, targetWorksheet);

      // 既存データの行数を取得
      const existingData = await this.sheets!.spreadsheets.values.get({
        spreadsheetId,
        range: `${targetWorksheet}!A:A`
      });

      const existingRowCount = existingData.data.values?.length || 0;
      const isFirstData = existingRowCount === 0;
      
      // データ変換
      const rows = tweetsToExport.map((tweet: Tweet) => [
        tweet.timestamp,
        tweet.author,
        tweet.text,
        tweet.likes,
        tweet.retweets,
        tweet.replies,
        tweet.isRetweet ? 'はい' : 'いいえ',
        tweet.originalAuthor || '',
        `https://x.com/${tweet.author}`,
        new Date().toISOString()
      ]);

      let values: any[][];
      let startRow: number;

      if (isFirstData) {
        // 初回データ：ヘッダー行を含める
        values = [
          ['タイムスタンプ', 'ユーザー名', 'ツイート内容', 'いいね数', 'リツイート数', '返信数', 'リツイート?', '元ユーザー', 'URL', '収集日時'],
          ...rows
        ];
        startRow = 1;
      } else {
        // 追記データ：ヘッダー行なし、データのみ追記
        values = rows;
        startRow = existingRowCount + 1;
      }

      // シートに書き込み（追記）
      await this.sheets!.spreadsheets.values.update({
        spreadsheetId,
        range: `${targetWorksheet}!A${startRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values }
      });

      // 合計行数を計算
      const totalRows = isFirstData ? tweetsToExport.length + 1 : existingRowCount + tweetsToExport.length;
      const newDataCount = tweetsToExport.length;

      return {
        content: [{
          type: "text",
          text: `📊 ツイートをスプレッドシートに${isFirstData ? '出力' : '追記'}しました\n\n` +
                `📄 スプレッドシートID: ${spreadsheetId}\n` +
                `📋 ワークシート: ${targetWorksheet}\n` +
                `📝 ${isFirstData ? '出力' : '追記'}件数: ${newDataCount}件\n` +
                `📈 合計データ数: ${totalRows - 1}件 (ヘッダー除く)\n` +
                `📍 追記位置: ${startRow}行目から\n` +
                `🔗 URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}\n\n` +
                `✅ データ形式:\n` +
                `- タイムスタンプ、ユーザー名、ツイート内容\n` +
                `- エンゲージメント数（いいね、RT、返信）\n` +
                `- メタデータ（リツイート判定、URL、収集日時）\n\n` +
                `${isFirstData ? '🆕 新規作成' : '➕ データ追記完了'}`
        }]
      };
    } catch (error) {
      throw new Error(`ツイートのスプレッドシート出力に失敗しました: ${error}`);
    }
  }

  private async exportProfileToSheets(spreadsheetId: string, profile?: UserProfile, worksheetName: string = "Profiles"): Promise<any> {
    try {
      if (!this.sheets) {
        await this.setupGoogleSheets();
      }

      // プロフィールデータを取得
      const profileToExport = profile || (this as any).lastCollectedProfile;
      if (!profileToExport) {
        throw new Error('エクスポートするプロフィールデータがありません。先にget_user_profileを実行してください。');
      }

      // ワークシートの存在確認・作成
      await this.ensureWorksheetExists(spreadsheetId, worksheetName);

      // 既存データに追記するため、現在の行数を取得
      const existingData = await this.sheets!.spreadsheets.values.get({
        spreadsheetId,
        range: `${worksheetName}!A:A`
      });

      const nextRow = (existingData.data.values?.length || 0) + 1;
      
      // ヘッダーが存在しない場合は追加
      if (nextRow === 1) {
        const headerValues = [['ユーザー名', '表示名', 'フォロワー数', 'フォロー数', '認証済み', '自己紹介', 'ツイート数', '収集日時']];
        await this.sheets!.spreadsheets.values.update({
          spreadsheetId,
          range: `${worksheetName}!A1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: headerValues }
        });
      }

      // プロフィールデータを追加
      const profileRow = [
        profileToExport.username,
        profileToExport.displayName,
        profileToExport.followers,
        profileToExport.following,
        profileToExport.verified ? '認証済み' : '未認証',
        profileToExport.bio,
        profileToExport.tweets,
        new Date().toISOString()
      ];

      const targetRow = nextRow === 1 ? 2 : nextRow;
      await this.sheets!.spreadsheets.values.update({
        spreadsheetId,
        range: `${worksheetName}!A${targetRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [profileRow] }
      });

      return {
        content: [{
          type: "text",
          text: `👤 プロフィールをスプレッドシートに出力しました\n\n` +
                `📄 スプレッドシートID: ${spreadsheetId}\n` +
                `📋 ワークシート: ${worksheetName}\n` +
                `👨‍💼 ユーザー: @${profileToExport.username} (${profileToExport.displayName})\n` +
                `📊 データ: ${profileToExport.followers.toLocaleString()}フォロワー\n` +
                `🔗 URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}\n\n` +
                `✅ 出力項目:\n` +
                `- 基本情報（ユーザー名、表示名、認証状態）\n` +
                `- フォロー関係（フォロワー数、フォロー数）\n` +
                `- プロフィール（自己紹介、ツイート数、収集日時）`
        }]
      };
    } catch (error) {
      throw new Error(`プロフィールのスプレッドシート出力に失敗しました: ${error}`);
    }
  }

  private async listAvailableSheets(maxResults: number = 10): Promise<any> {
    try {
      if (!this.sheets) {
        await this.setupGoogleSheets();
      }

      // Google Drive APIでスプレッドシートを検索
      if (!this.auth) {
        await this.setupGoogleSheets();
      }
      
      // Ensure auth is not null before creating the drive client
      if (!this.auth) {
        throw new Error('Failed to initialize Google authentication');
      }
      
      const drive = google.drive({ version: 'v3', auth: this.auth });
      const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet'",
        pageSize: maxResults,
        fields: 'files(id, name, webViewLink, modifiedTime)',
        orderBy: 'modifiedTime desc'
      });

      const files = response.data.files || [];
      
      if (files.length === 0) {
        return {
          content: [{
            type: "text",
            text: `📄 アクセス可能なスプレッドシートが見つかりませんでした\n\n` +
                  `💡 create_master_sheet で新しいスプレッドシートを作成できます`
          }]
        };
      }

      const sheetsList = files.map((file, index) => {
        const modifiedDate = file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString('ja-JP') : '不明';
        return `${index + 1}. ${file.name}\n` +
               `   ID: ${file.id}\n` +
               `   更新: ${modifiedDate}\n` +
               `   URL: ${file.webViewLink}`;
      }).join('\n\n');

      return {
        content: [{
          type: "text",
          text: `📊 アクセス可能なスプレッドシート一覧 (${files.length}件)\n\n` +
                sheetsList +
                `\n\n💡 スプレッドシートIDをコピーして export_tweets_to_sheets や export_profile_to_sheets で使用できます`
        }]
      };
    } catch (error) {
      throw new Error(`スプレッドシート一覧取得に失敗しました: ${error}`);
    }
  }

  private async ensureWorksheetExists(spreadsheetId: string, worksheetName: string): Promise<void> {
    if (!this.sheets) return;

    try {
      // スプレッドシート情報を取得
      const response = await this.sheets.spreadsheets.get({ spreadsheetId });
      const existingSheets = response.data.sheets || [];
      
      // ワークシートが存在するかチェック
      const worksheetExists = existingSheets.some(sheet => 
        sheet.properties?.title === worksheetName
      );

      if (!worksheetExists) {
        // ワークシートを作成
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{
              addSheet: {
                properties: {
                  title: worksheetName,
                  gridProperties: {
                    rowCount: 1000,
                    columnCount: 10
                  }
                }
              }
            }]
          }
        });
      }
    } catch (error) {
      throw new Error(`ワークシート確認・作成に失敗しました: ${error}`);
    }
  }

  // 既存のヘルパーメソッド

  private async humanDelay(min: number, max: number) {
    const delay = Math.random() * (max - min) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private async humanMouseMove() {
    if (!this.page) return;

    // ランダムな座標に少しマウスを移動
    const viewport = this.page.viewport();
    if (viewport) {
      const x = Math.random() * viewport.width * 0.8 + viewport.width * 0.1;
      const y = Math.random() * viewport.height * 0.8 + viewport.height * 0.1;
      
      await this.page.mouse.move(x, y, { steps: Math.floor(Math.random() * 5) + 3 });
      await this.humanDelay(100, 300);
    }
  }

  private async humanScroll() {
    if (!this.page) return;

    // 人間らしいスクロール（段階的に）
    const scrollSteps = Math.floor(Math.random() * 3) + 2; // 2-4回に分けてスクロール
    const totalScroll = Math.random() * 600 + 400; // 400-1000px
    const stepScroll = totalScroll / scrollSteps;

    for (let i = 0; i < scrollSteps; i++) {
      await this.page.evaluate((scroll: number) => {
        (window as any).scrollBy(0, scroll);
      }, stepScroll);
      
      await this.humanDelay(100, 200);
    }
  }

  private async extractTweets(): Promise<Tweet[]> {
    if (!this.page) return [];

    return this.page.evaluate(() => {
      const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
      const tweets: Array<{
        id: string;
        text: string;
        timestamp: string;
        author: string;
        likes: number;
        retweets: number;
        replies: number;
        isRetweet: boolean;
        originalAuthor?: string;
      }> = [];

      tweetElements.forEach((element: Element, index: number) => {
        try {
          const textElement = element.querySelector('[data-testid="tweetText"]');
          const timeElement = element.querySelector('time');
          const authorElement = element.querySelector('[data-testid="User-Name"] a[role="link"]');
          
          // エンゲージメント数を取得
          const likeElement = element.querySelector('[data-testid="like"] span');
          const retweetElement = element.querySelector('[data-testid="retweet"] span');
          const replyElement = element.querySelector('[data-testid="reply"] span');

          const text = textElement?.textContent || '';
          const timestamp = timeElement?.getAttribute('datetime') || '';
          const authorHref = authorElement?.getAttribute('href') || '';
          const author = authorHref.replace('/', '').replace('/', '');

          // 数値の抽出（K, M表記も考慮）
          const parseEngagement = (text: string) => {
            if (!text) return 0;
            const match = text.match(/([\d,]+\.?\d*)\s*([KMB]?)/i);
            if (!match) return 0;
            
            let num = parseFloat(match[1].replace(/,/g, ''));
            const suffix = match[2].toUpperCase();
            
            if (suffix === 'K') num *= 1000;
            else if (suffix === 'M') num *= 1000000;
            else if (suffix === 'B') num *= 1000000000;
            
            return Math.floor(num);
          };

          tweets.push({
            id: `tweet_${Date.now()}_${index}`, // 簡易ID
            text: text,
            timestamp: timestamp,
            author: author,
            likes: parseEngagement(likeElement?.textContent || '0'),
            retweets: parseEngagement(retweetElement?.textContent || '0'),
            replies: parseEngagement(replyElement?.textContent || '0'),
            isRetweet: !!element.querySelector('[data-testid="socialContext"]'),
            originalAuthor: element.querySelector('[data-testid="socialContext"] a')?.textContent || undefined
          });
        } catch (error) {
          console.error('Tweet extraction error:', error);
        }
      });

      return tweets;
    }) as Promise<Tweet[]>;
  }

  private async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
    this.rl.close();
    process.exit(0);
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("X Collector MCP server running on stdio");
  }
}

const server = new XCollectorServer();
server.run().catch(console.error);
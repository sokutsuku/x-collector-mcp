// src/tools/handlers/sheets-handler.ts
// Google Sheets関連ツールの専用ハンドラー

import { SheetsService } from '../../services/sheets.js';
import { Tweet, UserProfile, MCPResponse } from '../../types/interfaces.js';

export class SheetsToolHandler {
  private sheetsService: SheetsService;

  constructor(sheetsService: SheetsService) {
    this.sheetsService = sheetsService;
  }

  /**
   * Google Sheets関連のツール定義
   */
  getToolDefinitions() {
    return [
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
    ];
  }

  /**
   * Google Sheets関連ツールの実行ハンドラー
   */
  async handleTool(
    toolName: string, 
    args: any,
    lastCollectedTweets: Tweet[],
    lastCollectedProfile: UserProfile | null
  ): Promise<MCPResponse | null> {
    switch (toolName) {
      case "setup_google_sheets":
        return await this.handleSetupGoogleSheets();
      
      case "create_master_sheet":
        return await this.handleCreateMasterSheet(
          args?.title as string | undefined,
          args?.shareWithEmail as string | undefined
        );
      
      case "export_tweets_to_sheets":
        return await this.handleExportTweetsToSheets(
          args?.spreadsheetId as string,
          args?.tweets as Tweet[] | undefined || lastCollectedTweets,
          args?.worksheetName as string | undefined
        );
      
      case "export_profile_to_sheets":
        return await this.handleExportProfileToSheets(
          args?.spreadsheetId as string,
          args?.profile as UserProfile | undefined || lastCollectedProfile,
          args?.worksheetName as string | undefined
        );
      
      case "list_available_sheets":
        return await this.handleListAvailableSheets(args?.maxResults as number | undefined);
      
      default:
        return null;
    }
  }

  // ===============================================
  // 実装メソッド
  // ===============================================

  private async handleSetupGoogleSheets(): Promise<MCPResponse> {
    return await this.sheetsService.setupGoogleSheets();
  }

  private async handleCreateMasterSheet(
    title?: string,
    shareWithEmail?: string
  ): Promise<MCPResponse> {
    return await this.sheetsService.createMasterSheet(title, shareWithEmail);
  }

  private async handleExportTweetsToSheets(
    spreadsheetId: string,
    tweets: Tweet[],
    worksheetName?: string
  ): Promise<MCPResponse> {
    if (!tweets || tweets.length === 0) {
      throw new Error('エクスポートするツイートデータがありません。先にcollect_tweets_naturallyを実行してください。');
    }

    return await this.sheetsService.exportTweetsToSheets(
      spreadsheetId,
      tweets,
      worksheetName
    );
  }

  private async handleExportProfileToSheets(
    spreadsheetId: string,
    profile: UserProfile | null,
    worksheetName?: string
  ): Promise<MCPResponse> {
    if (!profile) {
      throw new Error('エクスポートするプロフィールデータがありません。先にget_user_profileを実行してください。');
    }

    return await this.sheetsService.exportProfileToSheets(
      spreadsheetId,
      profile,
      worksheetName
    );
  }

  private async handleListAvailableSheets(maxResults: number = 10): Promise<MCPResponse> {
    return await this.sheetsService.listAvailableSheets(maxResults);
  }

  /**
   * サービスの状態確認
   */
  isSheetsReady(): boolean {
    return this.sheetsService.isReady();
  }
}
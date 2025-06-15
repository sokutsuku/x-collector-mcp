// src/services/sheets.ts
// Google Sheets操作の専用サービス（追記機能修正版）

import { GoogleAuth } from 'google-auth-library';
import { sheets_v4, google } from 'googleapis';
import { 
  Tweet, 
  UserProfile, 
  MCPResponse, 
  ExportResult, 
  SheetInfo,
  WorksheetData 
} from '../types/interfaces.js';

export class SheetsService {
  private auth: GoogleAuth | null = null;
  private sheets: sheets_v4.Sheets | null = null;

  /**
   * Google Sheets APIの初期設定と認証確認
   */
  async setupGoogleSheets(): Promise<MCPResponse> {
    try {
      // Google認証の初期化
      this.auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
      });

      // Sheets APIクライアントの初期化
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });

      // 認証テスト
      await this.auth.getClient();
      
      return {
        content: [{
          type: "text",
          text: `✅ Google Sheets APIの設定が完了しました\n\n` +
                `🔐 認証: Application Default Credentials\n` +
                `📊 スコープ: spreadsheets, drive (読み書き可能)\n` +
                `🚀 準備完了: create_master_sheet でスプレッドシート作成可能`
        }]
      };
    } catch (error) {
      throw new Error(`Google Sheets API設定に失敗しました: ${error}`);
    }
  }

  /**
   * X データ保存用のマスタースプレッドシートを作成
   */
  async createMasterSheet(title?: string, shareWithEmail?: string): Promise<MCPResponse> {
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
      // await this.setupSheetHeaders(spreadsheetId);

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

  /**
   * ツイートをGoogle Sheetsに出力（修正版：正しい追記機能）
   */
  async exportTweetsToSheets(
    spreadsheetId: string, 
    tweets: Tweet[], 
    worksheetName?: string
  ): Promise<MCPResponse> {
    try {
      if (!this.sheets) {
        await this.setupGoogleSheets();
      }

      if (!tweets || tweets.length === 0) {
        throw new Error('エクスポートするツイートデータがありません。');
      }

      // ワークシート名の決定（デフォルトは今日の日付）
      const today = new Date().toISOString().split('T')[0];
      const targetWorksheet = worksheetName || today;

      // ワークシートの存在確認・作成
      await this.ensureWorksheetExists(spreadsheetId, targetWorksheet);

      // 🔧 修正: 既存データの正確な行数を取得
      const existingData = await this.sheets!.spreadsheets.values.get({
        spreadsheetId,
        range: `${targetWorksheet}!A:A`
      });

      const existingRowCount = existingData.data.values?.length || 0;
      const isFirstData = existingRowCount === 0;
      
      // データ変換
      const dataRows = tweets.map((tweet: Tweet) => [
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

      let startRow: number;
      let values: any[][];

      if (isFirstData) {
        // 初回データ：ヘッダー行を含める
        const headers = ['タイムスタンプ', 'ユーザー名', 'ツイート内容', 'いいね数', 'リツイート数', '返信数', 'リツイート?', '元ユーザー', 'URL', '収集日時'];
        values = [headers, ...dataRows];
        startRow = 1;
      } else {
        // 🔧 修正: 追記データ - 既存の最後の行の次から開始
        values = dataRows;
        startRow = existingRowCount + 1;
      }

      // 🔧 修正: 正確な範囲指定で書き込み
      const range = `${targetWorksheet}!A${startRow}:J${startRow + values.length - 1}`;
      
      await this.sheets!.spreadsheets.values.update({
        spreadsheetId,
        range: range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values }
      });

      // 結果計算
      const newDataCount = tweets.length;
      const totalRows = isFirstData ? newDataCount + 1 : existingRowCount + newDataCount;

      return {
        content: [{
          type: "text",
          text: `📊 ツイートをスプレッドシートに${isFirstData ? '出力' : '追記'}しました\n\n` +
                `📄 スプレッドシートID: ${spreadsheetId}\n` +
                `📋 ワークシート: ${targetWorksheet}\n` +
                `📝 ${isFirstData ? '出力' : '追記'}件数: ${newDataCount}件\n` +
                `📈 合計データ数: ${totalRows - 1}件 (ヘッダー除く)\n` +
                `📍 書き込み範囲: ${range}\n` +
                `🔗 URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}\n\n` +
                `✅ データ形式:\n` +
                `- タイムスタンプ、ユーザー名、ツイート内容\n` +
                `- エンゲージメント数（いいね、RT、返信）\n` +
                `- メタデータ（リツイート判定、URL、収集日時）\n\n` +
                `${isFirstData ? '🆕 新規作成完了' : '➕ データ追記完了'}`
        }]
      };
    } catch (error) {
      throw new Error(`ツイートのスプレッドシート出力に失敗しました: ${error}`);
    }
  }

  /**
   * プロフィールをGoogle Sheetsに出力
   */
  async exportProfileToSheets(
    spreadsheetId: string, 
    profile: UserProfile, 
    worksheetName: string = "Profiles"
  ): Promise<MCPResponse> {
    try {
      if (!this.sheets) {
        await this.setupGoogleSheets();
      }

      if (!profile) {
        throw new Error('エクスポートするプロフィールデータがありません。');
      }

      // ワークシートの存在確認・作成
      await this.ensureWorksheetExists(spreadsheetId, worksheetName);

      // 🔧 修正: 既存データの正確な行数を取得
      const existingData = await this.sheets!.spreadsheets.values.get({
        spreadsheetId,
        range: `${worksheetName}!A:A`
      });

      const existingRowCount = existingData.data.values?.length || 0;
      const isFirstData = existingRowCount === 0;
      
      // プロフィールデータ行
      const profileRow = [
        profile.username,
        profile.displayName,
        profile.followers,
        profile.following,
        profile.verified ? '認証済み' : '未認証',
        profile.bio,
        profile.tweets,
        new Date().toISOString()
      ];

      let values: any[][];
      let startRow: number;

      if (isFirstData) {
        // 初回データ：ヘッダー行を含める
        const headers = ['ユーザー名', '表示名', 'フォロワー数', 'フォロー数', '認証済み', '自己紹介', 'ツイート数', '収集日時'];
        values = [headers, profileRow];
        startRow = 1;
      } else {
        // 追記データ
        values = [profileRow];
        startRow = existingRowCount + 1;
      }

      // 🔧 修正: 正確な範囲指定で書き込み
      const range = `${worksheetName}!A${startRow}:H${startRow + values.length - 1}`;

      await this.sheets!.spreadsheets.values.update({
        spreadsheetId,
        range: range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values }
      });

      return {
        content: [{
          type: "text",
          text: `👤 プロフィールをスプレッドシートに${isFirstData ? '出力' : '追記'}しました\n\n` +
                `📄 スプレッドシートID: ${spreadsheetId}\n` +
                `📋 ワークシート: ${worksheetName}\n` +
                `👨‍💼 ユーザー: @${profile.username} (${profile.displayName})\n` +
                `📊 データ: ${profile.followers.toLocaleString()}フォロワー\n` +
                `📍 書き込み範囲: ${range}\n` +
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

  /**
   * アクセス可能なGoogle Sheetsの一覧を表示
   */
  async listAvailableSheets(maxResults: number = 10): Promise<MCPResponse> {
    try {
      if (!this.sheets || !this.auth) {
        await this.setupGoogleSheets();
      }

      // Google Drive APIでスプレッドシートを検索
      const drive = google.drive({ version: 'v3', auth: this.auth! });
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
        const modifiedDate = file.modifiedTime ? 
          new Date(file.modifiedTime).toLocaleDateString('ja-JP') : '不明';
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

  /**
   * ワークシートの存在確認・作成
   */
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
        console.log(`📋 ワークシート「${worksheetName}」を作成しました`);
      }
    } catch (error) {
      throw new Error(`ワークシート確認・作成に失敗しました: ${error}`);
    }
  }

  /**
   * 初期ヘッダー行の設定
   */
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

  /**
   * サービスの状態確認
   */
  isReady(): boolean {
    return this.auth !== null && this.sheets !== null;
  }
}
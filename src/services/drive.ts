// src/services/drive.ts
// Google Drive操作の専用サービス（共有ドライブ対応）

import { GoogleAuth } from 'google-auth-library';
import { drive_v3, google } from 'googleapis';
import { MCPResponse } from '../types/interfaces.js';

export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  webViewLink?: string;
  createdTime?: string;
  modifiedTime?: string;
}

export interface SharedDriveInfo {
  id: string;
  name: string;
  createdTime?: string;
}

export class DriveService {
  private auth: GoogleAuth | null = null;
  private drive: drive_v3.Drive | null = null;

  /**
   * Google Drive APIの初期設定
   */
  async setupGoogleDrive(): Promise<MCPResponse> {
    try {
      // Google認証の初期化（既存の認証を再利用可能）
      this.auth = new GoogleAuth({
        scopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/spreadsheets'
        ]
      });

      // Drive APIクライアントの初期化
      this.drive = google.drive({ version: 'v3', auth: this.auth });

      // 認証テスト
      await this.auth.getClient();
      
      return {
        content: [{
          type: "text",
          text: `✅ Google Drive APIの設定が完了しました\n\n` +
                `🔐 認証: Application Default Credentials\n` +
                `📁 スコープ: drive, drive.file, spreadsheets\n` +
                `🚀 準備完了: 共有ドライブとフォルダ操作が可能`
        }]
      };
    } catch (error) {
      throw new Error(`Google Drive API設定に失敗しました: ${error}`);
    }
  }

  /**
   * 共有ドライブの一覧を取得
   */
  async listSharedDrives(): Promise<MCPResponse> {
    try {
      if (!this.drive) {
        await this.setupGoogleDrive();
      }

      const response = await this.drive!.drives.list({
        pageSize: 20,
        fields: 'drives(id, name, createdTime)'
      });

      const drives = response.data.drives || [];
      
      if (drives.length === 0) {
        return {
          content: [{
            type: "text",
            text: `📁 アクセス可能な共有ドライブが見つかりませんでした\n\n` +
                  `💡 共有ドライブへのアクセス権限を確認してください`
          }]
        };
      }

      const drivesList = drives.map((drive, index) => {
        const createdDate = drive.createdTime ? 
          new Date(drive.createdTime).toLocaleDateString('ja-JP') : '不明';
        return `${index + 1}. ${drive.name}\n` +
               `   ID: ${drive.id}\n` +
               `   作成日: ${createdDate}`;
      }).join('\n\n');

      return {
        content: [{
          type: "text",
          text: `📁 アクセス可能な共有ドライブ一覧 (${drives.length}件)\n\n` +
                drivesList +
                `\n\n💡 ドライブIDをコピーして他の操作で使用できます`
        }]
      };
    } catch (error) {
      throw new Error(`共有ドライブ一覧取得に失敗しました: ${error}`);
    }
  }

  /**
   * 指定した共有ドライブ内のフォルダ一覧を取得
   */
  async listFoldersInSharedDrive(driveId: string, parentFolderId?: string): Promise<MCPResponse> {
    try {
      if (!this.drive) {
        await this.setupGoogleDrive();
      }

      // 検索クエリを構築
      let query = "mimeType='application/vnd.google-apps.folder' and trashed=false";
      if (parentFolderId) {
        query += ` and '${parentFolderId}' in parents`;
      }

      const response = await this.drive!.files.list({
        driveId: driveId,
        corpora: 'drive',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        q: query,
        pageSize: 50,
        fields: 'files(id, name, parents, createdTime, modifiedTime, webViewLink)',
        orderBy: 'name'
      });

      const folders = response.data.files || [];
      
      if (folders.length === 0) {
        return {
          content: [{
            type: "text",
            text: `📁 指定した場所にフォルダが見つかりませんでした\n\n` +
                  `🆔 共有ドライブID: ${driveId}\n` +
                  `📂 親フォルダID: ${parentFolderId || 'ルート'}\n\n` +
                  `💡 create_folder_in_shared_drive でフォルダを作成できます`
          }]
        };
      }

      const foldersList = folders.map((folder, index) => {
        const createdDate = folder.createdTime ? 
          new Date(folder.createdTime).toLocaleDateString('ja-JP') : '不明';
        return `${index + 1}. ${folder.name}\n` +
               `   ID: ${folder.id}\n` +
               `   作成日: ${createdDate}\n` +
               `   URL: ${folder.webViewLink}`;
      }).join('\n\n');

      return {
        content: [{
          type: "text",
          text: `📁 フォルダ一覧 (${folders.length}件)\n\n` +
                `🆔 共有ドライブID: ${driveId}\n` +
                `📂 親フォルダ: ${parentFolderId || 'ルート'}\n\n` +
                foldersList +
                `\n\n💡 フォルダIDをコピーして他の操作で使用できます`
        }]
      };
    } catch (error) {
      throw new Error(`フォルダ一覧取得に失敗しました: ${error}`);
    }
  }

  /**
   * 共有ドライブ内に新しいフォルダを作成
   */
  async createFolderInSharedDrive(
    driveId: string, 
    folderName: string, 
    parentFolderId?: string
  ): Promise<MCPResponse> {
    try {
      if (!this.drive) {
        await this.setupGoogleDrive();
      }

      const fileMetadata: any = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentFolderId ? [parentFolderId] : undefined
      };

      const response = await this.drive!.files.create({
        requestBody: fileMetadata,
        supportsAllDrives: true,
        fields: 'id, name, parents, webViewLink, createdTime'
      });

      const folder = response.data;

      return {
        content: [{
          type: "text",
          text: `📁 フォルダを作成しました\n\n` +
                `📂 フォルダ名: ${folder.name}\n` +
                `🆔 フォルダID: ${folder.id}\n` +
                `🆔 共有ドライブID: ${driveId}\n` +
                `📂 親フォルダID: ${parentFolderId || 'ルート'}\n` +
                `🔗 URL: ${folder.webViewLink}\n` +
                `📅 作成日時: ${folder.createdTime ? new Date(folder.createdTime).toLocaleString('ja-JP') : '不明'}\n\n` +
                `✅ フォルダ作成完了！`
        }]
      };
    } catch (error) {
      throw new Error(`フォルダ作成に失敗しました: ${error}`);
    }
  }

  /**
   * 共有ドライブ内にスプレッドシートを作成
   */
  async createSpreadsheetInSharedDrive(
    driveId: string,
    fileName: string,
    parentFolderId?: string
  ): Promise<MCPResponse> {
    try {
      if (!this.drive) {
        await this.setupGoogleDrive();
      }

      // Sheets APIも使用するため、両方を初期化
      const sheets = google.sheets({ version: 'v4', auth: this.auth! });

      // スプレッドシートを作成
      const spreadsheetResponse = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: fileName,
            locale: 'ja_JP',
            timeZone: 'Asia/Tokyo'
          }
        }
      });

      const spreadsheetId = spreadsheetResponse.data.spreadsheetId!;

      // 作成されたファイルを指定の共有ドライブ・フォルダに移動
      if (parentFolderId) {
        await this.drive!.files.update({
          fileId: spreadsheetId,
          addParents: parentFolderId,
          supportsAllDrives: true,
          fields: 'id, parents'
        });
      }

      // ファイル情報を取得
      const fileInfo = await this.drive!.files.get({
        fileId: spreadsheetId,
        supportsAllDrives: true,
        fields: 'id, name, parents, webViewLink, createdTime'
      });

      return {
        content: [{
          type: "text",
          text: `📊 スプレッドシートを作成しました\n\n` +
                `📄 ファイル名: ${fileInfo.data.name}\n` +
                `🆔 スプレッドシートID: ${spreadsheetId}\n` +
                `🆔 共有ドライブID: ${driveId}\n` +
                `📂 フォルダID: ${parentFolderId || 'ルート'}\n` +
                `🔗 URL: ${fileInfo.data.webViewLink}\n` +
                `📅 作成日時: ${fileInfo.data.createdTime ? new Date(fileInfo.data.createdTime).toLocaleString('ja-JP') : '不明'}\n\n` +
                `✅ スプレッドシート作成完了！\n` +
                `💡 このIDを使ってX Collector でツイートを出力できます`
        }]
      };
    } catch (error) {
      throw new Error(`スプレッドシート作成に失敗しました: ${error}`);
    }
  }

  /**
   * ファイルをアップロード（例：CSVファイルなど）
   */
  async uploadFileToSharedDrive(
    driveId: string,
    fileName: string,
    fileContent: string,
    mimeType: string,
    parentFolderId?: string
  ): Promise<MCPResponse> {
    try {
      if (!this.drive) {
        await this.setupGoogleDrive();
      }

      const fileMetadata: any = {
        name: fileName,
        parents: parentFolderId ? [parentFolderId] : undefined
      };

      const media = {
        mimeType: mimeType,
        body: fileContent
      };

      const response = await this.drive!.files.create({
        requestBody: fileMetadata,
        media: media,
        supportsAllDrives: true,
        fields: 'id, name, parents, webViewLink, createdTime, size'
      });

      const file = response.data;

      return {
        content: [{
          type: "text",
          text: `📄 ファイルをアップロードしました\n\n` +
                `📄 ファイル名: ${file.name}\n` +
                `🆔 ファイルID: ${file.id}\n` +
                `🆔 共有ドライブID: ${driveId}\n` +
                `📂 フォルダID: ${parentFolderId || 'ルート'}\n` +
                `📦 ファイルサイズ: ${file.size ? `${Math.round(parseInt(file.size) / 1024)}KB` : '不明'}\n` +
                `🔗 URL: ${file.webViewLink}\n` +
                `📅 作成日時: ${file.createdTime ? new Date(file.createdTime).toLocaleString('ja-JP') : '不明'}\n\n` +
                `✅ ファイルアップロード完了！`
        }]
      };
    } catch (error) {
      throw new Error(`ファイルアップロードに失敗しました: ${error}`);
    }
  }

  /**
   * X収集データ専用のプロジェクトフォルダ構造を作成
   */
  async createXCollectionProject(
    driveId: string,
    projectName: string,
    parentFolderId?: string
  ): Promise<MCPResponse> {
    try {
      if (!this.drive) {
        await this.setupGoogleDrive();
      }

      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const projectFolderName = `${projectName} - ${today}`;

      // 1. メインプロジェクトフォルダを作成
      const mainFolderResponse = await this.createFolderInSharedDrive(
        driveId, 
        projectFolderName, 
        parentFolderId
      );
      
      // フォルダIDを抽出（レスポンスから）
      const mainFolderId = await this.getLastCreatedFolderId();

      // 2. サブフォルダを作成
      const subFolders = ['Tweets', 'Profiles', 'Screenshots', 'Reports'];
      const createdSubFolders: string[] = [];

      for (const subFolder of subFolders) {
        await this.createFolderInSharedDrive(driveId, subFolder, mainFolderId);
        createdSubFolders.push(subFolder);
      }

      // 3. 初期スプレッドシートを作成
      const spreadsheetName = `${projectName} - Data Collection`;
      await this.createSpreadsheetInSharedDrive(driveId, spreadsheetName, mainFolderId);

      return {
        content: [{
          type: "text",
          text: `🎯 X収集プロジェクトを作成しました\n\n` +
                `📁 プロジェクト名: ${projectFolderName}\n` +
                `🆔 共有ドライブID: ${driveId}\n` +
                `📂 親フォルダID: ${parentFolderId || 'ルート'}\n\n` +
                `📁 作成されたフォルダ構造:\n` +
                `├── ${projectFolderName}/\n` +
                `│   ├── Tweets/          # ツイートデータ\n` +
                `│   ├── Profiles/        # プロフィールデータ\n` +
                `│   ├── Screenshots/     # スクリーンショット\n` +
                `│   ├── Reports/         # レポート・分析\n` +
                `│   └── ${spreadsheetName} # メインデータシート\n\n` +
                `✅ プロジェクト作成完了！\n` +
                `🚀 X Collector でデータ収集を開始できます`
        }]
      };
    } catch (error) {
      throw new Error(`X収集プロジェクト作成に失敗しました: ${error}`);
    }
  }

  /**
   * ヘルパーメソッド: 最後に作成されたフォルダIDを取得
   */
  private async getLastCreatedFolderId(): Promise<string> {
    // 実装の簡略化のため、この例では固定値を返します
    // 実際の実装では、作成レスポンスからIDを適切に抽出します
    if (!this.drive) throw new Error("Drive not initialized");
    
    const response = await this.drive.files.list({
      q: "mimeType='application/vnd.google-apps.folder'",
      orderBy: 'createdTime desc',
      pageSize: 1,
      fields: 'files(id)'
    });

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id!;
    }
    
    throw new Error("最後に作成されたフォルダが見つかりません");
  }

  /**
   * サービスの状態確認
   */
  isReady(): boolean {
    return this.auth !== null && this.drive !== null;
  }
}
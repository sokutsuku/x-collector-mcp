// src/tools/handlers/drive-handler.ts
// Google Drive関連ツールの専用ハンドラー

import { DriveService } from '../../services/drive.js';
import { MCPResponse } from '../../types/interfaces.js';

export class DriveToolHandler {
  private driveService: DriveService;

  constructor(driveService: DriveService) {
    this.driveService = driveService;
  }

  /**
   * Google Drive関連のツール定義
   */
  getToolDefinitions() {
    return [
      {
        name: "setup_google_drive",
        description: "Google Drive APIの初期設定と認証確認を行います",
        inputSchema: {
          type: "object",
          properties: {}
        },
      },
      {
        name: "list_shared_drives",
        description: "アクセス可能な共有ドライブの一覧を表示します",
        inputSchema: {
          type: "object",
          properties: {}
        },
      },
      {
        name: "list_folders_in_shared_drive",
        description: "指定した共有ドライブ内のフォルダ一覧を表示します",
        inputSchema: {
          type: "object",
          properties: {
            driveId: {
              type: "string",
              description: "共有ドライブのID"
            },
            parentFolderId: {
              type: "string",
              description: "親フォルダのID（省略時はルート）"
            }
          },
          required: ["driveId"]
        },
      },
      {
        name: "create_folder_in_shared_drive",
        description: "共有ドライブ内に新しいフォルダを作成します",
        inputSchema: {
          type: "object",
          properties: {
            driveId: {
              type: "string",
              description: "共有ドライブのID"
            },
            folderName: {
              type: "string",
              description: "作成するフォルダ名"
            },
            parentFolderId: {
              type: "string",
              description: "親フォルダのID（省略時はルート）"
            }
          },
          required: ["driveId", "folderName"]
        },
      },
      {
        name: "create_spreadsheet_in_shared_drive",
        description: "共有ドライブ内にスプレッドシートを作成します",
        inputSchema: {
          type: "object",
          properties: {
            driveId: {
              type: "string",
              description: "共有ドライブのID"
            },
            fileName: {
              type: "string",
              description: "作成するスプレッドシート名"
            },
            parentFolderId: {
              type: "string",
              description: "親フォルダのID（省略時はルート）"
            }
          },
          required: ["driveId", "fileName"]
        },
      },
      {
        name: "upload_file_to_shared_drive",
        description: "共有ドライブにファイルをアップロードします",
        inputSchema: {
          type: "object",
          properties: {
            driveId: {
              type: "string",
              description: "共有ドライブのID"
            },
            fileName: {
              type: "string",
              description: "アップロードするファイル名"
            },
            fileContent: {
              type: "string",
              description: "ファイルの内容"
            },
            mimeType: {
              type: "string",
              description: "ファイルのMIMEタイプ",
              default: "text/csv"
            },
            parentFolderId: {
              type: "string",
              description: "親フォルダのID（省略時はルート）"
            }
          },
          required: ["driveId", "fileName", "fileContent"]
        },
      },
      {
        name: "create_x_collection_project",
        description: "X収集用のプロジェクトフォルダ構造とスプレッドシートを一括作成します",
        inputSchema: {
          type: "object",
          properties: {
            driveId: {
              type: "string",
              description: "共有ドライブのID"
            },
            projectName: {
              type: "string",
              description: "プロジェクト名"
            },
            parentFolderId: {
              type: "string",
              description: "親フォルダのID（省略時はルート）"
            }
          },
          required: ["driveId", "projectName"]
        },
      }
    ];
  }

  /**
   * Google Drive関連ツールの実行ハンドラー
   */
  async handleTool(toolName: string, args: any): Promise<MCPResponse | null> {
    switch (toolName) {
      case "setup_google_drive":
        return await this.handleSetupGoogleDrive();
      
      case "list_shared_drives":
        return await this.handleListSharedDrives();
      
      case "list_folders_in_shared_drive":
        return await this.handleListFoldersInSharedDrive(
          args?.driveId as string,
          args?.parentFolderId as string | undefined
        );
      
      case "create_folder_in_shared_drive":
        return await this.handleCreateFolderInSharedDrive(
          args?.driveId as string,
          args?.folderName as string,
          args?.parentFolderId as string | undefined
        );
      
      case "create_spreadsheet_in_shared_drive":
        return await this.handleCreateSpreadsheetInSharedDrive(
          args?.driveId as string,
          args?.fileName as string,
          args?.parentFolderId as string | undefined
        );
      
      case "upload_file_to_shared_drive":
        return await this.handleUploadFileToSharedDrive(
          args?.driveId as string,
          args?.fileName as string,
          args?.fileContent as string,
          args?.mimeType as string | undefined,
          args?.parentFolderId as string | undefined
        );
      
      case "create_x_collection_project":
        return await this.handleCreateXCollectionProject(
          args?.driveId as string,
          args?.projectName as string,
          args?.parentFolderId as string | undefined
        );
      
      default:
        return null;
    }
  }

  // ===============================================
  // 実装メソッド
  // ===============================================

  private async handleSetupGoogleDrive(): Promise<MCPResponse> {
    return await this.driveService.setupGoogleDrive();
  }

  private async handleListSharedDrives(): Promise<MCPResponse> {
    return await this.driveService.listSharedDrives();
  }

  private async handleListFoldersInSharedDrive(
    driveId: string,
    parentFolderId?: string
  ): Promise<MCPResponse> {
    return await this.driveService.listFoldersInSharedDrive(driveId, parentFolderId);
  }

  private async handleCreateFolderInSharedDrive(
    driveId: string,
    folderName: string,
    parentFolderId?: string
  ): Promise<MCPResponse> {
    return await this.driveService.createFolderInSharedDrive(driveId, folderName, parentFolderId);
  }

  private async handleCreateSpreadsheetInSharedDrive(
    driveId: string,
    fileName: string,
    parentFolderId?: string
  ): Promise<MCPResponse> {
    return await this.driveService.createSpreadsheetInSharedDrive(driveId, fileName, parentFolderId);
  }

  private async handleUploadFileToSharedDrive(
    driveId: string,
    fileName: string,
    fileContent: string,
    mimeType: string = "text/csv",
    parentFolderId?: string
  ): Promise<MCPResponse> {
    return await this.driveService.uploadFileToSharedDrive(
      driveId, 
      fileName, 
      fileContent, 
      mimeType, 
      parentFolderId
    );
  }

  private async handleCreateXCollectionProject(
    driveId: string,
    projectName: string,
    parentFolderId?: string
  ): Promise<MCPResponse> {
    return await this.driveService.createXCollectionProject(driveId, projectName, parentFolderId);
  }

  /**
   * サービスの状態確認
   */
  isDriveReady(): boolean {
    return this.driveService.isReady();
  }
}
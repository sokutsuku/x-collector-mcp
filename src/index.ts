#!/usr/bin/env node

// src/index.ts
// X Collector MCP Server - リファクタリング版メインエントリーポイント

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MCPToolHandlers } from './tools/tool-handlers.js';

/**
 * X Collector MCP Server
 * 
 * 機能:
 * - Puppeteerによる人間らしいブラウザ操作
 * - X(Twitter)からのデータ収集（ツイート、プロフィール）
 * - Google Sheetsへの自動出力・追記
 * - Claude Desktop MCP連携
 */
class XCollectorServer {
  private server: Server;
  private toolHandlers: MCPToolHandlers;

  constructor() {
    // MCPサーバーの初期化
    this.server = new Server(
      {
        name: "x-collector",
        version: "0.3.0", // リファクタリング版
        description: "X(Twitter) data collection with human-like behavior and Google Sheets integration"
      },
      {
        capabilities: {
          tools: {}, // ツール機能を有効化
        },
      }
    );

    // ツールハンドラーの初期化
    this.toolHandlers = new MCPToolHandlers();
    
    // ハンドラーをサーバーに設定
    this.toolHandlers.setupHandlers(this.server);
    
    // プロセス終了時のクリーンアップ
    this.setupCleanup();
  }

  /**
   * サーバーを起動
   */
  async run(): Promise<void> {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      console.error("🚀 X Collector MCP Server running on stdio");
      console.error("📊 Version: 0.3.0 (Refactored)");
      console.error("🔧 Capabilities: Browser automation, Twitter data collection, Google Sheets integration");
      console.error("💡 Ready for Claude Desktop connection...");
    } catch (error) {
      console.error("❌ Failed to start X Collector MCP Server:", error);
      process.exit(1);
    }
  }

  /**
   * クリーンアップ処理の設定
   */
  private setupCleanup(): void {
    const cleanup = async () => {
      console.error("\n🧹 Cleaning up X Collector Server...");
      try {
        await this.toolHandlers.cleanup();
        console.error("✅ Cleanup completed successfully");
      } catch (error) {
        console.error("⚠️ Cleanup error:", error);
      }
      process.exit(0);
    };

    // 各種シグナルでクリーンアップを実行
    process.on('SIGINT', cleanup);   // Ctrl+C
    process.on('SIGTERM', cleanup);  // Termination
    process.on('SIGQUIT', cleanup);  // Quit
    
    // 未処理の例外もキャッチ
    process.on('uncaughtException', (error) => {
      console.error("💥 Uncaught Exception:", error);
      cleanup();
    });

    process.on('unhandledRejection', (reason) => {
      console.error("💥 Unhandled Rejection:", reason);
      cleanup();
    });
  }
}

// ===============================================
// サーバー起動
// ===============================================

async function main() {
  try {
    const server = new XCollectorServer();
    await server.run();
  } catch (error) {
    console.error("💥 Fatal error starting X Collector Server:", error);
    process.exit(1);
  }
}

// 実行時エラーハンドリング
main().catch((error) => {
  console.error("💥 Unhandled error in main():", error);
  process.exit(1);
});
// src/client.ts
// X Collector MCP Server 用のシンプルなCLIクライアント

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

async function main() {
  console.log("🚀 X Collector MCP CLI Client 起動中...");

  const transport = new StdioClientTransport();
  const client = new Client(transport);

  try {
    await client.connect();
    console.log("✅ サーバーに接続しました。");

    // サーバーが提供するツール一覧を取得
    console.log("🔍 サーバーから利用可能なツール一覧を取得中...");
    const response = await client.sendRequest(ListToolsRequestSchema, {});

    if (response && response.tools) {
      console.log("\n--- 利用可能なツール ---");
      response.tools.forEach(tool => {
        console.log(`- ${tool.name}: ${tool.description}`);
        if (tool.inputSchema && Object.keys(tool.inputSchema.properties || {}).length > 0) {
          console.log("  引数:");
          for (const prop in tool.inputSchema.properties) {
            const propDef = tool.inputSchema.properties[prop];
            console.log(`    - ${prop} (${propDef.type}${tool.inputSchema.required?.includes(prop) ? ', 必須' : ''}): ${propDef.description || '説明なし'}`);
          }
        }
      });
      console.log("------------------------");
    } else {
      console.log("⚠️ ツール一覧を取得できませんでした。");
    }

  } catch (error) {
    console.error("❌ クライアントエラー:", error);
    process.exit(1);
  } finally {
    client.disconnect();
    console.log("🔌 サーバーから切断しました。");
  }
}

main().catch(console.error);

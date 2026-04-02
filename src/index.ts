#!/usr/bin/env node
/**
 * CO-DEV MCP Server
 * Transport: stdio  |  Storage: file-system JSON ($CODEV_DATA_DIR)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DATA_DIR } from "./constants.js";
import { ensureDirectories } from "./storage.js";
import { registerCheckpointTools } from "./tools/checkpoint.js";
import { registerContextTools } from "./tools/context.js";
import { registerRoleTools } from "./tools/role.js";

const server = new McpServer({ name: "co-dev-mcp-server", version: "0.1.0" });

registerContextTools(server);
registerCheckpointTools(server);
registerRoleTools(server);

async function main(): Promise<void> {
  ensureDirectories();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[co-dev-mcp-server] Running via stdio. Data dir: ${DATA_DIR}`);
}

main().catch((err: unknown) => {
  console.error("[co-dev-mcp-server] Fatal error:", err);
  process.exit(1);
});

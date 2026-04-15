#!/usr/bin/env node
/**
 * CO-DEV MCP Server
 * Transport: stdio  |  Storage: file-system JSON ($CODEV_DATA_DIR)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerCheckpointTools } from "./tools/checkpoint.js";
import { registerContextTools } from "./tools/context.js";
import { registerFinalizeTools } from "./tools/finalize.js";
import { registerInboxTools } from "./tools/inbox.js";
import { registerInitTools } from "./tools/init.js";
import { registerRoleTools } from "./tools/role.js";

const server = new McpServer({ name: "co-dev-mcp-server", version: "0.3.0" });

registerInitTools(server);
registerContextTools(server);
registerCheckpointTools(server);
registerRoleTools(server);
registerInboxTools(server);
registerFinalizeTools(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[co-dev-mcp-server] Running via stdio (v0.3.0)");
}

main().catch((err: unknown) => {
  console.error("[co-dev-mcp-server] Fatal error:", err);
  process.exit(1);
});

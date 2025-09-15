import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { BunnyNetApi } from "./bunnynet.js";
import {
  serverDescription,
  serverName,
  serverTitle,
} from "./context/descriptions.js";
import {
  registerListFilesTool,
  registerUploadFileTool,
  registerDownloadFileTool,
  registerDeleteFileTool,
} from "./tools.js";

let server: McpServer | null = null;
function getMcpServer(api: BunnyNetApi): McpServer {
  if (!server) {
    server = new McpServer(
      {
        name: serverName,
        version: "1.0.0",
        title: serverTitle,
        description: serverDescription,
      },
      {
        capabilities: {
          logging: {
            listChanged: true,
          },
          resources: {
            listChanged: true,
          },
          tools: {
            listChanged: true,
          },
        },
      }
    );

    registerListFilesTool(server, api);
    registerUploadFileTool(server, api);
    registerDownloadFileTool(server, api);
    registerDeleteFileTool(server, api);
  }

  return server;
}

// Main function to start the server
async function main() {
  const transport = new StdioServerTransport();
  const api = new BunnyNetApi();
  const server = getMcpServer(api);
  await server.connect(transport);
}

// if (import.meta.main) {
main().catch((error) => {
  console.error(`Error starting MCP server: ${error}`);
  process.exit(1);
});
// }

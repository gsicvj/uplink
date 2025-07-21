import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BunnyNetApi } from "./bunnynet";
import {
  serverDescription,
  serverName,
  serverTitle,
} from "./context/descriptions";
import {
  registerListFilesTool,
  registerUploadFileTool,
  registerDownloadFileTool,
  registerDeleteFileTool,
} from "./tools";

let server: McpServer | null = null;

function getMcpServer(api: BunnyNetApi): McpServer {
  if (!server) {
    server = new McpServer({
      name: serverName,
      version: "0.0.1",
      title: serverTitle,
      description: serverDescription,
    });

    registerListFilesTool(server, api);
    registerUploadFileTool(server, api);
    registerDownloadFileTool(server, api);
    registerDeleteFileTool(server, api);
  }

  return server;
}

export { getMcpServer };

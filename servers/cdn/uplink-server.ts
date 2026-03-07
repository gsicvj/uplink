import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { BunnyNetApi } from "./bunnynet.js";
import { log } from "@clack/prompts";
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
  registerAllowedDirectories,
} from "./tools.js";

let server: McpServer | null = null;
let allowedDirectories: string[] | null = null;

function setAllowedDirectories(directories: string[]) {
  allowedDirectories = [...directories];
}

export function getAllowedDirectories() {
  return [...allowedDirectories!];
}

function getMcpServer(api: BunnyNetApi): McpServer {
  if (!server) {
    allowedDirectories = [];
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
    registerAllowedDirectories(server);
  }

  return server;
}

// Main function to start the server
async function main() {
  // Read all directory arguments (everything after the script path)
  // When running with "bun run script.ts args", argv includes the script path
  // Find the index where our script is and take args after it
  const scriptIndex = process.argv.findIndex((arg) =>
    arg.includes("uplink-server.ts")
  );
  const directories =
    scriptIndex >= 0
      ? process.argv.slice(scriptIndex + 1)
      : process.argv.slice(2);

  if (directories.length === 0) {
    throw new Error(
      "At least one directory required. Usage: bun run servers/cdn/uplink-server.ts <dir1> [dir2 ...]"
    );
  }

  log.info(`Using directories: ${directories.join(", ")}`);

  const transport = new StdioServerTransport();
  const api = new BunnyNetApi();
  const server = getMcpServer(api);

  // Set directories AFTER getMcpServer to avoid being reset
  setAllowedDirectories(directories);

  await server.connect(transport);
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : String(error);
  log.warn(`Uplink MCP Server encountered an error: ${message}`);
  process.exit(1);
});

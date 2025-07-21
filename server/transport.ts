import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getMcpServer } from "./server.js";
import { BunnyNetApi } from "./bunnynet.js";

// Main function to start the server
async function main() {
  const transport = new StdioServerTransport();
  const api = new BunnyNetApi();
  await getMcpServer(api).connect(transport);
  console.log("MCP Server is running on stdio");
}

main().catch((error) => {
  console.error("Error starting MCP server:", error);
  process.exit(1);
});

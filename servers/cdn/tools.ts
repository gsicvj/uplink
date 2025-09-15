import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listFilesInstruction } from "./context/descriptions";
import { uploadFileInstruction } from "./context/descriptions";
import { downloadFileInstruction } from "./context/descriptions";
import { deleteFileInstruction } from "./context/descriptions";
import { BunnyNetApi } from "./bunnynet";

async function readFile(
  localFile: string
): Promise<ReadableStream<Uint8Array>> {
  const file = Bun.file(localFile);
  return file.stream();
}

export function registerListFilesTool(server: McpServer, api: BunnyNetApi) {
  server.registerTool(
    "uplink_list_files",
    {
      title: "List Files",
      description: listFilesInstruction,
      inputSchema: {
        remotePath: z
          .string()
          .default("/")
          .describe(
            "Relative path to the remote directory to list. Default is root directory."
          ),
      },
    },
    async ({ remotePath }) => {
      try {
        const files = await api.list(remotePath);
        return {
          content: [{ type: "text", text: JSON.stringify(files) }],
        };
      } catch (error) {
        const errorText =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            { type: "text", text: `Error listing files: ${errorText}` },
          ],
        };
      }
    }
  );
}

export function registerUploadFileTool(server: McpServer, api: BunnyNetApi) {
  server.registerTool(
    "uplink_upload_file",
    {
      title: "Upload File",
      description: uploadFileInstruction,
      inputSchema: {
        localFile: z
          .string()
          .describe("Relative path to the local file to upload"),
        remoteFile: z
          .string()
          .describe("Relative path to the remote file to upload"),
      },
    },
    async ({ localFile, remoteFile }) => {
      const fileStream = await readFile(localFile);

      const isUploaded = await api.upload(remoteFile, fileStream);
      return {
        content: [
          {
            type: "text",
            text: isUploaded
              ? `File ${remoteFile}`
              : `File ${remoteFile} not uploaded`,
          },
        ],
      };
    }
  );
}

export function registerDownloadFileTool(server: McpServer, api: BunnyNetApi) {
  server.registerTool(
    "uplink_download_file",
    {
      title: "Download File",
      description: downloadFileInstruction,
      inputSchema: {
        remoteFile: z
          .string()
          .describe("Relative path to the remote file to download"),
        localFile: z
          .string()
          .describe("Relative path to the local file to download to"),
      },
    },
    async ({ remoteFile, localFile }) => {
      try {
        let filePromise = Bun.file(localFile);
        if (await filePromise.exists()) {
          return {
            content: [{ type: "text", text: "File already exists" }],
          };
        }
        const downloadResponse = await api.download(remoteFile);
        await Bun.write(localFile, downloadResponse);

        return {
          content: [
            {
              type: "text",
              text: `File downloaded to ${localFile}`,
            },
          ],
        };
      } catch (error) {
        const errorText =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            { type: "text", text: `File not downloaded: ${errorText}` },
          ],
        };
      }
    }
  );
}

export function registerDeleteFileTool(server: McpServer, api: BunnyNetApi) {
  server.registerTool(
    "uplink_delete_file",
    {
      title: "Delete File",
      description: deleteFileInstruction,
      inputSchema: {
        remoteFile: z
          .string()
          .describe("Relative path to the remote file to delete"),
      },
    },
    async ({ remoteFile }) => {
      const isDeleted = await api.delete(remoteFile);
      return {
        content: [
          {
            type: "text",
            text: isDeleted ? "File deleted" : "File not deleted",
          },
        ],
      };
    }
  );
}

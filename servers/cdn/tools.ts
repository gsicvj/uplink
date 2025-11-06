import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fileTypeFromStream } from "file-type";
import { z } from "zod";
import { listFilesInstruction } from "./context/descriptions";
import { uploadFileInstruction } from "./context/descriptions";
import { downloadFileInstruction } from "./context/descriptions";
import { deleteFileInstruction } from "./context/descriptions";
import { BunnyNetApi } from "./bunnynet";
import { getAllowedDirectories } from "./uplink-server";

export type FileObject = {
  name: string;
  type: Awaited<ReturnType<typeof fileTypeFromStream>>;
  stream: ReadableStream<Uint8Array>;
};

function isPathAllowed(filePath: string, allowedDirs: string[]): boolean {
  // Normalize the path (remove ./ prefix if present)
  const normalizedPath = filePath.replace(/^\.\//, "");

  // Check if the path starts with any of the allowed directories
  return allowedDirs.some((dir) => {
    const normalizedDir = dir.replace(/^\.\//, "");
    return (
      normalizedPath.startsWith(normalizedDir + "/") ||
      normalizedPath === normalizedDir
    );
  });
}

async function readFile(localFile: string): Promise<FileObject> {
  const file = Bun.file(localFile);
  // Streams can't be reused.
  // We need one stream for reading the file's mime type.
  const mimeStream = file.stream();
  const type = await fileTypeFromStream(mimeStream);
  // And one stream for the actual read operation.
  return {
    name: localFile,
    type: type,
    stream: file.stream(),
  };
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
      // Validate local file path against filesystem allowed directories
      const allowedDirs = getAllowedDirectories();
      if (!isPathAllowed(remoteFile, allowedDirs)) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Remote file path '${remoteFile}' is not within allowed directories: ${allowedDirs.join(
                ", "
              )}`,
            },
          ],
        };
      }

      const fileObject = await readFile(localFile);

      const isUploaded = await api.upload(remoteFile, fileObject);
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

export function registerAllowedDirectories(server: McpServer) {
  server.registerTool(
    "uplink_get_allowed_directories",
    {
      title: "Get Allowed Directories",
      description:
        "Returns the list of allowed directories for file operations",
      inputSchema: {},
    },
    async () => {
      const allowedDirs = getAllowedDirectories();
      const directories = allowedDirs?.length > 0 ? allowedDirs : [];
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(directories, null, 2),
          },
        ],
      };
    }
  );
}

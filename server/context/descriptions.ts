export const uploadFileInstruction = `
Upload a local file to the cloud.
localFile is the path to the local file to upload.
remoteFile is the path to the remote file to upload to.
Use relative paths for localFile and remoteFile.
`;

export const listFilesInstruction = `
List all files in the cloud.
`;

export const deleteFileInstruction = `
Delete a file in the cloud.
remoteFile is the path to the remote file to delete.
Use relative paths for remoteFile.
`;

export const downloadFileInstruction = `
Download a file from the cloud to the local file system.
localFile is the path to the local file to download to.
remoteFile is the path to the remote file to download from.
Use relative paths for localFile and remoteFile.
`;

export const serverName = "uplink";
export const serverTitle = "Uplink MCP Server";

export const serverDescription = `
This server is used for uploading files to the cloud.
It can:
- upload files from the local file system to the cloud
- list files in the cloud
- delete files in the cloud
- download files from the cloud to the local file system
`;

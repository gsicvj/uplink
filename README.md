# Deploy Kit MCP

An open source Model Context Protocol (MCP) server for uploading files to the cloud. It is meant to be used in AI-enabled editors like Cursor, or custom clients.

Manage your cloud assets with simple conversational commands.

[![license](https://img.shields.io/badge/license-[MIT]-blue.svg)](LICENSE)

## Key Features

Currently only supports BunnyCDN.

- **Upload**: @uplink upload ./image.png /images/
- **List**: @uplink list /images/
- **Delete**: @uplink delete /images/image.png
- **Simple Setup**: Run it locally with Node.js or via Docker.

## TODO / Roadmap

- [ ] Support multiple storage providers
- [ ] Upload multiple files in the same stream
- [ ] Show more logs, especially when a prompt hangs, at the moment there's too little info.

## Integration with Cursor

Add the following to the mcpServers configuration:

```json
    "uplink": {
      "command": "bun",
      "args": ["/ABSOLUTE-FOLDER-PATH/uplink/server/transport.ts"],
      "env": {
        "BUNNY_STORAGE_ZONE_NAME": "storage-zone-name",
        "BUNNY_STORAGE_ACCCES_KEY": "read-write-access-key"
      }
    },
```

## License

This project is licensed under the [MIT License](LICENSE).

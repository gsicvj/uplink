import * as BunnyStorageSDK from "@bunny.net/storage-sdk";
import { env } from "../../env";

// Singleton storage zone instance
let storageZoneInstance: BunnyStorageSDK.zone.StorageZone | null = null;
let pullZoneUrl: URL | null = null;

function getStorageZone(): BunnyStorageSDK.zone.StorageZone {
  if (!storageZoneInstance) {
    const storageZoneName = env.BUNNY_STORAGE_ZONE_NAME!;
    const accessKey = env.BUNNY_STORAGE_ACCESS_KEY!;
    const pullZone = env.BUNNY_PULLZONE_URL!;

    pullZoneUrl = new URL(pullZone);

    storageZoneInstance = BunnyStorageSDK.zone.connect_with_accesskey(
      BunnyStorageSDK.regions.StorageRegion.Falkenstein,
      storageZoneName,
      accessKey
    );
  }
  return storageZoneInstance;
}

export interface IBunnyNetAPIInterface {
  upload(
    fileName: string,
    stream: ReadableStream<Uint8Array>
  ): Promise<boolean>;
  download(fileName: string): Promise<Response>;
  update(
    fileName: string,
    stream: ReadableStream<Uint8Array>
  ): Promise<boolean>;
  delete(fileName: string): Promise<boolean>;
  list(remotePath: string): Promise<BunnyStorageSDK.file.StorageFile[]>;
}

export class BunnyNetApi implements IBunnyNetAPIInterface {
  private storageZone: BunnyStorageSDK.zone.StorageZone;

  constructor() {
    this.storageZone = getStorageZone();
  }

  async upload(fileName: string, stream: ReadableStream<Uint8Array>) {
    // fileName should include the path to the file
    // all the file data is already in the stream
    const isUploaded = await BunnyStorageSDK.file.upload(
      this.storageZone,
      fileName,
      stream
    );
    return isUploaded;
  }

  async download(fileName: string) {
    /**
     * As of 2025-07-15, bunny.net intentionally does not support downloading files from the storage zone.
     * We need to use the pull zone URL instead.
     */
    return await fetch(`${pullZoneUrl}${fileName}`);
  }

  async update(fileName: string, stream: ReadableStream<Uint8Array>) {
    /**
     * bunny.net does not support updating a file.
     * We need to remove the file and create a new one with the same name.
     */
    const isRemoved = await this.delete(fileName);
    if (!isRemoved) {
      return false;
    }
    const isCreated = await this.upload(fileName, stream);
    return isCreated;
  }

  async delete(fileName: string) {
    const isRemoved = await BunnyStorageSDK.file.remove(
      this.storageZone,
      fileName
    );
    return isRemoved;
  }

  async list(remotePath: string) {
    let list = await BunnyStorageSDK.file.list(this.storageZone, remotePath);
    return list;
  }
}

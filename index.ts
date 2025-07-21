import { BunnyNetApi } from "./server/bunnynet";

const api = new BunnyNetApi();

function createRandomFile(text?: string) {
  const randomFileName = `test-${Math.random()
    .toString(36)
    .substring(2, 15)}.txt`;
  console.log("Random file name: ", randomFileName);
  console.log("Provided text: ", text);
  const randomText =
    text || `Hello, world! ${Math.random().toString(36).substring(2, 15)}`;
  const randomStream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(randomText));
      controller.close();
    },
  });
  return {
    fileName: randomFileName,
    fileStream: randomStream,
  };
}

async function run() {
  const shouldRun = ["download"];

  if (shouldRun.includes("upload")) {
    const { fileName: randomFileName, fileStream: randomStream } =
      createRandomFile("My Random Text");

    const isCreated = await api.upload(randomFileName, randomStream);
    console.log("Created: ", isCreated);
  }

  if (shouldRun.includes("delete")) {
    const deletePath = "/testing-upload.txt";
    const isDeleted = await api.delete(deletePath);
    console.log("Removed: ", isDeleted);
  }

  if (shouldRun.includes("update")) {
    const updatePath = "/testing-upload.txt";
    const { fileStream } = createRandomFile(
      "I love the world. Let's go to the moon."
    );
    const isUpdated = await api.update(updatePath, fileStream);
    console.log("Updated: ", isUpdated);
  }

  if (shouldRun.includes("download")) {
    const localFile = "/downloaded/sun.png";
    const remoteFile = "/sun.png";
    const fileResponse = await api.download(remoteFile);
    Bun.write(localFile, fileResponse);
    console.log("Downloaded: ", remoteFile);
  }
}

run();

import type { Tool } from "ollama";

export async function warmUpModel(host: string, modelId: string, tools: Tool[]) {
  try {
    const response = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "Hi" }],
        tools,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    await response.json();
  } catch (error) {
    throw new Error(
      `Failed to warm up model. Ensure Ollama is running at ${host
      } with model ${modelId}\nError: ${error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function coolDownModel(host: string, modelId: string) {
  try {
    const response = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "system", content: "Shutting down" }],
        keep_alive: 0
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to cooldown the model ${modelId}.`);
    }

    return true;
  } catch (error) {
    return false;
  }
}
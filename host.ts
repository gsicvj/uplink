import { Agent as OpenAgent } from "@openai/agents";
import { hostOllamaAgent, OllamaAgent } from "./agents/ollama-agent";
import { type Config, getConfig } from "./lib/get-mcp-config";
import { hostOpenAgent } from "./agents/open-agent";

async function main({ agentProvider }: { agentProvider: "openai" | "ollama" }) {
  const config = await getConfig();
  if (!config) {
    console.error("Missing configuration file.");
    process.exit(1);
  }

  const name = "File Bachelor";
  const instructions =
    "You are a helpful file assistant. You use tools. Before accessing filesystem paths, check allowed directories.";

  if (agentProvider === "openai") {
    const agent = new OpenAgent({
      name,
      instructions,
      model: config.openai.model,
    });
    await hostOpenAgent(agent);
  } else if (agentProvider === "ollama") {
    const agent = new OllamaAgent({
      instructions,
      config,
    });
    await hostOllamaAgent(agent, config);
  } else {
    throw new Error(
      'Invalid agent provider. Please use either "openai" or "ollama".'
    );
  }
}

main({
  agentProvider: "ollama",
}).catch((error) => console.error(error));

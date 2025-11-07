export async function solveAgentLoop() {
  try {
    // Bun style input reading
    for await (const line of console) {
      // saving user goal
      this.messages.push({
        role: "user",
        content: line,
      });
      // only run-once
      break;
    }

    /** agent loop starts here */
    let chatResponse: ChatResponse;
    let toolCalls: ToolCall[];
    do {
      chatResponse = await this.model.createMessage({
        messages: this.messages,
        tools: this.tools,
        logType: "chat",
      });
      this.messages.push(chatResponse.message);
      toolCalls = chatResponse.message.tool_calls ?? [];
      if (toolCalls.length > 0) {
        // agent decides if it should make tool calls
        for (const {
          function: { name: toolName, arguments: toolArgs },
        } of toolCalls) {
          const client = this.toolMap.get(toolName);
          if (!client) {
            throw new Error(`The ${toolName} is unavailable.`);
          }
          const toolResponse = await client.callToolWithTimeout(
            toolName,
            toolArgs
          );

          if (!toolResponse) {
            throw new Error(`No response came from ${toolName}.`);
          }
          const formattedResponse = this.formatToolResponse(toolResponse);
          console.error(`Assistant: ${formattedResponse}`);
          this.messages.push({
            role: "tool",
            content: formattedResponse,
          });
        }
      } else {
        // or respond with a message
        const lastMessage = this.messages[this.messages.length - 1];
        console.error("Assistant: ", lastMessage?.content);
      }
      // agent should exit if there are no tools to call
    } while (toolCalls.length > 0);
    /** agent loop ends here */
  } catch (error) {
    console.error(`Failed to achieve the goal: ${error}`);
  }
}

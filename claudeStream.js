// claudeStream.js - minimal streaming helper (CommonJS version).
// Install: npm install @anthropic-ai/sdk
// Needs ANTHROPIC_API_KEY in the environment.

const AnthropicPkg = require("@anthropic-ai/sdk");
// Works whichever way the package exposes the class under require()
const Anthropic = AnthropicPkg.default || AnthropicPkg.Anthropic || AnthropicPkg;

const client = new Anthropic();

/**
 * Send a messages array and stream the reply.
 *
 * @param {Array}    messages  [{ role: "user"|"assistant", content: "..." }, ...] - last one must be "user"
 * @param {function} onText    called with each chunk of text as it arrives
 * @param {object}   [opts]    { system, model, maxTokens, signal }
 * @returns {Promise<{ text: string, usage: object, stopReason: string }>}
 */
async function streamChat(messages, onText, opts = {}) {
    const stream = client.messages.stream(
        {
            model: opts.model || "claude-haiku-5-5",
            max_tokens: opts.maxTokens || 8000,
            ...(opts.system ? { system: opts.system } : {}),
            messages,
        },
        { signal: opts.signal }
    );

    stream.on("text", onText);
    const final = await stream.finalMessage();

    return {
        text: final.content.filter((b) => b.type === "text").map((b) => b.text).join(""),
        usage: final.usage,
        stopReason: final.stop_reason,
    };
}

module.exports = { streamChat };
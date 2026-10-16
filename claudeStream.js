// claudeStream.js - minimal streaming helper (CommonJS version).
// Install: npm install @anthropic-ai/sdk
// Needs ANTHROPIC_API_KEY in the environment.

const AnthropicPkg = require("@anthropic-ai/sdk");
// Works whichever way the package exposes the class under require()
const Anthropic = AnthropicPkg.default || AnthropicPkg.Anthropic || AnthropicPkg;

const client = new Anthropic();

const returnBundleTool = {
    name: "return_bundle",
    description: "Return the FHIR Bundle and accompanying notes for this turn.",
    input_schema: {
        type: "object",
        properties: {
            bundle: {
                type: ["object", "null"],
                description: "Complete FHIR R4 Bundle, or null if the request is out of scope.",
            },
            summary: { type: "string" },
            modelling_notes: { type: "array", items: { type: "string" } },
            assumptions: { type: "array", items: { type: "string" } },
            warnings: { type: "array", items: { type: "string" } },
        },
        required: ["bundle", "summary", "modelling_notes", "assumptions", "warnings"],
    },
};

async function chat(messages, { system, model = "claude-sonnet-5-5", maxTokens = 32000 } = {}) {
    const stream = client.messages.stream({
        model,
        max_tokens: maxTokens,
        system: system +
            "\n\nAlways respond by calling the `return_bundle` tool exactly once. " +
            "Never reply with plain text. Put any explanation in the tool's summary field.",
        messages,
        tools: [returnBundleTool],          // no strict
        tool_choice: { type: "auto" },
    });
    const response = await stream.finalMessage();

    const toolUse = response.content.find((b) => b.type === "tool_use");
    const input = toolUse?.input ?? null;

    // Minimal envelope check, since nothing is enforcing the schema now
    const ok = input
        && typeof input.summary === "string"
        && Array.isArray(input.modelling_notes)
        && Array.isArray(input.assumptions)
        && Array.isArray(input.warnings)
        && (input.bundle === null || typeof input.bundle === "object");

    return {
        envelope: ok ? input : null,
        usage: response.usage,
        stopReason: response.stop_reason,
    };
}


async function chatDEP(messages, { system, model = "claude-sonnet-5-5", maxTokens = 32000 } = {}) {
    const stream = client.messages.stream({
        model,
        max_tokens: maxTokens,
        system,
        messages,
        tools: [returnBundleTool],
        tool_choice: { type: "tool", name: "return_bundle" },
    });
    const response = await stream.finalMessage();

    const toolUse = response.content.find((b) => b.type === "tool_use");
    return {
        envelope: toolUse?.input ?? null,   // already an object
        usage: response.usage,
        stopReason: response.stop_reason,
    };
}

async function chatDEP(messages, { system, model = "claude-sonnet-5-5", maxTokens = 15000 } = {}) {
    const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system,
        messages,
    });

    const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");

    return {
        text,
        usage: response.usage,
        stopReason: response.stop_reason,
    };
}

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
            model: opts.model || "claude-sonnet-5-5",
            max_tokens: opts.maxTokens || 12000,
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

module.exports = { chat, streamChat };
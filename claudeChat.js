const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY, // or however you loaded it before
});

const returnBundleTool = {
    name: "return_bundle",
    description: "Return the FHIR Bundle and accompanying notes for this turn.",
    input_schema: {
        type: "object",
        properties: {
            // Short fields first so they are emitted before the long payload
            summary: {
                type: "string",
                description: "Short plain-text explanation of what was produced.",
            },
            modelling_notes: {
                type: "array",
                items: { type: "string" },
                description: "Use [] if none.",
            },
            assumptions: {
                type: "array",
                items: { type: "string" },
                description: "Use [] if none.",
            },
            warnings: {
                type: "array",
                items: { type: "string" },
                description: "Use [] if none.",
            },
            bundle_json: {
                type: "string",
                description:
                    "The complete FHIR R4 Bundle serialised as a JSON string. " +
                    'Use the literal string "null" if the request is out of scope.',
            },
        },
        required: ["summary", "modelling_notes", "assumptions", "warnings", "bundle_json"],
    },
};

const MAX_ATTEMPTS = 2;

// Per-model output caps. Fill in from the current docs if a model rejects or
// truncates at the default, e.g. { "claude-haiku-5-5": 32000 }
const MODEL_MAX_TOKENS = {};

function clampMaxTokens(model, maxTokens) {
    const cap = MODEL_MAX_TOKENS[model];
    return cap ? Math.min(maxTokens, cap) : maxTokens;
}

// ---------- tool_choice handling ----------

// Models that reject forced tool use ({type:"tool"} / {type:"any"}).
// Haiku accepts it; Sonnet and Opus return a 400. This set is also extended at
// runtime: if any other model returns that 400, it is added and the call is
// retried with { type: "auto" } without using up an attempt.
const NO_FORCED_TOOL_CHOICE = new Set(["claude-sonnet-5-5", "claude-opus-5-5"]);

function toolChoiceFor(model) {
    return NO_FORCED_TOOL_CHOICE.has(model)
        ? { type: "auto" }
        : { type: "tool", name: "return_bundle" };
}

function isToolChoiceUnsupported(e) {
    return (
        e?.status === 400 &&
        /tool_choice/i.test(e?.message || "") &&
        /not supported/i.test(e?.message || "")
    );
}

// Appended for every model: harmless with forced tool use, required with "auto".
const TOOL_INSTRUCTION =
    "You MUST respond by calling the return_bundle tool exactly once. " +
    "Do not write any text outside the tool call.";

// ---------- Envelope: normalise + parse ----------

function toEnvelope(input) {
    if (!input || typeof input !== "object") return { error: "no tool input returned" };
    const out = { ...input };

    if (typeof out.summary !== "string") {
        return { error: `summary is ${out.summary === undefined ? "missing" : typeof out.summary}` };
    }

    for (const k of ["modelling_notes", "assumptions", "warnings"]) {
        if (out[k] == null) {
            out[k] = [];
        } else if (typeof out[k] === "string") {
            try {
                const parsed = JSON.parse(out[k]);
                out[k] = Array.isArray(parsed) ? parsed : [out[k]];
            } catch {
                out[k] = out[k].trim() ? [out[k]] : [];
            }
        } else if (!Array.isArray(out[k])) {
            return { error: `${k} must be an array, got ${typeof out[k]}` };
        }
    }

    // Accept either shape in case a model ignores the schema
    let raw = out.bundle_json !== undefined ? out.bundle_json : out.bundle;
    if (raw === undefined) return { error: "bundle_json is missing" };

    if (typeof raw === "string") {
        const trimmed = raw.trim();
        // Strip accidental markdown fences
        const unfenced = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
        try {
            raw = JSON.parse(unfenced);
        } catch (e) {
            return { error: `bundle_json is not valid JSON: ${e.message}` };
        }
    }

    if (raw !== null && (typeof raw !== "object" || raw.resourceType !== "Bundle")) {
        return { error: "bundle is not a FHIR Bundle (resourceType must be 'Bundle')" };
    }

    delete out.bundle_json;
    return { envelope: { ...out, bundle: raw } };
}

// ---------- Bundle content checks ----------

function collectReferences(node, found = []) {
    if (Array.isArray(node)) {
        node.forEach((n) => collectReferences(n, found));
    } else if (node && typeof node === "object") {
        if (typeof node.reference === "string") found.push(node.reference);
        Object.values(node).forEach((v) => collectReferences(v, found));
    }
    return found;
}

function checkBundleContents(bundle) {
    if (bundle === null) return null; // out-of-scope response is valid

    const problems = [];

    if (!Array.isArray(bundle.entry) || bundle.entry.length === 0) {
        return "bundle.entry must be a non-empty array";
    }

    const known = new Set();
    for (const e of bundle.entry) {
        const r = e?.resource;
        if (!r || typeof r.resourceType !== "string") {
            problems.push("an entry has no resource.resourceType");
            continue;
        }
        if (e.fullUrl) known.add(e.fullUrl);
        if (r.id) known.add(`${r.resourceType}/${r.id}`);
    }

    for (const e of bundle.entry) {
        const r = e?.resource;
        if (!r?.resourceType) continue;

        if (!r.text || typeof r.text.div !== "string" || !r.text.div.trim()) {
            problems.push(`${r.resourceType}${r.id ? "/" + r.id : ""} has no text.div narrative`);
        }

        for (const ref of collectReferences(r)) {
            if (ref.startsWith("#")) continue; // contained resource
            if (!known.has(ref)) problems.push(`unresolved reference "${ref}" in ${r.resourceType}`);
        }
    }

    const unique = [...new Set(problems)];
    if (unique.length === 0) return null;
    const shown = unique.slice(0, 8).join("; ");
    return unique.length > 8 ? `${shown}; and ${unique.length - 8} more` : shown;
}

// ---------- Main ----------

function addUsage(total, u) {
    if (!u) return total;
    const out = { ...total };
    for (const k of ["input_tokens", "output_tokens"]) out[k] = (out[k] || 0) + (u[k] || 0);
    return out;
}

async function chat(
    messages,
    { system = "", model = "claude-sonnet-5-5", maxTokens = 32000, checkContents = true } = {}
) {
    let convo = [...messages];
    let usage = {};
    let lastStopReason = null;
    let lastError = null;
    let attemptsUsed = 0;

    const fullSystem = system ? `${system}\n\n${TOOL_INSTRUCTION}` : TOOL_INSTRUCTION;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        attemptsUsed = attempt;

        // ----- API call (errors are caught, not thrown) -----
        let response;
        try {
            const stream = client.messages.stream({
                model,
                max_tokens: clampMaxTokens(model, maxTokens),
                system: fullSystem,
                messages: convo,
                tools: [returnBundleTool],
                tool_choice: toolChoiceFor(model),
            });
            response = await stream.finalMessage();
        } catch (e) {
            // Self-heal: this model rejects forced tool use. Remember it and
            // retry with "auto" without consuming an attempt.
            if (isToolChoiceUnsupported(e) && !NO_FORCED_TOOL_CHOICE.has(model)) {
                console.error(`[chat] ${model} rejects forced tool_choice; switching to auto`);
                NO_FORCED_TOOL_CHOICE.add(model);
                attempt--;
                continue;
            }
            lastError = `API error ${e?.status ?? "?"}: ${e?.message ?? e}`;
            console.error(`[chat] ${model} attempt ${attempt}: ${lastError}`);
            break;
        }

        usage = addUsage(usage, response.usage);
        lastStopReason = response.stop_reason;

        // Truncation: retrying with the same budget will just truncate again
        if (response.stop_reason === "max_tokens") {
            lastError =
                `output truncated at max_tokens (${response.usage?.output_tokens ?? "?"} output tokens)`;
            console.error(`[chat] ${model} attempt ${attempt}: ${lastError}`);
            break;
        }

        const toolUse = response.content.find(
            (b) => b.type === "tool_use" && b.name === "return_bundle"
        );

        let problem = null;
        let envelope = null;

        if (!toolUse) {
            problem = "no return_bundle tool call was made";
        } else {
            const result = toEnvelope(toolUse.input);
            if (result.error) {
                problem = result.error;
            } else {
                envelope = result.envelope;
                if (checkContents) problem = checkBundleContents(envelope.bundle);
            }
        }

        if (!problem) {
            return { envelope, usage, stopReason: response.stop_reason, error: null, attempts: attempt };
        }

        lastError = problem;
        console.error(
            `[chat] ${model} attempt ${attempt} failed: ${problem}\n` +
            `  stop_reason=${response.stop_reason}\n` +
            `  output_tokens=${response.usage?.output_tokens ?? "n/a"}\n` +
            `  input keys=${toolUse ? JSON.stringify(Object.keys(toolUse.input || {})) : "n/a"}\n` +
            `  input preview=${toolUse ? JSON.stringify(toolUse.input).slice(0, 500) : "n/a"}`
        );

        if (attempt === MAX_ATTEMPTS) break;

        if (!toolUse) {
            // Model replied with plain text (possible with tool_choice "auto").
            // Nudge it to call the tool. Skip the assistant turn if it was empty,
            // because the API rejects empty assistant content.
            convo = [
                ...convo,
                ...(response.content.length
                    ? [{ role: "assistant", content: response.content }]
                    : []),
                {
                    role: "user",
                    content: "You did not call the return_bundle tool. Call it now with the complete result.",
                },
            ];
            continue;
        }

        // Feed the specific failure back so the model can correct it
        convo = [
            ...convo,
            { role: "assistant", content: response.content },
            {
                role: "user",
                content: [
                    {
                        type: "tool_result",
                        tool_use_id: toolUse.id,
                        is_error: true,
                        content:
                            `Invalid output: ${problem}. ` +
                            "Call return_bundle again with a corrected input. " +
                            "bundle_json must be a JSON string of a complete FHIR Bundle, " +
                            "every resource needs text.div, and every reference must resolve inside the bundle.",
                    },
                ],
            },
        ];
    }

    return { envelope: null, usage, stopReason: lastStopReason, error: lastError, attempts: attemptsUsed };
}

module.exports = { chat, returnBundleTool };
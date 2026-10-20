
const fs = require("fs");

const SYSTEM_PROMPT = fs.readFileSync('./artifacts/aiPrompts/bundleSummarizerSystem.txt', 'utf8');


const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY, // or however you loaded it before
});

const DEFAULTS = {
    path: '/fhir/summarise',
    model: 'claude-sonnet-5-5',
    // Must leave room for any model thinking AND the written summary
    maxTokens: 16000,
    // Passed straight to the API if set, e.g. { type: 'disabled' } to stop the model
    // spending output tokens on thinking. Leave undefined to use the model default.
    thinking: undefined,   // undefined = pick per model (see thinkingFor); null = send nothing
    maxBundleChars: 400000, // rough guard (~100k tokens)
    maxOoIssues: 200,
    bodyLimit: '5mb',
};

/**
 * How to turn thinking off differs by model (the API rejects the wrong value).
 *  - Sonnet 5.x: {type:'between_tools'}  (the model doesn't think before responding)
 *  - Haiku: {type:'disabled'}  (best guess; if the API rejects it, the 400 message says what to send)
 * Unknown models: send nothing and use the model default.
 */
function thinkingFor(model) {
    if (/sonnet-5/.test(model)) return { type: 'between_tools' };
    if (/haiku/.test(model)) return { type: 'disabled' };
    return undefined;
}

const ID_PATTERN = '[A-Za-z0-9\\-._]+';

/**
 * The id of the resource in an entry: its own id, or failing that one taken from a
 * RESTful fullUrl (http://server/fhir/Observation/123 -> 123). Null if neither.
 */
function entryId(e) {
    const r = e && e.resource;
    if (!r) return null;
    if (r.id) return r.id;
    if (e.fullUrl) {
        const m = new RegExp('/' + r.resourceType + '/(' + ID_PATTERN + ')(?:/_history/.*)?$').exec(e.fullUrl);
        if (m) return m[1];
    }
    return null;
}

/**
 * The best stable name for an entry, used everywhere we label a resource:
 *   ResourceType/id  >  fullUrl (e.g. urn:uuid:...)  >  Bundle.entry[N]
 */
function entryKey(e, i) {
    const r = e && e.resource;
    const id = entryId(e);
    if (r && id) return r.resourceType + '/' + id;
    if (e && e.fullUrl) return e.fullUrl;
    return 'Bundle.entry[' + i + ']';
}

/**
 * Deterministic pre-pass over the bundle. Cheap, reliable checks handed to Claude as hints.
 * Also returns the entry list so OperationOutcome expressions can be mapped to resources.
 */
function runLocalChecks(bundle) {
    const entries = Array.isArray(bundle.entry) ? bundle.entry : [];
    const counts = {};
    const knownKeys = new Set();
    const seen = new Set();
    const duplicates = [];
    const entriesWithoutResource = [];

    entries.forEach(function (e, i) {
        const r = e.resource;
        if (!r) {
            entriesWithoutResource.push(i);
            return;
        }
        counts[r.resourceType] = (counts[r.resourceType] || 0) + 1;

        if (r.id) {
            const typeId = r.resourceType + '/' + r.id;
            if (seen.has(typeId)) duplicates.push(typeId);
            seen.add(typeId);
            knownKeys.add(typeId);
        }
        if (e.fullUrl) knownKeys.add(e.fullUrl);
    });

    const unresolved = [];
    const external = [];

    function walk(node, owner) {
        if (Array.isArray(node)) {
            node.forEach(function (n) { walk(n, owner); });
            return;
        }
        if (node && typeof node === 'object') {
            if (typeof node.reference === 'string' && node.reference.charAt(0) !== '#') {
                const ref = node.reference;
                const normalised = ref.replace(/\/_history\/.*$/, '');
                const tail = normalised.split('/').slice(-2).join('/'); // handles absolute URLs
                const resolved = knownKeys.has(ref) || knownKeys.has(normalised) || knownKeys.has(tail);
                if (!resolved) {
                    if (/^https?:\/\//.test(ref)) external.push({ from: owner, reference: ref });
                    else unresolved.push({ from: owner, reference: ref });
                }
            }
            Object.keys(node).forEach(function (k) { walk(node[k], owner); });
        }
    }

    entries.forEach(function (e, i) {
        const r = e.resource;
        if (r) walk(r, entryKey(e, i));
    });

    return {
        bundleType: bundle.type || null,
        totalEntries: entries.length,
        declaredTotal: bundle.total === undefined ? null : bundle.total,
        resourceCounts: counts,
        duplicateResourceIds: Array.from(new Set(duplicates)),
        entriesWithoutResource: entriesWithoutResource,
        unresolvedReferences: unresolved.slice(0, 100),
        externalReferences: external.slice(0, 50),
    };
}

/**
 * Flatten an OperationOutcome into a compact list and map each issue to the bundle
 * resource it points at (via Bundle.entry[N] in expression/location).
 */
function flattenOperationOutcome(oo, bundle, maxIssues) {
    const entries = Array.isArray(bundle.entry) ? bundle.entry : [];
    const issues = Array.isArray(oo.issue) ? oo.issue : [];

    const flattened = issues.slice(0, maxIssues).map(function (iss) {
        const paths = [].concat(iss.expression || [], iss.location || []);
        let resource = null;
        for (let i = 0; i < paths.length; i++) {
            const m = /Bundle\.entry\[(\d+)\]/.exec(paths[i]);
            if (m) {
                const n = Number(m[1]);
                resource = entries[n] ? entryKey(entries[n], n) : 'Bundle.entry[' + n + ']';
                break;
            }
        }
        return {
            severity: iss.severity,
            code: iss.code,
            resource: resource,
            path: paths[0] || null,
            message: (iss.details && iss.details.text) || iss.diagnostics || null,
        };
    });

    return {
        totalIssues: issues.length,
        included: flattened.length,
        issues: flattened,
    };
}

/**
 * Parse the model's JSON reply. Tolerates stray code fences or a sentence before/after the object.
 * Returns the parsed object, or null if it can't be parsed.
 */
function parseReport(text) {
    if (!text) return null;
    let t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try { return JSON.parse(t); } catch (e) { /* fall through */ }
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start !== -1 && end > start) {
        try { return JSON.parse(t.slice(start, end + 1)); } catch (e) { /* give up */ }
    }
    return null;
}

/**
 * Normalise the report so the UI can rely on its shape, and add entryIndex to each
 * issue (position of the resource in Bundle.entry) so the UI can link to it.
 */
function normaliseReport(report, bundle) {
    const entries = Array.isArray(bundle.entry) ? bundle.entry : [];

    const KEY_RE = new RegExp('^[A-Z][A-Za-z]+/' + ID_PATTERN + '$');

    const indexByKey = Object.create(null);       // 'Type/id' and fullUrl -> entry index
    const indexByLowerKey = Object.create(null);  // same, lower-cased, for forgiving matches
    const indexById = Object.create(null);        // bare id -> entry index (-1 if ambiguous)
    const canonical = [];                         // entry index -> display key

    function add(key, i) {
        if (!key) return;
        indexByKey[key] = i;
        indexByLowerKey[key.toLowerCase()] = i;
    }

    entries.forEach(function (e, i) {
        const r = e.resource;
        if (!r) return;
        const id = entryId(e);
        if (id) {
            add(r.resourceType + '/' + id, i);
            indexById[id] = indexById[id] === undefined ? i : -1;
        }
        add(e.fullUrl, i);
        canonical[i] = entryKey(e, i);
    });

    // Turn whatever the model wrote for a resource into an entry index (or null).
    function resolveEntry(raw) {
        if (!raw) return null;
        const s = String(raw).trim();
        const pos = /Bundle\.entry\[(\d+)\]/.exec(s);                 // entries with no id or fullUrl
        if (pos && entries[Number(pos[1])] && entries[Number(pos[1])].resource) return Number(pos[1]);
        const tries = [s];
        let m = s.match(/[A-Z][A-Za-z]+\/[A-Za-z0-9\-._]+/);          // Type/id inside longer text
        if (m) tries.push(m[0]);
        m = s.match(/urn:(?:uuid|oid):[A-Za-z0-9\-.]+/);              // fullUrl inside longer text
        if (m) tries.push(m[0]);
        tries.push(s.replace(/\/_history\/.*$/, '').split('/').slice(-2).join('/')); // absolute URL

        for (let k = 0; k < tries.length; k++) {
            if (indexByKey[tries[k]] !== undefined) return indexByKey[tries[k]];
            const lower = tries[k].toLowerCase();
            if (indexByLowerKey[lower] !== undefined) return indexByLowerKey[lower];
        }
        const bare = s.replace(/^.*[\/:]/, '');                         // a bare id
        if (indexById[bare] !== undefined && indexById[bare] !== -1) return indexById[bare];
        return null;
    }

    const order = { error: 0, warning: 1, info: 2 };
    const unresolved = [];
    const issues = (Array.isArray(report.issues) ? report.issues : []).map(function (iss) {
        const sev = String(iss.severity || 'info').toLowerCase();
        const idx = resolveEntry(iss.resource);
        if (idx === null && iss.resource && String(iss.resource).toLowerCase() !== 'bundle') {
            unresolved.push(iss.resource);
        }
        return Object.assign({}, iss, {
            severity: order[sev] === undefined ? 'info' : sev,
            source: String(iss.source || 'reviewer').toLowerCase(),
            // show the canonical key when we resolved it
            resource: idx !== null && canonical[idx] ? canonical[idx] : iss.resource,
            entryIndex: idx,
        });
    });
    issues.sort(function (a, b) { return order[a.severity] - order[b.severity]; });

    // Recommendations: give each affected resource an entryIndex so the UI can link to it.
    const improvements = (Array.isArray(report.improvements) ? report.improvements : []).map(function (m) {
        const seen = {};
        const links = [];
        [].concat(m.resources || []).forEach(function (raw) {
            const idx = resolveEntry(raw);
            const resource = idx !== null && canonical[idx] ? canonical[idx] : String(raw);
            if (seen[resource]) return;
            seen[resource] = true;
            if (idx === null && resource.toLowerCase() !== 'bundle') unresolved.push(raw);
            links.push({ resource: resource, entryIndex: idx });
        });
        return Object.assign({}, m, {
            resources: links.map(function (l) { return l.resource; }),
            resourceLinks: links
        });
    });

    if (unresolved.length) {
        console.warn('bundleSummarizer: issue resources not found in bundle: %j', unresolved);
    }

    // Keys the UI can use for clickable links in the narrative
    const resourceIndex = {};
    canonical.forEach(function (key, i) {
        if (key && KEY_RE.test(key)) resourceIndex[key] = i;
    });

    // Narrative links: resolve each target to a real resource and rewrite it to the canonical
    // key. Anything that doesn't resolve (invented ids, URLs, other targets) becomes plain text.
    const clinicalSummary = String(report.clinicalSummary || '').replace(
        /\[([^\]]+)\]\(([^)\s]*)\)/g,
        function (match, text, target) {
            const idx = resolveEntry(target);
            const key = idx !== null ? canonical[idx] : null;
            return key && KEY_RE.test(key) ? '[' + text + '](' + key + ')' : text;
        }
    );

    return {
        overview: report.overview || {},
        clinicalSummary: clinicalSummary,
        resourceIndex: resourceIndex,
        issues: issues,
        improvements: improvements,
        limitations: report.limitations || '',
    };
}

/**
 * Registers the endpoint on an existing Express app (or router).
 *
 * POST <path>   body: { bundle: <Bundle>, oo?: <OperationOutcome> }
 * Response:     { summary (markdown), truncated, localChecks, validatorIssues, usage }
 *
 * @param {import('express').Application|import('express').Router} app
 * @param {object} [options] override any of DEFAULTS, plus:
 *   - apiKey: Anthropic API key (defaults to ANTHROPIC_API_KEY env var)
 *   - middleware: array of express middleware (e.g. auth) to run before the handler
 */
function setup(app, options) {

    //const client = new Anthropic(opts.apiKey ? { apiKey: opts.apiKey } : {});
    const opts = Object.assign({}, DEFAULTS, options || {});

    /*

    const client = new Anthropic(opts.apiKey ? { apiKey: opts.apiKey } : {});
    const middleware = opts.middleware || [];

    // Route-level body parser: skipped automatically if your app already parsed the body
    const jsonParser = express.json({
        limit: opts.bodyLimit,
        type: ['application/json', 'application/fhir+json'],
    });

    */
    app.post("/ai/bundleSummarizer",  async function (req, res) {
        const body = req.body || {};
        const bundle = body.bundle;
        const oo = body.oo;

        if (!bundle || bundle.resourceType !== 'Bundle') {
            return res.status(400).json({
                error: 'Body must be JSON of the form { "bundle": <Bundle>, "oo": <OperationOutcome> (optional) }.',
            });
        }
        if (oo && oo.resourceType !== 'OperationOutcome') {
            return res.status(400).json({ error: '"oo" must be an OperationOutcome if supplied.' });
        }

        const bundleJson = JSON.stringify(bundle);
        if (bundleJson.length > opts.maxBundleChars) {
            return res.status(413).json({
                error: 'Bundle too large (' + bundleJson.length + ' chars, limit ' + opts.maxBundleChars + ').',
            });
        }

        const localChecks = runLocalChecks(bundle);
        const validatorIssues = oo ? flattenOperationOutcome(oo, bundle, opts.maxOoIssues) : null;

        let userContent =
            '<local_checks>\n' + JSON.stringify(localChecks, null, 2) + '\n</local_checks>\n\n';
        if (validatorIssues) {
            userContent +=
                '<validator_output>\n' + JSON.stringify(validatorIssues, null, 2) + '\n</validator_output>\n\n';
        }
        userContent +=
            '<bundle>\n' + bundleJson + '\n</bundle>\n\nReview this bundle following your instructions.';

        try {
            const request = {
                model: opts.model,
                max_tokens: opts.maxTokens,
                // Cache the static system prompt across requests
                system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
                messages: [{ role: 'user', content: userContent }],
            };
            const thinking = opts.thinking !== undefined ? opts.thinking : thinkingFor(opts.model);
            if (thinking) request.thinking = thinking;

            const response = await client.messages.create(request);

            const summary = response.content
                .filter(function (b) { return b.type === 'text'; })
                .map(function (b) { return b.text; })
                .join('\n');

            if (!summary) {
                // Diagnostic: shows e.g. ['thinking'] with output_tokens == max_tokens
                console.error(
                    'Empty summary. stop_reason=%s blocks=%j output_tokens=%s',
                    response.stop_reason,
                    response.content.map(function (b) { return b.type; }),
                    response.usage && response.usage.output_tokens
                );
                return res.status(502).json({
                    error:
                        response.stop_reason === 'max_tokens'
                            ? 'Model ran out of output tokens before writing a summary. Increase maxTokens or disable thinking.'
                            : 'Model returned no text.',
                });
            }

            const parsed = parseReport(summary);
            /*
            if (parsed) {
                const len = function (x) { return JSON.stringify(x === undefined ? null : x).length; };
                console.log(
                    'bundleSummarizer: output_tokens=%s thinking=%s chars %j',
                    response.usage && response.usage.output_tokens,
                    response.usage && response.usage.output_tokens_details &&
                    response.usage.output_tokens_details.thinking_tokens,
                    {
                        overview: len(parsed.overview),
                        clinicalSummary: len(parsed.clinicalSummary),
                        issueCount: (parsed.issues || []).length,
                        issues: len(parsed.issues),
                        improvements: len(parsed.improvements),
                        limitations: len(parsed.limitations)
                    }
                );
            }

            */
            if (!parsed) {
                console.error(
                    'Could not parse model output as JSON. stop_reason=%s output_tokens=%s chars=%s start=%j end=%j',
                    response.stop_reason,
                    response.usage && response.usage.output_tokens,
                    summary.length,
                    summary.slice(0, 120),
                    summary.slice(-120)
                );
            }

            res.json({
                report: parsed ? normaliseReport(parsed, bundle) : null,
                // Only sent when parsing failed, so the UI can still show something
                rawText: parsed ? undefined : summary,
                stopReason: response.stop_reason,
                truncated: response.stop_reason === 'max_tokens',
                localChecks: localChecks,
                validatorIssues: validatorIssues,
                usage: response.usage,
            });
        } catch (err) {
            console.error('Claude API error:', err && err.status, err && err.message);
            const status = err && err.status >= 400 && err.status < 600 && err.status !== 401 ? err.status : 502;
            res.status(status).json({
                error: 'Failed to generate summary.',
                // handy while developing; not sent in production
                detail: process.env.NODE_ENV === 'production' ? undefined : (err && err.message)
            });
        }
    });
}

module.exports = {
    setup: setup,
};
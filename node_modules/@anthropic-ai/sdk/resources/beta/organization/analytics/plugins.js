"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Plugins = void 0;
const resource_1 = require("../../../../core/resource.js");
const pagination_1 = require("../../../../core/pagination.js");
class Plugins extends resource_1.APIResource {
    /**
     * Get per-plugin install + invocation usage for a given day, with pagination.
     *
     * Returns plugin usage metrics for the organization across Cowork and Claude Code,
     * sorted by plugin name. The `plugin_name` value `third-party` is an aggregate
     * bucket, not a plugin: it collects plugin activity, from either surface, for
     * which the reporting client did not provide a plugin name — so an organization's
     * own plugins can contribute both to their own named rows and to this bucket. Use
     * `group_by[]` to break usage out per member, per RBAC group, or per product
     * surface (Cowork / Claude Code), and `filter[]` to scope results; the parameter
     * descriptions list the supported dimensions. Requires an API key with the
     * `read:analytics` scope. `starting_date` / `ending_date` select range-rollup mode
     * like `/skills`.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const betaAnalyticsPluginActivity of client.beta.organization.analytics.plugins.list()) {
     *   // ...
     * }
     * ```
     */
    list(query = {}, options) {
        return this._client.getAPIList('/v1/organizations/analytics/plugins?beta=true', (pagination_1.PageCursor), { query, ...options });
    }
}
exports.Plugins = Plugins;
//# sourceMappingURL=plugins.js.map
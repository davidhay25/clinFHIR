import { APIResource } from "../../../../core/resource.mjs";
import { PageCursor } from "../../../../core/pagination.mjs";
export class Connectors extends APIResource {
    /**
     * Get per-connector usage for a given day, with cursor-based pagination.
     *
     * Returns connector usage metrics for the organization, sorted by connector name.
     * Connector names are normalized from their various sources — for example,
     * "Atlassian MCP server" and "mcp-atlassian" both appear as "atlassian". Use
     * `group_by[]` to break usage out per member, per RBAC group, or per product
     * surface, and `filter[]` to scope results; the parameter descriptions list the
     * supported dimensions. Available to organizations on a Claude Enterprise plan.
     * Requires an API key with the `read:analytics` scope.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const betaAnalyticsConnectorActivity of client.beta.organization.analytics.connectors.list()) {
     *   // ...
     * }
     * ```
     */
    list(query = {}, options) {
        return this._client.getAPIList('/v1/organizations/analytics/connectors?beta=true', (PageCursor), { query, ...options });
    }
}
//# sourceMappingURL=connectors.mjs.map
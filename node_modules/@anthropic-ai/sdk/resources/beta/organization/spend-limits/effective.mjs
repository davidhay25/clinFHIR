import { APIResource } from "../../../../core/resource.mjs";
import { PageCursor } from "../../../../core/pagination.mjs";
export class Effective extends APIResource {
    /**
     * List each member's effective spend limit and period-to-date spend.
     *
     * Returns one row per (member, period) the member resolves a spend limit for, with
     * the `source` scope the spend limit was inherited from. Paginates by member, so a
     * member's periods never split across pages. Listing Claude Console limits is in
     * an early access preview. To request access, contact your Anthropic account team.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const betaSpendSummary of client.beta.organization.spendLimits.effective.list()) {
     *   // ...
     * }
     * ```
     */
    list(query = {}, options) {
        return this._client.getAPIList('/v1/organizations/spend_limits/effective?beta=true', (PageCursor), { query, ...options });
    }
}
//# sourceMappingURL=effective.mjs.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncreaseRequests = void 0;
const resource_1 = require("../../../../core/resource.js");
const pagination_1 = require("../../../../core/pagination.js");
const path_1 = require("../../../../internal/utils/path.js");
class IncreaseRequests extends resource_1.APIResource {
    /**
     * Retrieve a spend limit increase request.
     *
     * While `pending`, the response includes a live `spend_summary` for the requester
     * at the request's period.
     *
     * @example
     * ```ts
     * const betaSpendLimitIncreaseRequest =
     *   await client.beta.organization.spendLimits.increaseRequests.retrieve(
     *     'spend_limit_increase_request_id',
     *   );
     * ```
     */
    retrieve(spendLimitIncreaseRequestID, options) {
        return this._client.get((0, path_1.path) `/v1/organizations/spend_limit_increase_requests/${spendLimitIncreaseRequestID}?beta=true`, options);
    }
    /**
     * List spend limit increase requests, most recent first.
     *
     * Pending requests include a live `spend_summary` for the requester. Requests
     * whose requester is no longer a member are excluded.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const betaSpendLimitIncreaseRequest of client.beta.organization.spendLimits.increaseRequests.list()) {
     *   // ...
     * }
     * ```
     */
    list(query = {}, options) {
        return this._client.getAPIList('/v1/organizations/spend_limit_increase_requests?beta=true', (pagination_1.PageCursor), { query, ...options });
    }
    /**
     * Approve a pending spend limit increase request.
     *
     * Writes a per-user spend limit at `amount` for the requester and transitions the
     * request to `approved`. `period` defaults to the period the member was blocked
     * on. Anthropic emails the requester unless `suppress_notification` is set.
     *
     * @example
     * ```ts
     * const response =
     *   await client.beta.organization.spendLimits.increaseRequests.approve(
     *     'spend_limit_increase_request_id',
     *     { amount: '50000' },
     *   );
     * ```
     */
    approve(spendLimitIncreaseRequestID, body, options) {
        return this._client.post((0, path_1.path) `/v1/organizations/spend_limit_increase_requests/${spendLimitIncreaseRequestID}/approve?beta=true`, { body, ...options });
    }
    /**
     * Deny a pending spend limit increase request.
     *
     * Idempotent on `denied`; denying an already-`approved` request returns 400.
     * Anthropic emails the requester unless `suppress_notification` is set.
     *
     * @example
     * ```ts
     * const betaSpendLimitIncreaseRequest =
     *   await client.beta.organization.spendLimits.increaseRequests.deny(
     *     'spend_limit_increase_request_id',
     *   );
     * ```
     */
    deny(spendLimitIncreaseRequestID, body, options) {
        return this._client.post((0, path_1.path) `/v1/organizations/spend_limit_increase_requests/${spendLimitIncreaseRequestID}/deny?beta=true`, { body, ...options });
    }
}
exports.IncreaseRequests = IncreaseRequests;
//# sourceMappingURL=increase-requests.js.map
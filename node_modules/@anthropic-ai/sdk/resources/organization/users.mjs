import { APIResource } from "../../core/resource.mjs";
import { Page } from "../../core/pagination.mjs";
import { path } from "../../internal/utils/path.mjs";
export class Users extends APIResource {
    /**
     * Retrieve a member of the organization by user ID.
     *
     * @example
     * ```ts
     * const organizationUser =
     *   await client.organization.users.retrieve('user_id');
     * ```
     */
    retrieve(userID, options) {
        return this._client.get(path `/v1/organizations/users/${userID}`, options);
    }
    /**
     * Update a member's organization role.
     *
     * @example
     * ```ts
     * const organizationUser =
     *   await client.organization.users.update('user_id', {
     *     role: 'user',
     *   });
     * ```
     */
    update(userID, body, options) {
        return this._client.post(path `/v1/organizations/users/${userID}`, { body, ...options });
    }
    /**
     * List the organization's members.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const organizationUser of client.organization.users.list()) {
     *   // ...
     * }
     * ```
     */
    list(query = {}, options) {
        return this._client.getAPIList('/v1/organizations/users', (Page), { query, ...options });
    }
    /**
     * Remove a member from the organization.
     *
     * @example
     * ```ts
     * const user = await client.organization.users.remove(
     *   'user_id',
     * );
     * ```
     */
    remove(userID, options) {
        return this._client.delete(path `/v1/organizations/users/${userID}`, options);
    }
}
//# sourceMappingURL=users.mjs.map
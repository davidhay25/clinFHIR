import { APIResource } from "../../../../core/resource.mjs";
import { PageCursor } from "../../../../core/pagination.mjs";
import { path } from "../../../../internal/utils/path.mjs";
export class Members extends APIResource {
    /**
     * List members of an RBAC Group.
     *
     * The RBAC Groups API is available to Claude Enterprise organizations only.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const betaRBACGroupMember of client.beta.organization.rbacGroups.members.list(
     *   'rbac_group_id',
     * )) {
     *   // ...
     * }
     * ```
     */
    list(rbacGroupID, query = {}, options) {
        return this._client.getAPIList(path `/v1/organizations/rbac_groups/${rbacGroupID}/members?beta=true`, (PageCursor), { query, ...options });
    }
    /**
     * Add a User to an RBAC Group. Membership of groups provisioned by an identity
     * provider (source type `"scim"`) cannot be modified via the API while an
     * organization in the tenant uses SCIM provisioning.
     *
     * The RBAC Groups API is available to Claude Enterprise organizations only.
     *
     * @example
     * ```ts
     * const betaRBACGroupMember =
     *   await client.beta.organization.rbacGroups.members.add(
     *     'rbac_group_id',
     *     { user_id: 'user_01WCz1FkmYMm4gnmykNKUu3Q' },
     *   );
     * ```
     */
    add(rbacGroupID, body, options) {
        return this._client.post(path `/v1/organizations/rbac_groups/${rbacGroupID}/members?beta=true`, {
            body,
            ...options,
        });
    }
    /**
     * Remove a User from an RBAC Group. Membership of groups provisioned by an
     * identity provider (source type `"scim"`) cannot be modified via the API while an
     * organization in the tenant uses SCIM provisioning.
     *
     * The RBAC Groups API is available to Claude Enterprise organizations only.
     *
     * @example
     * ```ts
     * const member =
     *   await client.beta.organization.rbacGroups.members.remove(
     *     'user_id',
     *     { rbac_group_id: 'rbac_group_id' },
     *   );
     * ```
     */
    remove(userID, params, options) {
        const { rbac_group_id } = params;
        return this._client.delete(path `/v1/organizations/rbac_groups/${rbac_group_id}/members/${userID}?beta=true`, options);
    }
}
//# sourceMappingURL=members.mjs.map
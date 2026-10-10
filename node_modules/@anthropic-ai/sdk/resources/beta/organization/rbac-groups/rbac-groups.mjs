import { APIResource } from "../../../../core/resource.mjs";
import * as MembersAPI from "./members.mjs";
import { Members, } from "./members.mjs";
import { PageCursor } from "../../../../core/pagination.mjs";
import { path } from "../../../../internal/utils/path.mjs";
export var RBACGroups = /* @__PURE__ */ (() => {
    class RBACGroups extends APIResource {
        constructor() {
            super(...arguments);
            this.members = new MembersAPI.Members(this._client);
        }
        /**
         * Create an RBAC Group in the Claude Enterprise tenant. Groups created via the API
         * have source type `"direct"`.
         *
         * The RBAC Groups API is available to Claude Enterprise organizations only.
         *
         * @example
         * ```ts
         * const betaRBACGroup =
         *   await client.beta.organization.rbacGroups.create({
         *     name: 'Engineering',
         *   });
         * ```
         */
        create(body, options) {
            return this._client.post('/v1/organizations/rbac_groups?beta=true', { body, ...options });
        }
        /**
         * Retrieve an RBAC Group by ID.
         *
         * The RBAC Groups API is available to Claude Enterprise organizations only.
         *
         * @example
         * ```ts
         * const betaRBACGroup =
         *   await client.beta.organization.rbacGroups.retrieve(
         *     'rbac_group_id',
         *   );
         * ```
         */
        retrieve(rbacGroupID, options) {
            return this._client.get(path `/v1/organizations/rbac_groups/${rbacGroupID}?beta=true`, options);
        }
        /**
         * Update an RBAC Group's name. Groups provisioned by an identity provider (source
         * type `"scim"`) cannot be modified via the API while an organization in the
         * tenant uses SCIM provisioning.
         *
         * The RBAC Groups API is available to Claude Enterprise organizations only.
         *
         * @example
         * ```ts
         * const betaRBACGroup =
         *   await client.beta.organization.rbacGroups.update(
         *     'rbac_group_id',
         *   );
         * ```
         */
        update(rbacGroupID, body, options) {
            return this._client.post(path `/v1/organizations/rbac_groups/${rbacGroupID}?beta=true`, {
                body,
                ...options,
            });
        }
        /**
         * List RBAC Groups in the Claude Enterprise tenant.
         *
         * The RBAC Groups API is available to Claude Enterprise organizations only.
         *
         * @example
         * ```ts
         * // Automatically fetches more pages as needed.
         * for await (const betaRBACGroup of client.beta.organization.rbacGroups.list()) {
         *   // ...
         * }
         * ```
         */
        list(query = {}, options) {
            return this._client.getAPIList('/v1/organizations/rbac_groups?beta=true', (PageCursor), {
                query,
                ...options,
            });
        }
        /**
         * Delete an RBAC Group. Groups provisioned by an identity provider (source type
         * `"scim"`) cannot be deleted via the API while an organization in the tenant uses
         * SCIM provisioning.
         *
         * The RBAC Groups API is available to Claude Enterprise organizations only.
         *
         * @example
         * ```ts
         * const rbacGroup =
         *   await client.beta.organization.rbacGroups.delete(
         *     'rbac_group_id',
         *   );
         * ```
         */
        delete(rbacGroupID, options) {
            return this._client.delete(path `/v1/organizations/rbac_groups/${rbacGroupID}?beta=true`, options);
        }
    }
    RBACGroups.Members = Members;
    return RBACGroups;
})();
//# sourceMappingURL=rbac-groups.mjs.map
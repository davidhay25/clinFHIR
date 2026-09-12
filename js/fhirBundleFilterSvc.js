angular.module("sampleApp")
    .service('fhirBundleFilterSvc', function($filter, $q, $http) {

        // ---- Build lookup indexes for a bundle -----------------------------

        function buildIndexes(entries) {
            var byFullUrl = {};
            var byRelative = {};

            entries.forEach(function (entry) {
                if (entry.fullUrl) {
                    byFullUrl[entry.fullUrl] = entry;
                }
                var res = entry.resource;
                if (res && res.resourceType && res.id) {
                    byRelative[res.resourceType + '/' + res.id] = entry;
                }
            });

            return { byFullUrl: byFullUrl, byRelative: byRelative };
        }

        function resolveIdentifier(idOrObj, indexes) {
            if (!idOrObj) return null;

            if (angular.isString(idOrObj)) {
                if (indexes.byFullUrl.hasOwnProperty(idOrObj)) return indexes.byFullUrl[idOrObj];
                if (indexes.byRelative.hasOwnProperty(idOrObj)) return indexes.byRelative[idOrObj];
                var match = idOrObj.match(/([A-Za-z]+\/[A-Za-z0-9\-.]+)$/);
                if (match && indexes.byRelative.hasOwnProperty(match[1])) return indexes.byRelative[match[1]];
                return null;
            }

            // Assume resource-like object
            if (idOrObj.fullUrl && indexes.byFullUrl.hasOwnProperty(idOrObj.fullUrl)) {
                return indexes.byFullUrl[idOrObj.fullUrl];
            }
            if (idOrObj.resourceType && idOrObj.id) {
                var key = idOrObj.resourceType + '/' + idOrObj.id;
                if (indexes.byRelative.hasOwnProperty(key)) return indexes.byRelative[key];
            }
            return null;
        }

        // ---- Extract every `reference` string found inside a resource -----

        function collectReferences(node, out) {
            out = out || [];
            if (node === null || typeof node !== 'object') return out;

            if (angular.isArray(node)) {
                node.forEach(function (item) {
                    collectReferences(item, out);
                });
                return out;
            }

            angular.forEach(node, function (value, key) {
                if (key === 'reference' && angular.isString(value)) {
                    out.push(value);
                } else if (value && typeof value === 'object') {
                    collectReferences(value, out);
                }
            });
            return out;
        }

        function referencesOf(entry) {
            return collectReferences(entry.resource).filter(function (r) {
                return r.indexOf('#') !== 0; // skip contained refs
            });
        }

        // ---- Main filter routine --------------------------------------------

        function filterBundleWithReferences(bundle, seeds, opts) {
            opts = opts || {};
            var transitive = !!opts.transitive;
            var direction = opts.direction || 'both';

            if (!bundle || !angular.isArray(bundle.entry)) {
                throw new Error('bundle must be a FHIR Bundle with an entry array');
            }

            var entries = bundle.entry;
            var indexes = buildIndexes(entries);

            var refsByEntry = new Map();
            entries.forEach(function (entry) {
                refsByEntry.set(entry, referencesOf(entry));
            });

            var seedEntries = new Set();
            seeds.forEach(function (seed) {
                var resolved = resolveIdentifier(seed, indexes);
                if (resolved) {
                    seedEntries.add(resolved);
                } else {
                    console.warn('fhirBundleFilterSvc: could not resolve seed identifier to a bundle entry:', seed);
                }
            });

            var included = new Set(seedEntries);
            var frontier = new Set(seedEntries);

            do {
                var nextFrontier = new Set();

                frontier.forEach(function (entry) {
                    // Forward: things this entry references
                    if (direction === 'both' || direction === 'referenced') {
                        (refsByEntry.get(entry) || []).forEach(function (refStr) {
                            var target = resolveIdentifier(refStr, indexes);
                            if (target && !included.has(target)) {
                                included.add(target);
                                nextFrontier.add(target);
                            }
                        });
                    }

                    // Backward: things that reference this entry
                    if (direction === 'both' || direction === 'referencing') {
                        var entryKeys = [
                            entry.fullUrl,
                            entry.resource ? (entry.resource.resourceType + '/' + entry.resource.id) : null,
                        ].filter(Boolean);

                        entries.forEach(function (other) {
                            if (included.has(other)) return;
                            var otherRefs = refsByEntry.get(other) || [];
                            var pointsAtEntry = otherRefs.some(function (refStr) {
                                var resolved = resolveIdentifier(refStr, indexes);
                                return resolved === entry || entryKeys.indexOf(refStr) !== -1;
                            });
                            if (pointsAtEntry) {
                                included.add(other);
                                nextFrontier.add(other);
                            }
                        });
                    }
                });

                frontier = nextFrontier;
            } while (transitive && frontier.size > 0);

            var resultEntries = entries.filter(function (entry) {
                return included.has(entry);
            });

            var result = angular.extend({}, bundle, { entry: resultEntries });
            if (angular.isNumber(bundle.total)) {
                result.total = resultEntries.length;
            }

            return result;
        }

        return {
            filter: filterBundleWithReferences
        };

    });

/* ---------------------------------------------------------------------------
 * Example usage:
 *
 *   function MyCtrl(fhirBundleFilterSvc) {
 *     var filtered = fhirBundleFilterSvc.filter(bundle, [
 *       'urn:uuid:1111-2222',
 *       'Observation/obs-42',
 *       { resourceType: 'Patient', id: 'pat-1' }
 *     ]);
 *
 *     // transitive expansion:
 *     fhirBundleFilterSvc.filter(bundle, seeds, { transitive: true });
 *
 *     // only forward references (what the seeds point to):
 *     fhirBundleFilterSvc.filter(bundle, seeds, { direction: 'referenced' });
 *   }
 * ------------------------------------------------------------------------- */
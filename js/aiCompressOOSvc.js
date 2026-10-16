// AngularJS service: takes a FHIR R4 OperationOutcome, returns compact text
// suitable for a prompt. ES5 only.
//
// Usage:
//   angular.module('clinfhirApp').controller('myCtrl', function ($scope, ooCompressService) {
//       var text = ooCompressService.compress($scope.validationOO);
//       var text2 = ooCompressService.compress(oo, {includeInformation: false});
//   });
//
// Also exposes ooCompressService.condense(oo, opts) for the structured form
// ({total, counts, groups}) if you want to render it in the UI.

angular.module('sampleApp').factory('ooCompressService', function () {

    var SEVERITY_ORDER = ['fatal', 'error', 'warning', 'information'];

    function stripPosition(s) {
        return s ? s.replace(/,?\s*line\s+\d+,?\s*col(?:umn)?\s+\d+/i, '').trim() : s;
    }
    function generalise(s) {
        return (s || '').replace(/\[\d+\]/g, '[*]');
    }
    function clean(s, max) {
        var t = String(s).replace(/\s+/g, ' ').trim();
        return t.length > max ? t.slice(0, max - 1) + '…' : t;
    }
    function rank(s) {
        var i = SEVERITY_ORDER.indexOf(s);
        return i === -1 ? SEVERITY_ORDER.length : i;
    }

    function condense(oo, opts) {
        opts = opts || {};
        var includeInfo = opts.includeInformation !== false;   // default true
        var maxExamples = opts.maxExamples || 3;
        var maxLen = opts.maxMessageLength || 400;

        if (!oo || oo.resourceType !== 'OperationOutcome') {
            return {total: 0, counts: {}, groups: []};
        }

        var groups = {}, counts = {}, total = 0;

        (oo.issue || []).forEach(function (issue) {
            var severity = issue.severity || 'error';
            if (!includeInfo && severity === 'information') { return; }

            var det = issue.details || {};
            var message = clean(
                issue.diagnostics || det.text ||
                (det.coding && det.coding[0] && det.coding[0].display) ||
                issue.code || 'unspecified', maxLen);

            var path = (issue.expression && issue.expression[0]) ||
                (issue.location && stripPosition(issue.location[0])) || null;

            var key = [severity, issue.code || '', generalise(message)].join('|');
            var g = groups[key];
            if (!g) {
                g = groups[key] = {severity: severity, code: issue.code || null,
                    message: generalise(message), count: 0, paths: []};
            }
            g.count++;
            total++;
            counts[severity] = (counts[severity] || 0) + 1;
            if (path && g.paths.length < maxExamples && g.paths.indexOf(path) === -1) {
                g.paths.push(path);
            }
        });

        var list = Object.keys(groups).map(function (k) { return groups[k]; });
        list.sort(function (a, b) {
            return rank(a.severity) - rank(b.severity) || b.count - a.count;
        });
        return {total: total, counts: counts, groups: list};
    }

    function toText(c) {
        if (!c.total) { return 'No validation issues reported.'; }
        var head = Object.keys(c.counts).map(function (s) { return c.counts[s] + ' ' + s; }).join(', ');
        var lines = c.groups.map(function (g) {
            var times = g.count > 1 ? ' (x' + g.count + ')' : '';
            var code = g.code ? '[' + g.code + '] ' : '';
            var where = g.paths.length
                ? ' @ ' + g.paths.join('; ') + (g.count > g.paths.length ? '; …' : '') : '';
            return g.severity.toUpperCase() + times + ': ' + code + g.message + where;
        });
        return 'Validator reported ' + head + '\n' + lines.join('\n');
    }

    return {
        compress: function (oo, opts) { return toText(condense(oo, opts)); },
        condense: condense
    };
});
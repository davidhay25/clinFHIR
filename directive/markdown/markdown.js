/*
 * Renders a markdown string as sanitised HTML.
 * Requires marked and DOMPurify to be loaded first.
 *
 *   <markdown text="someMarkdownString"></markdown>
 *     <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/dompurify/dist/purify.min.js"></script>
 *
 * Optional attribute: on-resource="fn(resource)" is called when a link whose target looks like
 * ResourceType/id (e.g. MedicationRequest/mr-12) is clicked. Those links never navigate.
 */
angular.module('sampleApp')
    .directive('markdown', function () {
        const RESOURCE_LINK = /^[A-Z][A-Za-z]+\/[A-Za-z0-9\-.]+$/;

        DOMPurify.addHook('afterSanitizeAttributes', function (node) {
            if (node.tagName === 'A') {
                node.setAttribute('target', '_blank');
                node.setAttribute('rel', 'noopener noreferrer');
            }
        });

        return {
            restrict: 'E',
            scope: { text: '=', onResource: '&' },
            link: function (scope, el) {

                scope.$watch('text', function (md) {
                    if (!md) { el.empty(); return; }
                    el.html(DOMPurify.sanitize(marked.parse(md))); // marked(md) on older versions

                    //turn resource links into in-app actions
                    Array.prototype.forEach.call(el[0].querySelectorAll('a'), function (a) {
                        const href = a.getAttribute('href') || '';
                        if (RESOURCE_LINK.test(href)) {
                            a.setAttribute('data-resource', href);
                            a.setAttribute('href', '');
                            a.removeAttribute('target');
                            a.classList.add('br-reslink');
                        }
                    });
                });

                el.on('click', function (ev) {
                    const a = ev.target.closest && ev.target.closest('a[data-resource]');
                    if (!a) return;
                    ev.preventDefault();
                    const resource = a.getAttribute('data-resource');
                    scope.$apply(function () { scope.onResource({ resource: resource }); });
                });

                scope.$on('$destroy', function () { el.off('click'); });
            }
        };
    });
angular.module('sampleApp')
    .directive('dragReorder', function () {
    return {
        scope: {
            list: '=dragReorder',   // the array to reorder
            index: '=dragIndex',    // $index of this item
            onReorder: '&'          // optional callback after reorder
        },
        link: function (scope, el) {
            var node = el[0];
            node.draggable = true;

            node.addEventListener('dragstart', function (e) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(scope.index));
                node.classList.add('dragging');
            });

            node.addEventListener('dragend', function () {
                node.classList.remove('dragging');
            });

            node.addEventListener('dragover', function (e) {
                e.preventDefault(); // required to allow dropping
                e.dataTransfer.dropEffect = 'move';
                node.classList.add('drag-over');
            });

            node.addEventListener('dragleave', function () {
                node.classList.remove('drag-over');
            });

            node.addEventListener('drop', function (e) {
                e.preventDefault();
                node.classList.remove('drag-over');

                var from = parseInt(e.dataTransfer.getData('text/plain'), 10);
                var to = scope.index;
                if (isNaN(from) || from === to) return;

                scope.$apply(function () {
                    scope.list.splice(to, 0, scope.list.splice(from, 1)[0]);
                    scope.onReorder();
                });
            });
        }
    };
});
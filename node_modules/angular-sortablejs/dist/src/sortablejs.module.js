"use strict";
var core_1 = require('@angular/core');
var sortablejs_directive_1 = require('./sortablejs.directive');
var SortablejsModule = (function () {
    function SortablejsModule() {
    }
    SortablejsModule.forRoot = function (globalOptions) {
        SortablejsModule._globalOptions = globalOptions;
        return SortablejsModule;
    };
    SortablejsModule._globalOptions = {};
    SortablejsModule.decorators = [
        { type: core_1.NgModule, args: [{
                    declarations: [sortablejs_directive_1.SortablejsDirective],
                    exports: [sortablejs_directive_1.SortablejsDirective]
                },] },
    ];
    /** @nocollapse */
    SortablejsModule.ctorParameters = function () { return []; };
    return SortablejsModule;
}());
exports.SortablejsModule = SortablejsModule;
//# sourceMappingURL=sortablejs.module.js.map
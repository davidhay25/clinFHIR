"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ColorSchemeType = exports.DiffStyleType = exports.LineMatchingType = exports.OutputFormatType = exports.LineType = void 0;
var LineType;
(function (LineType) {
    LineType["INSERT"] = "insert";
    LineType["DELETE"] = "delete";
    LineType["CONTEXT"] = "context";
})(LineType || (exports.LineType = LineType = {}));
exports.OutputFormatType = {
    LINE_BY_LINE: 'line-by-line',
    SIDE_BY_SIDE: 'side-by-side',
};
exports.LineMatchingType = {
    LINES: 'lines',
    WORDS: 'words',
    NONE: 'none',
};
exports.DiffStyleType = {
    WORD: 'word',
    CHAR: 'char',
};
var ColorSchemeType;
(function (ColorSchemeType) {
    ColorSchemeType["AUTO"] = "auto";
    ColorSchemeType["DARK"] = "dark";
    ColorSchemeType["LIGHT"] = "light";
})(ColorSchemeType || (exports.ColorSchemeType = ColorSchemeType = {}));
//# sourceMappingURL=types.js.map
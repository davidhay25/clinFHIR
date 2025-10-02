export var LineType;
(function (LineType) {
    LineType["INSERT"] = "insert";
    LineType["DELETE"] = "delete";
    LineType["CONTEXT"] = "context";
})(LineType || (LineType = {}));
export const OutputFormatType = {
    LINE_BY_LINE: 'line-by-line',
    SIDE_BY_SIDE: 'side-by-side',
};
export const LineMatchingType = {
    LINES: 'lines',
    WORDS: 'words',
    NONE: 'none',
};
export const DiffStyleType = {
    WORD: 'word',
    CHAR: 'char',
};
export var ColorSchemeType;
(function (ColorSchemeType) {
    ColorSchemeType["AUTO"] = "auto";
    ColorSchemeType["DARK"] = "dark";
    ColorSchemeType["LIGHT"] = "light";
})(ColorSchemeType || (ColorSchemeType = {}));
//# sourceMappingURL=types.js.map
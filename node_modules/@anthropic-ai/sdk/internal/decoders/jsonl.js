"use strict";
var _JSONLDecoder_consumed;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONLDecoder = void 0;
const tslib_1 = require("../tslib.js");
const error_1 = require("../../core/error.js");
const shims_1 = require("../shims.js");
const line_1 = require("./line.js");
var JSONLDecoder = /* @__PURE__ */ (() => {
    class JSONLDecoder {
        constructor(iterator, controller) {
            this.iterator = iterator;
            _JSONLDecoder_consumed.set(this, false);
            this.controller = controller;
        }
        async *decoder() {
            if (tslib_1.__classPrivateFieldGet(this, _JSONLDecoder_consumed, "f")) {
                throw new error_1.AnthropicError('Cannot iterate over a consumed stream.');
            }
            tslib_1.__classPrivateFieldSet(this, _JSONLDecoder_consumed, true, "f");
            const lineDecoder = new line_1.LineDecoder();
            for await (const chunk of this.iterator) {
                for (const line of lineDecoder.decode(chunk)) {
                    yield JSON.parse(line);
                }
            }
            for (const line of lineDecoder.flush()) {
                yield JSON.parse(line);
            }
        }
        [(_JSONLDecoder_consumed = new WeakMap(), Symbol.asyncIterator)]() {
            return this.decoder();
        }
        static fromResponse(response, controller) {
            if (!response.body) {
                controller.abort();
                if (typeof globalThis.navigator !== 'undefined' &&
                    globalThis.navigator.product === 'ReactNative') {
                    throw new error_1.AnthropicError(`The default react-native fetch implementation does not support streaming. Please use expo/fetch: https://docs.expo.dev/versions/latest/sdk/expo/#expofetch-api`);
                }
                throw new error_1.AnthropicError(`Attempted to iterate over a response with no body`);
            }
            return new JSONLDecoder((0, shims_1.ReadableStreamToAsyncIterable)(response.body), controller);
        }
    }
    return JSONLDecoder;
})();
exports.JSONLDecoder = JSONLDecoder;
//# sourceMappingURL=jsonl.js.map
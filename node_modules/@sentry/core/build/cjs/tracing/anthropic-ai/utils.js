Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

const exports$1 = require('../../exports.js');
const spanstatus = require('../spanstatus.js');
const constants = require('./constants.js');

/**
 * Check if a method path should be instrumented
 */
function shouldInstrument(methodPath) {
  return constants.ANTHROPIC_AI_INSTRUMENTED_METHODS.includes(methodPath );
}

/**
 * Capture error information from the response
 * @see https://docs.anthropic.com/en/api/errors#error-shapes
 */
function handleResponseError(span, response) {
  if (response.error) {
    span.setStatus({ code: spanstatus.SPAN_STATUS_ERROR, message: response.error.type || 'internal_error' });

    exports$1.captureException(response.error, {
      mechanism: {
        handled: false,
        type: 'auto.ai.anthropic.anthropic_error',
      },
    });
  }
}

exports.handleResponseError = handleResponseError;
exports.shouldInstrument = shouldInstrument;
//# sourceMappingURL=utils.js.map

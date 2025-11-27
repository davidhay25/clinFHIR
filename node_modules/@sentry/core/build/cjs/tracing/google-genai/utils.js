Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

const constants = require('./constants.js');

/**
 * Check if a method path should be instrumented
 */
function shouldInstrument(methodPath) {
  // Check for exact matches first (like 'models.generateContent')
  if (constants.GOOGLE_GENAI_INSTRUMENTED_METHODS.includes(methodPath )) {
    return true;
  }

  // Check for method name matches (like 'sendMessage' from chat instances)
  const methodName = methodPath.split('.').pop();
  return constants.GOOGLE_GENAI_INSTRUMENTED_METHODS.includes(methodName );
}

/**
 * Check if a method is a streaming method
 */
function isStreamingMethod(methodPath) {
  return (
    methodPath.includes('Stream') ||
    methodPath.endsWith('generateContentStream') ||
    methodPath.endsWith('sendMessageStream')
  );
}

exports.isStreamingMethod = isStreamingMethod;
exports.shouldInstrument = shouldInstrument;
//# sourceMappingURL=utils.js.map

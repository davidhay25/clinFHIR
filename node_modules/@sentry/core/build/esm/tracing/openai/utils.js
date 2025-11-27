import { OPENAI_OPERATIONS, GEN_AI_RESPONSE_ID_ATTRIBUTE, OPENAI_RESPONSE_ID_ATTRIBUTE, GEN_AI_RESPONSE_MODEL_ATTRIBUTE, OPENAI_RESPONSE_MODEL_ATTRIBUTE, OPENAI_RESPONSE_TIMESTAMP_ATTRIBUTE, GEN_AI_RESPONSE_FINISH_REASONS_ATTRIBUTE, GEN_AI_RESPONSE_TOOL_CALLS_ATTRIBUTE, GEN_AI_USAGE_INPUT_TOKENS_ATTRIBUTE, OPENAI_USAGE_PROMPT_TOKENS_ATTRIBUTE, GEN_AI_USAGE_OUTPUT_TOKENS_ATTRIBUTE, OPENAI_USAGE_COMPLETION_TOKENS_ATTRIBUTE, GEN_AI_USAGE_TOTAL_TOKENS_ATTRIBUTE } from '../ai/gen-ai-attributes.js';
import { INSTRUMENTED_METHODS } from './constants.js';

/**
 * Maps OpenAI method paths to Sentry operation names
 */
function getOperationName(methodPath) {
  if (methodPath.includes('chat.completions')) {
    return OPENAI_OPERATIONS.CHAT;
  }
  if (methodPath.includes('responses')) {
    return OPENAI_OPERATIONS.RESPONSES;
  }
  if (methodPath.includes('embeddings')) {
    return OPENAI_OPERATIONS.EMBEDDINGS;
  }
  return methodPath.split('.').pop() || 'unknown';
}

/**
 * Get the span operation for OpenAI methods
 * Following Sentry's convention: "gen_ai.{operation_name}"
 */
function getSpanOperation(methodPath) {
  return `gen_ai.${getOperationName(methodPath)}`;
}

/**
 * Check if a method path should be instrumented
 */
function shouldInstrument(methodPath) {
  return INSTRUMENTED_METHODS.includes(methodPath );
}

/**
 * Build method path from current traversal
 */
function buildMethodPath(currentPath, prop) {
  return currentPath ? `${currentPath}.${prop}` : prop;
}

/**
 * Check if response is a Chat Completion object
 */
function isChatCompletionResponse(response) {
  return (
    response !== null &&
    typeof response === 'object' &&
    'object' in response &&
    (response ).object === 'chat.completion'
  );
}

/**
 * Check if response is a Responses API object
 */
function isResponsesApiResponse(response) {
  return (
    response !== null &&
    typeof response === 'object' &&
    'object' in response &&
    (response ).object === 'response'
  );
}

/**
 * Check if response is an Embeddings API object
 */
function isEmbeddingsResponse(response) {
  if (response === null || typeof response !== 'object' || !('object' in response)) {
    return false;
  }
  const responseObject = response ;
  return (
    responseObject.object === 'list' &&
    typeof responseObject.model === 'string' &&
    responseObject.model.toLowerCase().includes('embedding')
  );
}

/**
 * Check if streaming event is from the Responses API
 */
function isResponsesApiStreamEvent(event) {
  return (
    event !== null &&
    typeof event === 'object' &&
    'type' in event &&
    typeof (event ).type === 'string' &&
    ((event ).type ).startsWith('response.')
  );
}

/**
 * Check if streaming event is a chat completion chunk
 */
function isChatCompletionChunk(event) {
  return (
    event !== null &&
    typeof event === 'object' &&
    'object' in event &&
    (event ).object === 'chat.completion.chunk'
  );
}

/**
 * Add attributes for Chat Completion responses
 */
function addChatCompletionAttributes(
  span,
  response,
  recordOutputs,
) {
  setCommonResponseAttributes(span, response.id, response.model, response.created);
  if (response.usage) {
    setTokenUsageAttributes(
      span,
      response.usage.prompt_tokens,
      response.usage.completion_tokens,
      response.usage.total_tokens,
    );
  }
  if (Array.isArray(response.choices)) {
    const finishReasons = response.choices
      .map(choice => choice.finish_reason)
      .filter((reason) => reason !== null);
    if (finishReasons.length > 0) {
      span.setAttributes({
        [GEN_AI_RESPONSE_FINISH_REASONS_ATTRIBUTE]: JSON.stringify(finishReasons),
      });
    }

    // Extract tool calls from all choices (only if recordOutputs is true)
    if (recordOutputs) {
      const toolCalls = response.choices
        .map(choice => choice.message?.tool_calls)
        .filter(calls => Array.isArray(calls) && calls.length > 0)
        .flat();

      if (toolCalls.length > 0) {
        span.setAttributes({
          [GEN_AI_RESPONSE_TOOL_CALLS_ATTRIBUTE]: JSON.stringify(toolCalls),
        });
      }
    }
  }
}

/**
 * Add attributes for Responses API responses
 */
function addResponsesApiAttributes(span, response, recordOutputs) {
  setCommonResponseAttributes(span, response.id, response.model, response.created_at);
  if (response.status) {
    span.setAttributes({
      [GEN_AI_RESPONSE_FINISH_REASONS_ATTRIBUTE]: JSON.stringify([response.status]),
    });
  }
  if (response.usage) {
    setTokenUsageAttributes(
      span,
      response.usage.input_tokens,
      response.usage.output_tokens,
      response.usage.total_tokens,
    );
  }

  // Extract function calls from output (only if recordOutputs is true)
  if (recordOutputs) {
    const responseWithOutput = response ;
    if (Array.isArray(responseWithOutput.output) && responseWithOutput.output.length > 0) {
      // Filter for function_call type objects in the output array
      const functionCalls = responseWithOutput.output.filter(
        (item) =>
          typeof item === 'object' && item !== null && (item ).type === 'function_call',
      );

      if (functionCalls.length > 0) {
        span.setAttributes({
          [GEN_AI_RESPONSE_TOOL_CALLS_ATTRIBUTE]: JSON.stringify(functionCalls),
        });
      }
    }
  }
}

/**
 * Add attributes for Embeddings API responses
 */
function addEmbeddingsAttributes(span, response) {
  span.setAttributes({
    [OPENAI_RESPONSE_MODEL_ATTRIBUTE]: response.model,
    [GEN_AI_RESPONSE_MODEL_ATTRIBUTE]: response.model,
  });

  if (response.usage) {
    setTokenUsageAttributes(span, response.usage.prompt_tokens, undefined, response.usage.total_tokens);
  }
}

/**
 * Set token usage attributes
 * @param span - The span to add attributes to
 * @param promptTokens - The number of prompt tokens
 * @param completionTokens - The number of completion tokens
 * @param totalTokens - The number of total tokens
 */
function setTokenUsageAttributes(
  span,
  promptTokens,
  completionTokens,
  totalTokens,
) {
  if (promptTokens !== undefined) {
    span.setAttributes({
      [OPENAI_USAGE_PROMPT_TOKENS_ATTRIBUTE]: promptTokens,
      [GEN_AI_USAGE_INPUT_TOKENS_ATTRIBUTE]: promptTokens,
    });
  }
  if (completionTokens !== undefined) {
    span.setAttributes({
      [OPENAI_USAGE_COMPLETION_TOKENS_ATTRIBUTE]: completionTokens,
      [GEN_AI_USAGE_OUTPUT_TOKENS_ATTRIBUTE]: completionTokens,
    });
  }
  if (totalTokens !== undefined) {
    span.setAttributes({
      [GEN_AI_USAGE_TOTAL_TOKENS_ATTRIBUTE]: totalTokens,
    });
  }
}

/**
 * Set common response attributes
 * @param span - The span to add attributes to
 * @param id - The response id
 * @param model - The response model
 * @param timestamp - The response timestamp
 */
function setCommonResponseAttributes(span, id, model, timestamp) {
  span.setAttributes({
    [OPENAI_RESPONSE_ID_ATTRIBUTE]: id,
    [GEN_AI_RESPONSE_ID_ATTRIBUTE]: id,
  });
  span.setAttributes({
    [OPENAI_RESPONSE_MODEL_ATTRIBUTE]: model,
    [GEN_AI_RESPONSE_MODEL_ATTRIBUTE]: model,
  });
  span.setAttributes({
    [OPENAI_RESPONSE_TIMESTAMP_ATTRIBUTE]: new Date(timestamp * 1000).toISOString(),
  });
}

export { addChatCompletionAttributes, addEmbeddingsAttributes, addResponsesApiAttributes, buildMethodPath, getOperationName, getSpanOperation, isChatCompletionChunk, isChatCompletionResponse, isEmbeddingsResponse, isResponsesApiResponse, isResponsesApiStreamEvent, setCommonResponseAttributes, setTokenUsageAttributes, shouldInstrument };
//# sourceMappingURL=utils.js.map

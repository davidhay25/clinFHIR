import type { Span } from '../../types-hoist/span';
import type { AnthropicAiInstrumentedMethod, AnthropicAiResponse } from './types';
/**
 * Check if a method path should be instrumented
 */
export declare function shouldInstrument(methodPath: string): methodPath is AnthropicAiInstrumentedMethod;
/**
 * Capture error information from the response
 * @see https://docs.anthropic.com/en/api/errors#error-shapes
 */
export declare function handleResponseError(span: Span, response: AnthropicAiResponse): void;
//# sourceMappingURL=utils.d.ts.map
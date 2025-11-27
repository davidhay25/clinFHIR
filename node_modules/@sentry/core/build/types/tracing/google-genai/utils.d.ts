import type { GoogleGenAIIstrumentedMethod } from './types';
/**
 * Check if a method path should be instrumented
 */
export declare function shouldInstrument(methodPath: string): methodPath is GoogleGenAIIstrumentedMethod;
/**
 * Check if a method is a streaming method
 */
export declare function isStreamingMethod(methodPath: string): boolean;
//# sourceMappingURL=utils.d.ts.map
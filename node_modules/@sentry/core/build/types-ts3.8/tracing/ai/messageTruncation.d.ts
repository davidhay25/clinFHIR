/**
 * Default maximum size in bytes for GenAI messages.
 * Messages exceeding this limit will be truncated.
 */
export declare const DEFAULT_GEN_AI_MESSAGES_BYTE_LIMIT = 20000;
/**
 * Truncate an array of messages to fit within a byte limit.
 *
 * Strategy:
 * - Keeps the newest messages (from the end of the array)
 * - Uses O(n) algorithm: precompute sizes once, then find largest suffix under budget
 * - If no complete messages fit, attempts to truncate the newest single message
 *
 * @param messages - Array of messages to truncate
 * @param maxBytes - Maximum total byte limit for all messages
 * @returns Truncated array of messages
 *
 * @example
 * ```ts
 * const messages = [msg1, msg2, msg3, msg4]; // newest is msg4
 * const truncated = truncateMessagesByBytes(messages, 10000);
 * // Returns [msg3, msg4] if they fit, or [msg4] if only it fits, etc.
 * ```
 */
export declare function truncateMessagesByBytes(messages: unknown[], maxBytes: number): unknown[];
/**
 * Truncate GenAI messages using the default byte limit.
 *
 * Convenience wrapper around `truncateMessagesByBytes` with the default limit.
 *
 * @param messages - Array of messages to truncate
 * @returns Truncated array of messages
 */
export declare function truncateGenAiMessages(messages: unknown[]): unknown[];
/**
 * Truncate GenAI string input using the default byte limit.
 *
 * @param input - The string to truncate
 * @returns Truncated string
 */
export declare function truncateGenAiStringInput(input: string): string;
//# sourceMappingURL=messageTruncation.d.ts.map

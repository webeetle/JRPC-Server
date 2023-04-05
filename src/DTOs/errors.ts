/**
 * Represents a default error response.
 *
 * @class ErrorResponse
 */
export class ErrorResponse {
	/**
     * Creates an instance of ErrorResponse.
     *
     * @param {string} message - The error message.
     * @param {number} code - The error code.
     */
	constructor(public message: string, public code: number) { }
}

/**
 * Represents a custom error response.
 *
 * @class CustomErrorResponse
 */
export class CustomErrorResponse {
	/**
     * Creates an instance of CustomErrorResponse.
     *
     * @param {string} message - The error message.
     * @param {number} code - The error code.
     */
	constructor(public message: string, public code: number) { }
}
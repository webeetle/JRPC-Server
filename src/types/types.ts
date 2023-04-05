import { JSONSchema4 } from "json-schema";

/**
 * Represents a JSON-RPC request object.
 *
 * @typedef {Object} JRPC_REQUEST
 * @property {string} jsonrpc - The JSON-RPC protocol version.
 * @property {string} method - The name of the method to call.
 * @property {object | Array<unknown>} [params] - The parameters to pass to the method (if any).
 * @property {string | number} [id] - The ID of the request (if any).
 */
export type JRPC_REQUEST = {
    jsonrpc: string;
    method: string;
    params?: object | Array<unknown>;
    id?: string | number;
}

/**
 * Represents a JSON-RPC error object.
 *
 * @typedef {Object} JRPC_ERROR
 * @property {string} code - The error code.
 * @property {string} message - The error message.
 * @property {object | null} [data] - Additional error data (if any).
 */
export type JRPC_ERROR = {
    code: string;
    message: string;
    data?: object | null;
}

/**
 * Represents a JSON-RPC response object.
 *
 * @typedef {Object} JRPC_RESPONSE
 * @property {string} jsonrpc - The JSON-RPC protocol version.
 * @property {object | Array<unknown>} [result] - The result of the method call (if any).
 * @property {JRPC_ERROR} [error] - The error (if any).
 * @property {string | number | null} [id] - The ID of the request (if any).
 */
export type JRPC_RESPONSE = {
    jsonrpc: string;
    result?: object | Array<unknown>;
    error?: JRPC_ERROR;
    id?: string | number | null;
}

/**
 * Represents a JSON-RPC method.
 *
 * @typedef {Object} JRPC_METHOD
 * @property {JRPC_SCHEMA_METHOD} schema - The schema for the method.
 * @property {Function} handler - The method handler function.
 */
export type JRPC_METHOD = {
    schema: JRPC_SCHEMA_METHOD,
    handler: Function;
}

/**
 * Represents a JSON-RPC schema.
 *
 * @typedef {Object} JRPC_SCHEMA
 * @property {string} version - The JSON-RPC protocol version.
 * @property {JRPC_SCHEMA_INFO} info - Information about the server.
 * @property {Array<JRPC_SCHEMA_METHOD>} methods - The JSON-RPC methods.
 */
export type JRPC_SCHEMA = {
    version: string;
    info: JRPC_SCHEMA_INFO;
    methods: Array<JRPC_SCHEMA_METHOD>;
}

/**
 * Represents information about a JSON-RPC schema.
 *
 * @typedef {Object} JRPC_SCHEMA_INFO
 * @property {string} version - The version of the schema.
 * @property {string} name - The name of the schema.
 * @property {string} description - A description of the schema.
 */
export type JRPC_SCHEMA_INFO = {
    version: string;
    name: string;
    description: string;
}

/**
 * Represents a JSON-RPC method schema.
 *
 * @typedef {Object} JRPC_SCHEMA_METHOD
 * @property {string} name - The name of the method.
 * @property {string} description - A description of the method.
 * @property {boolean} [notification] - Whether the method is a notification (i.e. doesn't return a result).
 * @property {Array<JRPC_SCHEMA_METHOD_PARAM>} params - The method parameters.
 * @property {JSONSchema4} result - The expected result of the method.
 */
export type JRPC_SCHEMA_METHOD = {
    name: string;
    description: string;
    notification?: boolean;
    params: Array<JRPC_SCHEMA_METHOD_PARAM>;
    result: JSONSchema4;
}

/**
 * 
 * Represents a parameter for a JSON-RPC method schema.
 * @typedef {Object} JRPC_SCHEMA_METHOD_PARAM
 * @property {string} name - The name of the parameter.
 * @property {string} description - A description of the parameter.
 * @property {JSONSchema4} schema - The schema for the parameter.
 * @property {boolean} [required] - Whether the parameter is required.
*/
export type JRPC_SCHEMA_METHOD_PARAM = {
    name: string;
    description: string;
    schema: JSONSchema4;
    required?: boolean;
}

/**
 * 
 * Represents the result of a JSON-RPC method schema.
 * @typedef {Object} JRPC_SCHEMA_METHOD_RESULT
 * @property {string} name - The name of the result.
 * @property {string} description - A description of the result.
 * @property {JSONSchema4} schema - The schema for the result.
*/
export type JRPC_SCHEMA_METHOD_RESULT = {
    name: string;
    description: string;
    schema: JSONSchema4;
} 
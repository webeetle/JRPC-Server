import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { CustomErrorResponse, ErrorResponse } from "./DTOs/errors";
import { JRPC_METHOD, JRPC_REQUEST, JRPC_RESPONSE, JRPC_SCHEMA, JRPC_SCHEMA_INFO, JRPC_SCHEMA_METHOD } from "./types/types";

const ajv = new Ajv({
    strictTuples: false
});
addFormats(ajv);

const JRPC_SERVER_VERSION = '0.0.8';
const JSON_RPC_VERSION = '2.0';

const ERRORS = {
    PARSE_ERROR: '-32700',
    INVALID_REQUEST: '-32600',
    METHOD_NOT_FOUND: '-32601',
    INVALID_PARAMS: '-32602',
    INTERNAL_ERROR: '-32603',
    SERVER_ERROR: '-32000',
}

const ERROR_MESSAGES = {
    [ERRORS.PARSE_ERROR]: 'Parse error',
    [ERRORS.INVALID_REQUEST]: 'Invalid Request',
    [ERRORS.METHOD_NOT_FOUND]: 'Method not found',
    [ERRORS.INVALID_PARAMS]: 'Invalid params',
    [ERRORS.INTERNAL_ERROR]: 'Internal error',
    [ERRORS.SERVER_ERROR]: 'Server error',
}

/**
 * JSON-RPC server implementation.
 *
 * @class Server
 */
export default class Server {
    private methods: JRPC_METHOD[] = [];
    private info: JRPC_SCHEMA_INFO;

    /**
     * Creates an instance of `Server`.
     *
     * @constructor
     * @param {JRPC_SCHEMA_INFO} info - Information about the JSON-RPC server schema.
     */
    constructor(info: JRPC_SCHEMA_INFO) {
        this.info = info;
    }

    /**
     * Checks if a method with a given name exists.
     *
     * @private
     * @param {string} name - The name of the method.
     * @returns {boolean} `true` if a method with the given name exists, `false` otherwise.
     */
    private methodExists(name: string): boolean {
        return !!this.methods.find((method) => method.schema.name === name);
    }

    /**
     * Finds a method with a given name.
     *
     * @private
     * @param {string} name - The name of the method.
     * @returns {JRPC_METHOD | null} The method with the given name or `null` if it doesn't exist.
     */
    private findMethod(name: string): JRPC_METHOD | null {
        return this.methods.find((method) => method.schema.name === name) || null;
    }

    /**
     * Adds a method to the server.
     *
     * @public
     * @param {JRPC_SCHEMA_METHOD} schema - The schema of the method.
     * @param {Function} handler - The handler function for the method.
     * @throws {Error} If the `handler` parameter is not a function.
     * @throws {Error} If a method with the same name already exists.
     * @throws {Error} If the method name starts with "rpc.", which is reserved.
     */
    public addMethod(schema: JRPC_SCHEMA_METHOD, handler: Function) {
        if (typeof handler !== 'function') {
            throw new Error('Handler must be a function');
        }
        if (this.methodExists(schema.name)) {
            throw new Error(`Method ${schema.name} already exists`);
        }
        if (schema.name.startsWith('rpc.')) {
            throw new Error(`Method ${schema.name} is reserved`);
        }
        this.methods.push({
            schema,
            handler,
        });
    }

    /**
     * Creates a JSON-RPC response object.
     *
     * @private
     * @param {JRPC_REQUEST} request - The JSON-RPC request object.
     * @param {object | Array<unknown>} result - The result of the request.
     * @returns {JRPC_RESPONSE} A JSON-RPC response object.
     */
    private createResponse(request: JRPC_REQUEST, result: object | Array<unknown>): JRPC_RESPONSE {
        return {
            jsonrpc: JSON_RPC_VERSION,
            result,
            id: request.id,
        }
    }

    /**
    * Creates a JSON-RPC error response object.
    *
    * @private
    * @param {JRPC_REQUEST | null} request - The JSON-RPC request object (optional).
    * @param {string} code - The error code.
    * @param {string} message - The error message.
    * @param {object} [data] - Additional error data (optional).
    * @returns {JRPC_RESPONSE} A JSON-RPC error response object.
    */
    private createErrorResponse(request: JRPC_REQUEST | null, code: string, message: string, data?: object): JRPC_RESPONSE {
        return {
            jsonrpc: JSON_RPC_VERSION,
            error: {
                code,
                message,
                data: (data) ? data : null,
            },
            id: (request) ? request.id : null,
        }
    }

    /**
    * Parses a JSON-RPC request string and returns the corresponding request object(s).
    *
    * @private
    * @param {string} request - The JSON-RPC request string.
    * @returns {JRPC_REQUEST | JRPC_REQUEST[]} The corresponding JSON-RPC request object(s).
    * @throws {ErrorResponse} If the request string cannot be parsed.
    */
    private parseRequest(request: string): JRPC_REQUEST | JRPC_REQUEST[] {
        try {
            return JSON.parse(request);
        } catch (e) {
            throw new ErrorResponse(ERROR_MESSAGES[ERRORS.PARSE_ERROR], parseInt(ERRORS.PARSE_ERROR));
        }
    }

    
    /**
     * Validates a JSON-RPC request object against its corresponding method schema.
     *
     * @private
     * @param {JRPC_REQUEST} request - The JSON-RPC request object to validate.
     * @returns {boolean} `true` if the request is valid, `false` otherwise.
     * @throws {ErrorResponse} If the request is invalid.
     */
    private validateRequest(request: JRPC_REQUEST): boolean {
        if(!request.method || typeof request.method !== 'string') {
            throw new ErrorResponse(ERROR_MESSAGES[ERRORS.INVALID_REQUEST], parseInt(ERRORS.INVALID_REQUEST));
        }
        const method = this.findMethod(request.method);
        if (method?.schema.notification) {
            return true;
        }
        if (!request.jsonrpc || request.jsonrpc !== JSON_RPC_VERSION) {
            throw new ErrorResponse(ERROR_MESSAGES[ERRORS.INVALID_REQUEST], parseInt(ERRORS.INVALID_REQUEST));
        }
        if (!request.id || typeof request.id !== 'string' && typeof request.id !== 'number') {
            throw new ErrorResponse(ERROR_MESSAGES[ERRORS.INVALID_REQUEST], parseInt(ERRORS.INVALID_REQUEST));
        }
        if (!method) {
            throw new ErrorResponse(ERROR_MESSAGES[ERRORS.METHOD_NOT_FOUND], parseInt(ERRORS.METHOD_NOT_FOUND));
        }
        
        // validate params
        let schema = {};

        if (Array.isArray(request.params)) {
            if (request.params.length === 0) {
                schema = {
                    type: 'array'
                };
            } else {
                schema = {
                    type: 'array',
                    items: method.schema.params.map((param) => param.schema),
                    minItems: method.schema.params.filter((param) => param.required).length
                };
            }
        } else if (typeof request.params === 'object' && !Array.isArray(request.params)) {
            schema = {
                type: 'object',
                properties: {},
                required: [],
                additionalProperties: false
            };
            method.schema.params.forEach((param) => {
                // @ts-ignore
                schema.properties[param.name] = param.schema;
                if (param.required) {
                    // @ts-ignore
                    schema.required.push(param.name);
                }
            });
        }

        try {
            const validate = ajv.compile(schema);
            if (!validate(request.params)) {
                throw new ErrorResponse(ERROR_MESSAGES[ERRORS.INVALID_PARAMS], parseInt(ERRORS.INVALID_PARAMS));
            }
        } catch (e) {
            throw new ErrorResponse(ERROR_MESSAGES[ERRORS.INVALID_PARAMS], parseInt(ERRORS.INVALID_PARAMS));
        }

        return true;
    }

    /**
    * Handles a single JSON-RPC request object
    * 
    * @private
    * @param {JRPC_REQUEST} request - The JSON-RPC request object to handle.
    * @returns {Promise<JRPC_RESPONSE | void>} A promise that resolves to the corresponding JSON-RPC response object, or `void` if the request is a notification.
    * @throws {CustomErrorResponse} If the handler function throws a custom error.
    * @throws {ErrorResponse} If the request is invalid or there's an error while processing the request.
    */
    private async handleRequest(request: JRPC_REQUEST): Promise<JRPC_RESPONSE | void> {
        try {
            this.validateRequest(request);
            const method = this.findMethod(request.method);
            // prepare params as input for handler
            const params: unknown[] = [];
            if (Array.isArray(request.params)) {
                params.push(...request.params);
            } else {
                method?.schema.params.forEach((param) => {
                    // @ts-ignore
                    params.push(request.params[param.name]);
                });
            }
            if (!(method?.schema.notification)) {
                const result = await method?.handler(...params);
                return this.createResponse(request, result);
            } else {
                await method?.handler(...params);
            }
        } catch (e) {
            if (e instanceof CustomErrorResponse) {
                return this.createErrorResponse(request, ERRORS.SERVER_ERROR, ERROR_MESSAGES[ERRORS.SERVER_ERROR], {
                    ...e
                });
            } else if (e instanceof ErrorResponse) {
                return this.createErrorResponse(request, e.code.toString(), e.message);
            } else {
                return this.createErrorResponse(request, ERRORS.SERVER_ERROR, ERROR_MESSAGES[ERRORS.SERVER_ERROR], {
                    // @ts-ignore
                    message: e.message,
                });
            }
        }
    }

    /**
     * Executes a JSON-RPC request string and returns the corresponding response object(s).
     *
     * @public
     * @param {string} request - The JSON-RPC request string.
     * @returns {Promise<JRPC_RESPONSE | JRPC_RESPONSE[] | void>} A promise that resolves with the corresponding JSON-RPC response object(s) (if any).
     * @throws {ErrorResponse | Error} If an error occurs while executing the request.
     */
    public async executeRequest(request: string): Promise<JRPC_RESPONSE | JRPC_RESPONSE[] | void> {
        try {
            const parsedRequest: JRPC_REQUEST | JRPC_REQUEST[] = this.parseRequest(request);
            if (Array.isArray(parsedRequest)) {
                const responses: JRPC_RESPONSE[] = [];
                for (const req of parsedRequest) {
                    const response = await this.handleRequest(req);
                    if (response) {
                        responses.push(response);
                    }
                }
                return responses;
            } else {
                const response = await this.handleRequest(parsedRequest);
                if (response) {
                    return response;
                }
            }
        } catch (e) {
            if (e instanceof ErrorResponse) {
                return this.createErrorResponse(null, e.code.toString(), e.message);
            } else {
                // @ts-ignore
                return this.createErrorResponse(null, ERRORS.SERVER_ERROR, ERROR_MESSAGES[ERRORS.SERVER_ERROR], {
                    // @ts-ignore
                    message: e.message,
                });
            }
        }
    }

    /**
     * Returns the server schema.
     *
     * @public
     * @returns {JRPC_SCHEMA} The server schema.
     */
    public getSchema(): JRPC_SCHEMA {
        return {
            version: JRPC_SERVER_VERSION,
            info: this.info,
            methods: this.methods.map((method) => method.schema),
        };
    }

}

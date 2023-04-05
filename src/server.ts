import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { ErrorResponse } from "./DTOs/errors";
import { JRPC_METHOD, JRPC_REQUEST, JRPC_RESPONSE, JRPC_SCHEMA, JRPC_SCHEMA_INFO, JRPC_SCHEMA_METHOD } from "./types/types";

const ajv = new Ajv({
    strictTuples: false
});
addFormats(ajv);

const JRPC_SERVER_VERSION = '0.0.4';
const VERSION = '2.0';

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

export default class Server {
    private methods: JRPC_METHOD[] = [];
    private info: JRPC_SCHEMA_INFO;

    constructor(info: JRPC_SCHEMA_INFO) {
        this.info = info;
    }

    // check if method exists
    private methodExists(name: string): boolean {
        return !!this.methods.find((method) => method.schema.name === name);
    }

    // find method by name
    private findMethod(name: string): JRPC_METHOD | null {
        return this.methods.find((method) => method.schema.name === name) || null;
    }

    // add method to container
    public addMethod(schema: JRPC_SCHEMA_METHOD, handler: Function) {
        if (typeof handler !== 'function') {
            throw new Error('Handler must be a function');
        }
        if (this.methodExists(schema.name)) {
            throw new Error(`Method ${schema.name} already exists`);
        }
        this.methods.push({
            schema,
            handler,
        });
    }

    // create response
    private createResponse(request: JRPC_REQUEST, result: object | Array<unknown>): JRPC_RESPONSE {
        return {
            jsonrpc: VERSION,
            result,
            id: request.id,
        }
    }

    // create error response
    private createErrorResponse(request: JRPC_REQUEST | null, code: string, message: string, data?: object): JRPC_RESPONSE {
        return {
            jsonrpc: VERSION,
            error: {
                code,
                message,
                data: (data) ? data : null,
            },
            id: (request) ? request.id : null,
        }
    }

    // parse request
    private parseRequest(request: string): JRPC_REQUEST | JRPC_REQUEST[] {
        try {
            return JSON.parse(request);
        } catch (e) {
            throw new ErrorResponse(ERROR_MESSAGES[ERRORS.PARSE_ERROR], parseInt(ERRORS.PARSE_ERROR));
        }
    }

    // validate request
    private validateRequest(request: JRPC_REQUEST): boolean {
        const method = this.findMethod(request.method);
        if (method?.schema.notification) {
            return true;
        }
        if (!request.jsonrpc || request.jsonrpc !== VERSION) {
            throw new ErrorResponse(ERROR_MESSAGES[ERRORS.INVALID_REQUEST], parseInt(ERRORS.INVALID_REQUEST));
        }
        if (!request.id) {
            throw new ErrorResponse(ERROR_MESSAGES[ERRORS.INVALID_REQUEST], parseInt(ERRORS.INVALID_REQUEST));
        }
        if (!request.method) {
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

    // handle request
    private async handleRequest(request: JRPC_REQUEST): Promise<JRPC_RESPONSE | void> {
        try {
            this.validateRequest(request);
            const method = this.findMethod(request.method);
            // prepare params as input for handler
            const params: unknown[] = [];
            if (Array.isArray(request.params)) {
                params.push(...request.params);
            } else {
                method!.schema.params.forEach((param) => {
                    // @ts-ignore
                    params.push(request.params[param.name]);
                });
            }
            if (!(method!.schema.notification)) {
                const result = await method!.handler(...params);
                return this.createResponse(request, result);
            }
        } catch (e) {
            if (e instanceof ErrorResponse) {
                // @ts-ignore
                return this.createErrorResponse(request, ERRORS.SERVER_ERROR, ERROR_MESSAGES[ERRORS.SERVER_ERROR], {
                    // @ts-ignore
                    ...e
                });
            } else {
                // @ts-ignore
                return this.createErrorResponse(request, ERRORS.SERVER_ERROR, ERROR_MESSAGES[ERRORS.SERVER_ERROR], {
                    // @ts-ignore
                    message: e.message,
                });
            }
        }
    }

    // execute request
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

    // return the server schema
    public getSchema(): JRPC_SCHEMA {
        return {
            version: JRPC_SERVER_VERSION,
            info: this.info,
            methods: this.methods.map((method) => method.schema),
        };
    }

}

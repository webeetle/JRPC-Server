import Server from './Server';
import { JRPC_RESPONSE, JRPC_SCHEMA_INFO, JRPC_SCHEMA_METHOD } from './types/types';
import { CustomErrorResponse, ErrorResponse } from './DTOs/errors';

describe('Server', () => {
    function isJRPCResponse(response: JRPC_RESPONSE | JRPC_RESPONSE[] | void): response is JRPC_RESPONSE {
        return (response as JRPC_RESPONSE)?.jsonrpc !== undefined;
    }
    
    const info: JRPC_SCHEMA_INFO = {
        name: 'TestServer',
        description: 'A test JSON-RPC server',
        version: '1'
    };

    const testMethodSchema: JRPC_SCHEMA_METHOD = {
        name: 'testMethod',
        description: 'A test method',
        params: [],
        result: {
            type: 'string',
        },
    };

    const testMethodHandler = () => 'Hello, World!';

    let server: Server;

    beforeEach(() => {
        server = new Server(info);
    });

    test('should create a server instance', () => {
        expect(server).toBeInstanceOf(Server);
    });

    test('should add a method to the server', () => {
        expect(() => {
            server.addMethod(testMethodSchema, testMethodHandler);
        }).not.toThrow();
    });

    test('should throw an error when adding a method with the same name', () => {
        server.addMethod(testMethodSchema, testMethodHandler);

        expect(() => {
            server.addMethod(testMethodSchema, testMethodHandler);
        }).toThrow();
    });

    test('should throw an error when adding a method with a reserved name', () => {
        const reservedMethodSchema: JRPC_SCHEMA_METHOD = {
            ...testMethodSchema,
            name: 'rpc.reservedMethod',
        };

        expect(() => {
            server.addMethod(reservedMethodSchema, testMethodHandler);
        }).toThrow();
    });

    test('should return the server schema', () => {
        server.addMethod(testMethodSchema, testMethodHandler);

        const expectedSchema = {
            version: '0.0.8',
            info,
            methods: [testMethodSchema],
        };

        expect(server.getSchema()).toEqual(expectedSchema);
    });

    test('should execute a valid JSON-RPC request', async () => {
        server.addMethod(testMethodSchema, testMethodHandler);

        const request = JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'testMethod',
        });

        const response = await server.executeRequest(request);

        expect(response).toEqual({
            jsonrpc: '2.0',
            id: 1,
            result: 'Hello, World!',
        });
    });

    test('should return an error response for an invalid JSON-RPC request', async () => {
        const request = 'Invalid JSON-RPC request';

        const response = await server.executeRequest(request);

        expect(response).toEqual({
            jsonrpc: '2.0',
            error: {
                code: '-32700',
                message: 'Parse error',
                data: null,
            },
            id: null,
        });
    });

    test('should return an error response for a JSON-RPC request with an unknown method', async () => {
        const request = JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'unknownMethod',
        });

        const response = await server.executeRequest(request);

        expect(response).toEqual({
            jsonrpc: '2.0',
            error: {
                code: '-32601',
                message: 'Method not found',
                data: null,
            },
            id: 1,
        });
    });

    test('should return an error response for a JSON-RPC request with invalid parameters', async () => {
        const methodSchemaWithParams: JRPC_SCHEMA_METHOD = {
            name: 'testMethodWithParams',
            description: 'A test method with parameters',
            params: [
                { name: 'a', description: 'A number', schema: { type: 'number' }, required: true },
                { name: 'b', description: 'B number', schema: { type: 'number' }, required: true },
            ],
            result: { type: 'number' },
        };
        const handlerWithParams = (a: number, b: number) => a + b;
        server.addMethod(methodSchemaWithParams, handlerWithParams);

        const request = JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'testMethodWithParams',
            params: { a: 1, b: 'invalid' },
        });

        const response = await server.executeRequest(request);

        expect(response).toEqual({
            jsonrpc: '2.0',
            error: {
                code: '-32602',
                message: 'Invalid params',
                data: null,
            },
            id: 1,
        });
    });

    test('should handle a batch JSON-RPC request', async () => {
        server.addMethod(testMethodSchema, testMethodHandler);

        const batchRequest = JSON.stringify([
            {
                jsonrpc: '2.0',
                id: 1,
                method: 'testMethod',
            },
            {
                jsonrpc: '2.0',
                id: 2,
                method: 'testMethod',
            },
        ]);

        const response = await server.executeRequest(batchRequest);

        expect(response).toEqual([
            {
                jsonrpc: '2.0',
                id: 1,
                result: 'Hello, World!',
            },
            {
                jsonrpc: '2.0',
                id: 2,
                result: 'Hello, World!',
            },
        ]);
    });

    test('should handle a mix of valid and invalid requests in a batch JSON-RPC request', async () => {
        server.addMethod(testMethodSchema, testMethodHandler);

        const batchRequest = JSON.stringify([
            {
                jsonrpc: '2.0',
                id: 1,
                method: 'testMethod',
            },
            {
                jsonrpc: '2.0',
                id: 2,
                method: 'unknownMethod',
            },
        ]);

        const response = await server.executeRequest(batchRequest);

        expect(response).toEqual([
            {
                jsonrpc: '2.0',
                id: 1,
                result: 'Hello, World!',
            },
            {
                jsonrpc: '2.0',
                error: {
                    code: '-32601',
                    message: 'Method not found',
                    data: null,
                },
                id: 2,
            },
        ]);
    });

    test('should not return a response for a JSON-RPC notification request', async () => {
        const notificationMethodSchema: JRPC_SCHEMA_METHOD = {
            ...testMethodSchema,
            name: 'testNotification',
            notification: true,
        };
        server.addMethod(notificationMethodSchema, testMethodHandler);

        const request = JSON.stringify({
            jsonrpc: '2.0',
            method: 'testNotification',
        });

        const response = await server.executeRequest(request);

        expect(response).toBeUndefined();
    });

    test('should return an error response for a JSON-RPC request with an invalid JSON-RPC version', async () => {
        const invalidVersionRequest = JSON.stringify({
            jsonrpc: '1.0',
            id: 1,
            method: 'testMethod',
        });

        const response = await server.executeRequest(invalidVersionRequest);

        expect(response).toEqual({
            jsonrpc: '2.0',
            error: {
                code: '-32600',
                message: 'Invalid Request',
                data: null,
            },
            id: 1,
        });
    });

    test('should return an error response for a JSON-RPC request with an invalid method type', async () => {
        server.addMethod(testMethodSchema, testMethodHandler);

        const invalidMethodTypeRequest = JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 123,
        });

        const response = await server.executeRequest(invalidMethodTypeRequest);

        expect(response).toEqual({
            jsonrpc: '2.0',
            error: {
                code: '-32600',
                message: 'Invalid Request',
                data: null,
            },
            id: 1,
        });
    });

    test('should return an error response for a JSON-RPC request with an invalid params type', async () => {
        const methodSchemaWithParams: JRPC_SCHEMA_METHOD = {
            name: 'testMethodWithParams',
            description: 'A test method with parameters',
            params: [
                { name: 'a', description: 'A number', schema: { type: 'number' }, required: true },
                { name: 'b', description: 'B number', schema: { type: 'number' }, required: true },
            ],
            result: { type: 'number' },
        };
        const handlerWithParams = (a: number, b: number) => a + b;
        server.addMethod(methodSchemaWithParams, handlerWithParams);

        const invalidParamsTypeRequest = JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'testMethodWithParams',
            params: { a: 'invalid params type' },
        });

        const response = await server.executeRequest(invalidParamsTypeRequest);

        expect(response).toEqual({
            jsonrpc: '2.0',
            error: {
                code: '-32602',
                message: 'Invalid params',
                data: null,
            },
            id: 1,
        });
    });

    test('should return an error response for a JSON-RPC request with an invalid id type', async () => {
        server.addMethod(testMethodSchema, testMethodHandler);

        const invalidIdTypeRequest = JSON.stringify({
            jsonrpc: '2.0',
            id: { invalid: 'id' },
            method: 'testMethod',
        });

        const response = await server.executeRequest(invalidIdTypeRequest);

        expect(response).toEqual({
            jsonrpc: '2.0',
            error: {
                code: '-32600',
                message: 'Invalid Request',
                data: null,
            },
            id: { invalid: 'id' },
        });
    });

    test('should handle a JSON-RPC request with a method not found', async () => {
        const methodNotFoundRequest = JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'nonexistentMethod',
        });

        const response = await server.executeRequest(methodNotFoundRequest);

        expect(response).toEqual({
            jsonrpc: '2.0',
            error: {
                code: '-32601',
                message: 'Method not found',
                data: null,
            },
            id: 1,
        });
    });

    test('should handle a JSON-RPC request with invalid params (additional properties)', async () => {
        server.addMethod(
            {
                name: 'testMethod',
                description: 'A test method',
                params: [
                    {
                        name: 'a',
                        description: 'A number',
                        schema: { type: 'number' },
                        required: true,
                    },
                ],
                result: { type: 'number' },
            },
            (a: number) => a * 2
        );

        const invalidRequestWithAdditionalProperty = JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'testMethod',
            params: { a: 2, b: 3 },
        });

        const response = await server.executeRequest(invalidRequestWithAdditionalProperty);

        expect(response).toEqual({
            jsonrpc: '2.0',
            error: {
                code: '-32602',
                message: 'Invalid params',
                data: null,
            },
            id: 1,
        });
    });

    test('should handle a JSON-RPC request with a reserved method name', () => {
        expect(() =>
            server.addMethod(
                {
                    name: 'rpc.reservedMethod',
                    description: 'A reserved method',
                    params: [],
                    result: { type: 'null' },
                },
                () => null
            )
        ).toThrowError('Method rpc.reservedMethod is reserved');
    });

    test('should handle a JSON-RPC request with a handler that is not a function', () => {
        expect(() =>
            server.addMethod(
                {
                    name: 'testMethod',
                    description: 'A test method',
                    params: [],
                    result: { type: 'null' },
                },
                // @ts-ignore
                "notAFunction"
            )
        ).toThrowError('Handler must be a function');
    });

    test('should handle a JSON-RPC request with a duplicate method name', () => {
        server.addMethod(
            {
                name: 'testMethod',
                description: 'A test method',
                params: [],
                result: { type: 'null' },
            },
            () => null
        );

        expect(() =>
            server.addMethod(
                {
                    name: 'testMethod',
                    description: 'A test method',
                    params: [],
                    result: { type: 'null' },
                },
                () => null
            )).toThrowError('Method testMethod already exists');
    });

    test('should handle a JSON-RPC request with an invalid JSON string', async () => {
        const invalidJsonString = '{ invalid json }';

        const response = await server.executeRequest(invalidJsonString);

        expect(response).toEqual({
            jsonrpc: '2.0',
            error: {
                code: '-32700',
                message: 'Parse error',
                data: null,
            },
            id: null,
        });
    });

    test('should handle a JSON-RPC request with an invalid method name', async () => {
        const invalidMethodNameRequest = JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'nonExistentMethod',
        });

        const response = await server.executeRequest(invalidMethodNameRequest);

        expect(response).toEqual({
            jsonrpc: '2.0',
            error: {
                code: '-32601',
                message: 'Method not found',
                data: null,
            },
            id: 1,
        });
    });

    test('should handle a JSON-RPC request with an invalid JSON-RPC version', async () => {
        const invalidJsonRpcVersionRequest = JSON.stringify({
            jsonrpc: '1.0',
            id: 1,
            method: 'testMethod',
        });

        const response = await server.executeRequest(invalidJsonRpcVersionRequest);

        expect(response).toEqual({
            jsonrpc: '2.0',
            error: {
                code: '-32600',
                message: 'Invalid Request',
                data: null,
            },
            id: 1,
        });
    });

    test('should handle a JSON-RPC request with array input', async () => {
        const testMethod: JRPC_SCHEMA_METHOD = {
            name: 'testMethod',
            description: 'A test method',
            params: [
                { name: 'a', description: 'A number', schema: { type: 'number' }, required: true },
                { name: 'b', description: 'B number', schema: { type: 'number' }, required: true },
            ],
            result: { type: 'number' },
        };

        const testMethodHandler = (a: number, b: number) => a + b;

        server.addMethod(testMethod, testMethodHandler);

        const arrayInputRequest = JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'testMethod',
            params: [3, 5],
        });

        const response = await server.executeRequest(arrayInputRequest);

        expect(response).toEqual({
            jsonrpc: '2.0',
            result: 8,
            id: 1,
        });
    });

    test('should handle a JSON-RPC request with object input', async () => {
        const testMethod: JRPC_SCHEMA_METHOD = {
            name: 'testMethod',
            description: 'A test method',
            params: [
                { name: 'a', description: 'A number', schema: { type: 'number' }, required: true },
                { name: 'b', description: 'B number', schema: { type: 'number' }, required: true },
            ],
            result: { type: 'number' },
        };

        const testMethodHandler = (a: number, b: number) => a + b;

        server.addMethod(testMethod, testMethodHandler);

        const objectInputRequest = JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'testMethod',
            params: { a: 3, b: 5 },
        });

        const response = await server.executeRequest(objectInputRequest);

        expect(response).toEqual({
            jsonrpc: '2.0',
            result: 8,
            id: 1,
        });
    });

    test('should handle a JSON-RPC request with no params', async () => {
        const testMethod: JRPC_SCHEMA_METHOD = {
            name: 'testMethodNoParams',
            description: 'A test method with no params',
            params: [],
            result: { type: 'string' },
        };

        const testMethodHandler = () => 'Hello, world!';

        server.addMethod(testMethod, testMethodHandler);

        const noParamsRequest = JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'testMethodNoParams',
            params: []
        });

        const response = await server.executeRequest(noParamsRequest);

        expect(response).toEqual({
            jsonrpc: '2.0',
            result: 'Hello, world!',
            id: 1,
        });
    });

    test('should return an error response for a custom error', async () => {
        const testMethod: JRPC_SCHEMA_METHOD = {
            name: 'testMethodWithError',
            description: 'A test method with an error',
            params: [],
            result: { type: 'string' },
        };

        const testMethodHandler = () => {
            throw new CustomErrorResponse('Custom Error', 12345);
        };

        server.addMethod(testMethod, testMethodHandler);

        const errorRequest = JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'testMethodWithError',
        });

        const response = await server.executeRequest(errorRequest);

        expect(response).toEqual({
            jsonrpc: '2.0',
            error: {
                code: '-32000',
                message: 'Server error',
                data: {
                    message: 'Custom Error',
                    code: 12345,
                },
            },
            id: 1,
        });
    });

    test('should handle an error thrown by the handler function', async () => {
        const methodName = 'errorMethod';
        const handler = jest.fn(() => {
            throw new Error('Handler error');
        });

        server.addMethod({ name: methodName, description: 'A test method that throws an error', params: [], result: {} }, handler);

        const errorRequest = {
            jsonrpc: '2.0',
            method: methodName,
            id: '1',
        };

        const response = await server.executeRequest(JSON.stringify(errorRequest));
        
        if (isJRPCResponse(response)) {
            expect(response.error).toBeDefined();
            if (response.error) {
                expect(response.error).toHaveProperty('code', '-32000');
                expect(response.error).toHaveProperty('message', 'Server error');
                expect(response.error).toHaveProperty('data');
                expect(response.error.data).toHaveProperty('message', 'Handler error');
            }
        } else {
            fail('Expected response to have an "error" property.');
        }
    
        expect(handler).toHaveBeenCalled();
    });

});

// Default ErrorResponse class.
export class ErrorResponse {
	constructor(public message: string, public code: number) { }
}

export class CustomErrorResponse {
	constructor(public message: string, public code: number) { }
}
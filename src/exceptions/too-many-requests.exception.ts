import { HttpException, HttpStatus } from "@nestjs/common";

export class TooManyRequestsException extends HttpException {
	public constructor(message: string = "Too Many Requests") {
		super(message, HttpStatus.TOO_MANY_REQUESTS);
	}
}

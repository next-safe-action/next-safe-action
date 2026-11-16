/**
 * Named HTTP status codes for route configs: the success (2xx), client error (4xx) and server error (5xx) statuses
 * of the IANA HTTP Status Code Registry. Each value has its literal type, so `HttpStatus.Conflict` and `409` are
 * interchangeable everywhere a route takes a status. The object is frozen.
 */
export const HttpStatus = Object.freeze({
	Ok: 200,
	Created: 201,
	Accepted: 202,
	NonAuthoritativeInformation: 203,
	NoContent: 204,
	ResetContent: 205,
	PartialContent: 206,
	MultiStatus: 207,
	AlreadyReported: 208,
	ImUsed: 226,
	BadRequest: 400,
	Unauthorized: 401,
	PaymentRequired: 402,
	Forbidden: 403,
	NotFound: 404,
	MethodNotAllowed: 405,
	NotAcceptable: 406,
	ProxyAuthenticationRequired: 407,
	RequestTimeout: 408,
	Conflict: 409,
	Gone: 410,
	LengthRequired: 411,
	PreconditionFailed: 412,
	ContentTooLarge: 413,
	UriTooLong: 414,
	UnsupportedMediaType: 415,
	RangeNotSatisfiable: 416,
	ExpectationFailed: 417,
	MisdirectedRequest: 421,
	UnprocessableContent: 422,
	Locked: 423,
	FailedDependency: 424,
	TooEarly: 425,
	UpgradeRequired: 426,
	PreconditionRequired: 428,
	TooManyRequests: 429,
	RequestHeaderFieldsTooLarge: 431,
	UnavailableForLegalReasons: 451,
	InternalServerError: 500,
	NotImplemented: 501,
	BadGateway: 502,
	ServiceUnavailable: 503,
	GatewayTimeout: 504,
	HttpVersionNotSupported: 505,
	VariantAlsoNegotiates: 506,
	InsufficientStorage: 507,
	LoopDetected: 508,
	NetworkAuthenticationRequired: 511,
} as const);

type StatusValue = (typeof HttpStatus)[keyof typeof HttpStatus];
type InRange<Status extends number, Digit extends string> = Status extends Status
	? `${Status}` extends `${Digit}${string}`
		? Status
		: never
	: never;

/** A status that `successStatus` accepts: a 2xx status that allows a JSON body (not 204 or 205). */
export type SuccessStatus = Exclude<InRange<StatusValue, "2">, 204 | 205>;
/** A status that `serverErrorStatus` can return: a 4xx or 5xx status. */
export type ErrorStatus = InRange<StatusValue, "4" | "5">;

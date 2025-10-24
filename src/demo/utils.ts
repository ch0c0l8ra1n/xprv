export interface PingResponse{
	message: string;
}

export function createPingResponse(): PingResponse {
	return {
		message: "pong!",
	};
}
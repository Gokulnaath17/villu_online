import { env as cfEnv } from 'cloudflare:workers';

export function getBindings(platform?: App.Platform) {
	const e = (platform?.env || cfEnv || {}) as Env;
	return {
		DB: e.DB,
		STREAM_CACHE: e.STREAM_CACHE
	};
}

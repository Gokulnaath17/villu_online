import { env as cfEnv } from 'cloudflare:workers';

export function getBindings(platform?: App.Platform) {
	const e = (platform?.env || cfEnv || {}) as any;
	return {
		DB: e.DB as D1Database,
		STREAM_CACHE: e.STREAM_CACHE as KVNamespace,
		YOUTUBE_COOKIE: e.YOUTUBE_COOKIE as string | undefined
	};
}

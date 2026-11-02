import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveStream } from '#lib/server/stream';

export const GET: RequestHandler = async ({ params, platform, url }) => {
	const { videoId } = params;
	if (!videoId) {
		throw error(400, 'Missing videoId');
	}

	const forceRefresh = url.searchParams.get('refresh') === 'true';
	const kv = platform?.env?.STREAM_CACHE;

	try {
		const stream = await resolveStream(videoId, kv, forceRefresh);
		return json(stream);
	} catch (err: any) {
		console.error(`Error resolving stream for ${videoId}:`, err);
		throw error(500, err?.message || 'Failed to resolve stream');
	}
};

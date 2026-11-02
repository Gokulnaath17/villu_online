import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRadioTracks } from '#lib/server/search';
import { getBindings } from '#lib/server/cf';

export const GET: RequestHandler = async ({ params, platform }) => {
	const { videoId } = params;
	if (!videoId) {
		throw error(400, 'Missing videoId');
	}

	try {
		const { STREAM_CACHE } = getBindings(platform);
		const tracks = await getRadioTracks(videoId, STREAM_CACHE);
		return json(tracks, {
			headers: {
				'Cache-Control': 'public, max-age=3600'
			}
		});
	} catch (err: any) {
		console.error('Radio error:', err);
		throw error(500, err?.message || 'Failed to fetch radio tracks');
	}
};

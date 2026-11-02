import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRadioTracks } from '#lib/server/search';
import { getBindings } from '#lib/server/cf';
import { isValidVideoId } from '#lib/server/db';

export const GET: RequestHandler = async ({ params, platform, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const { videoId } = params;
	if (!isValidVideoId(videoId)) {
		throw error(400, 'Invalid videoId format');
	}

	try {
		const { STREAM_CACHE } = getBindings(platform);
		const tracks = await getRadioTracks(videoId, STREAM_CACHE);
		return json(tracks, {
			headers: {
				'Cache-Control': 'private, max-age=3600'
			}
		});
	} catch (err: any) {
		console.error('Radio error:', err);
		throw error(500, err?.message || 'Failed to fetch radio tracks');
	}
};

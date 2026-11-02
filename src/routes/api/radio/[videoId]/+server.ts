import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRadioTracks } from '#lib/server/search';

export const GET: RequestHandler = async ({ params }) => {
	const { videoId } = params;
	if (!videoId) {
		throw error(400, 'Missing videoId');
	}

	try {
		const tracks = await getRadioTracks(videoId);
		return json(tracks);
	} catch (err: any) {
		console.error('Radio error:', err);
		throw error(500, err?.message || 'Failed to fetch radio tracks');
	}
};

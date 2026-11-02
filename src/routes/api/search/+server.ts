import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchTracks } from '#lib/server/search';
import { getBindings } from '#lib/server/cf';

export const GET: RequestHandler = async ({ url, platform }) => {
	const q = url.searchParams.get('q');
	if (!q || !q.trim()) {
		return json([]);
	}

	try {
		const { STREAM_CACHE } = getBindings(platform);
		const tracks = await searchTracks(q.trim(), STREAM_CACHE);
		return json(tracks, {
			headers: {
				'Cache-Control': 'public, max-age=1800'
			}
		});
	} catch (err: any) {
		console.error('Search error:', err);
		throw error(500, err?.message || 'Search failed');
	}
};

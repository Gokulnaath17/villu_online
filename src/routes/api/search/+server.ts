import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchTracks } from '#lib/server/search';
import { getBindings } from '#lib/server/cf';

export const GET: RequestHandler = async ({ url, platform, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const q = url.searchParams.get('q');
	if (!q || !q.trim()) {
		return json([]);
	}

	const cleanQuery = q.trim().slice(0, 100);

	try {
		const { STREAM_CACHE } = getBindings(platform);
		const tracks = await searchTracks(cleanQuery, STREAM_CACHE);
		return json(tracks, {
			headers: {
				'Cache-Control': 'private, max-age=1800'
			}
		});
	} catch (err: any) {
		console.error('Search error:', err);
		throw error(500, err?.message || 'Search failed');
	}
};

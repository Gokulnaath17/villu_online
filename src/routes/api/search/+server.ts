import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchTracks } from '#lib/server/search';

export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get('q');
	if (!q || !q.trim()) {
		return json([]);
	}

	try {
		const tracks = await searchTracks(q.trim());
		return json(tracks);
	} catch (err: any) {
		console.error('Search error:', err);
		throw error(500, err?.message || 'Search failed');
	}
};

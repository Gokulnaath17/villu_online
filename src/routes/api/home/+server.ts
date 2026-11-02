import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getHomePicks } from '#lib/server/search';

export const GET: RequestHandler = async ({ platform }) => {
	try {
		const kv = platform?.env?.STREAM_CACHE;
		const sections = await getHomePicks(kv);
		return json(sections, {
			headers: {
				'Cache-Control': 'public, max-age=1800'
			}
		});
	} catch (err: any) {
		console.error('Home picks error:', err);
		return json([]);
	}
};

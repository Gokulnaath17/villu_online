import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getHomePicks } from '#lib/server/search';
import { getBindings } from '#lib/server/cf';

export const GET: RequestHandler = async ({ platform }) => {
	try {
		const { STREAM_CACHE } = getBindings(platform);
		const sections = await getHomePicks(STREAM_CACHE);
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

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { recordHistory, getRecentHistory } from '#lib/server/db';
import type { SongTrack } from '#lib/types';
import { getBindings } from '#lib/server/cf';

export const GET: RequestHandler = async ({ locals, platform, url }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const { DB } = getBindings(platform);
	const limit = parseInt(url.searchParams.get('limit') || '30', 10);
	const history = await getRecentHistory(DB, locals.user.id, limit);
	return json(history);
};

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const body = (await request.json().catch(() => ({}))) as any;
	const track = body.track as SongTrack;
	if (!track || !track.videoId) {
		throw error(400, 'Missing track payload');
	}

	try {
		const { DB } = getBindings(platform);
		await recordHistory(DB, locals.user.id, track);
		return json({ success: true });
	} catch (err: any) {
		throw error(400, err?.message || 'Failed to record history');
	}
};

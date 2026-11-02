import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getUserIdFromRequest,
	ensureUser,
	recordHistory,
	getRecentHistory
} from '#lib/server/db';
import type { SongTrack } from '#lib/types';
import { getBindings } from '#lib/server/cf';

export const GET: RequestHandler = async ({ request, platform, url }) => {
	const user = getUserIdFromRequest(request);
	const { DB } = getBindings(platform);
	await ensureUser(DB, user);

	const limit = parseInt(url.searchParams.get('limit') || '30', 10);
	const history = await getRecentHistory(DB, user.id, limit);
	return json(history);
};

export const POST: RequestHandler = async ({ request, platform }) => {
	const user = getUserIdFromRequest(request);
	const { DB } = getBindings(platform);
	await ensureUser(DB, user);

	const body = await request.json().catch(() => ({}));
	const track = body.track as SongTrack;
	if (!track || !track.videoId) {
		throw error(400, 'Missing track payload');
	}

	await recordHistory(DB, user.id, track);
	return json({ success: true });
};

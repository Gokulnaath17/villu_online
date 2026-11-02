import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getUserIdFromRequest,
	ensureUser,
	recordHistory,
	getRecentHistory
} from '#lib/server/db';
import type { SongTrack } from '#lib/types';

export const GET: RequestHandler = async ({ request, platform, url }) => {
	const user = getUserIdFromRequest(request);
	const db = platform?.env?.DB;
	await ensureUser(db, user);

	const limit = parseInt(url.searchParams.get('limit') || '30', 10);
	const history = await getRecentHistory(db, user.id, limit);
	return json(history);
};

export const POST: RequestHandler = async ({ request, platform }) => {
	const user = getUserIdFromRequest(request);
	const db = platform?.env?.DB;
	await ensureUser(db, user);

	const body = await request.json().catch(() => ({}));
	const track = body.track as SongTrack;
	if (!track || !track.videoId) {
		throw error(400, 'Missing track payload');
	}

	await recordHistory(db, user.id, track);
	return json({ success: true });
};

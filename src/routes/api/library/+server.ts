import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getUserIdFromRequest,
	ensureUser,
	getLikedSongs,
	getLikedSongIds,
	toggleLikeSong
} from '#lib/server/db';
import type { SongTrack } from '#lib/types';

export const GET: RequestHandler = async ({ request, platform, url }) => {
	const user = getUserIdFromRequest(request);
	const db = platform?.env?.DB;
	await ensureUser(db, user);

	const idsOnly = url.searchParams.get('idsOnly') === 'true';
	if (idsOnly) {
		const ids = await getLikedSongIds(db, user.id);
		return json(ids);
	}

	const songs = await getLikedSongs(db, user.id);
	return json(songs);
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

	const isLiked = await toggleLikeSong(db, user.id, track);
	return json({ isLiked, videoId: track.videoId });
};

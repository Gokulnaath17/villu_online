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
import { getBindings } from '#lib/server/cf';

export const GET: RequestHandler = async ({ request, platform, url }) => {
	const user = getUserIdFromRequest(request);
	const { DB } = getBindings(platform);
	await ensureUser(DB, user);

	const idsOnly = url.searchParams.get('idsOnly') === 'true';
	if (idsOnly) {
		const ids = await getLikedSongIds(DB, user.id);
		return json(ids);
	}

	const songs = await getLikedSongs(DB, user.id);
	return json(songs);
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

	const isLiked = await toggleLikeSong(DB, user.id, track);
	return json({ isLiked, videoId: track.videoId });
};

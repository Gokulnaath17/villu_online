import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getLikedSongs, getLikedSongIds, toggleLikeSong } from '#lib/server/db';
import type { SongTrack } from '#lib/types';
import { getBindings } from '#lib/server/cf';

export const GET: RequestHandler = async ({ locals, platform, url }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const { DB } = getBindings(platform);
	const idsOnly = url.searchParams.get('idsOnly') === 'true';

	if (idsOnly) {
		const ids = await getLikedSongIds(DB, locals.user.id);
		return json(ids);
	}

	const songs = await getLikedSongs(DB, locals.user.id);
	return json(songs);
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
		const isLiked = await toggleLikeSong(DB, locals.user.id, track);
		return json({ isLiked, videoId: track.videoId });
	} catch (err: any) {
		throw error(400, err?.message || 'Failed to toggle like');
	}
};

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getPlaylistById,
	verifyPlaylistOwnership,
	addTrackToPlaylist,
	removeTrackFromPlaylist
} from '#lib/server/db';
import type { SongTrack } from '#lib/types';
import { getBindings } from '#lib/server/cf';

export const GET: RequestHandler = async ({ params, locals, platform }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const { id } = params;
	if (!id) throw error(400, 'Missing playlist ID');

	const { DB } = getBindings(platform);
	const playlist = await getPlaylistById(DB, id, locals.user.id);
	if (!playlist) {
		throw error(404, 'Playlist not found or access denied');
	}

	return json(playlist);
};

export const POST: RequestHandler = async ({ params, request, locals, platform }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const { id } = params;
	if (!id) throw error(400, 'Missing playlist ID');

	const { DB } = getBindings(platform);
	const isOwner = await verifyPlaylistOwnership(DB, id, locals.user.id);
	if (!isOwner) {
		throw error(403, 'Forbidden: You do not own this playlist');
	}

	const body = (await request.json().catch(() => ({}))) as any;
	const track = body.track as SongTrack;
	if (!track || !track.videoId) {
		throw error(400, 'Missing track payload');
	}

	try {
		await addTrackToPlaylist(DB, id, track);
		return json({ success: true });
	} catch (err: any) {
		throw error(400, err?.message || 'Failed to add track');
	}
};

export const DELETE: RequestHandler = async ({ params, url, locals, platform }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const { id } = params;
	if (!id) throw error(400, 'Missing playlist ID');

	const { DB } = getBindings(platform);
	const isOwner = await verifyPlaylistOwnership(DB, id, locals.user.id);
	if (!isOwner) {
		throw error(403, 'Forbidden: You do not own this playlist');
	}

	const videoId = url.searchParams.get('videoId');
	if (!videoId) throw error(400, 'Missing videoId');

	try {
		await removeTrackFromPlaylist(DB, id, videoId);
		return json({ success: true });
	} catch (err: any) {
		throw error(400, err?.message || 'Failed to remove track');
	}
};

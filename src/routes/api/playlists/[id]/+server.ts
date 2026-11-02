import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getPlaylistById,
	addTrackToPlaylist,
	removeTrackFromPlaylist
} from '#lib/server/db';
import type { SongTrack } from '#lib/types';
import { getBindings } from '#lib/server/cf';

export const GET: RequestHandler = async ({ params, platform }) => {
	const { id } = params;
	if (!id) throw error(400, 'Missing playlist ID');

	const { DB } = getBindings(platform);
	const playlist = await getPlaylistById(DB, id);
	if (!playlist) {
		throw error(404, 'Playlist not found');
	}

	return json(playlist);
};

export const POST: RequestHandler = async ({ params, request, platform }) => {
	const { id } = params;
	if (!id) throw error(400, 'Missing playlist ID');

	const body = await request.json().catch(() => ({}));
	const track = body.track as SongTrack;
	if (!track || !track.videoId) {
		throw error(400, 'Missing track payload');
	}

	const { DB } = getBindings(platform);
	await addTrackToPlaylist(DB, id, track);
	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ params, url, platform }) => {
	const { id } = params;
	if (!id) throw error(400, 'Missing playlist ID');

	const videoId = url.searchParams.get('videoId');
	if (!videoId) throw error(400, 'Missing videoId');

	const { DB } = getBindings(platform);
	await removeTrackFromPlaylist(DB, id, videoId);
	return json({ success: true });
};

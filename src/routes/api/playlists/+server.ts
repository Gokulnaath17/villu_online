import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserPlaylists, createPlaylist } from '#lib/server/db';
import { getBindings } from '#lib/server/cf';

export const GET: RequestHandler = async ({ locals, platform }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const { DB } = getBindings(platform);
	const playlists = await getUserPlaylists(DB, locals.user.id);
	return json(playlists);
};

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const body = (await request.json().catch(() => ({}))) as any;
	const name = (body.name || '').trim();
	if (!name) {
		throw error(400, 'Playlist name is required');
	}

	const { DB } = getBindings(platform);
	const playlist = await createPlaylist(DB, locals.user.id, name, body.description);
	return json(playlist);
};

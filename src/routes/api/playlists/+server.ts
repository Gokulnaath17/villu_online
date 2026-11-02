import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getUserIdFromRequest,
	ensureUser,
	getUserPlaylists,
	createPlaylist
} from '#lib/server/db';

export const GET: RequestHandler = async ({ request, platform }) => {
	const user = getUserIdFromRequest(request);
	const db = platform?.env?.DB;
	await ensureUser(db, user);

	const playlists = await getUserPlaylists(db, user.id);
	return json(playlists);
};

export const POST: RequestHandler = async ({ request, platform }) => {
	const user = getUserIdFromRequest(request);
	const db = platform?.env?.DB;
	await ensureUser(db, user);

	const body = await request.json().catch(() => ({}));
	const name = (body.name || '').trim();
	if (!name) {
		throw error(400, 'Playlist name is required');
	}

	const playlist = await createPlaylist(db, user.id, name, body.description);
	return json(playlist);
};

import type { Playlist, SongTrack, UserSession } from '#lib/types';

// In-memory fallback for local dev without D1 binding
const memoryDb = {
	users: new Map<string, { id: string; email: string; name: string }>(),
	playlists: new Map<string, Playlist & { tracks: (SongTrack & { position: number })[] }>(),
	likedSongs: new Map<string, Set<string>>(), // userId -> Set of videoIds
	likedSongsDetails: new Map<string, SongTrack & { likedAt: number }>(),
	history: [] as { userId: string; track: SongTrack; playedAt: number }[]
};

export function getUserIdFromRequest(request: Request): UserSession {
	// Cloudflare Access passes authenticated user's email in Cf-Access-Authenticated-User-Email
	const cfEmail = request.headers.get('cf-access-authenticated-user-email');
	const email = cfEmail || 'personal@villu.online';
	const id = Buffer.from(email).toString('base64url').slice(0, 16);
	return {
		id,
		email,
		name: email.split('@')[0]
	};
}

export async function ensureUser(db: D1Database | undefined, user: UserSession): Promise<void> {
	if (db) {
		try {
			await db
				.prepare(
					'INSERT INTO users (id, email, name) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name'
				)
				.bind(user.id, user.email, user.name || user.email)
				.run();
		} catch (err) {
			console.warn('ensureUser D1 error:', err);
		}
	} else {
		memoryDb.users.set(user.id, { id: user.id, email: user.email, name: user.name || user.email });
	}
}

// ─── Playlists ──────────────────────────────────────────────────────────────

export async function getUserPlaylists(db: D1Database | undefined, userId: string): Promise<Playlist[]> {
	if (db) {
		try {
			const { results } = await db
				.prepare(
					`SELECT p.id, p.user_id as userId, p.name, p.description, p.cover_url as coverUrl,
					        p.is_public as isPublic, p.created_at as createdAt, p.updated_at as updatedAt,
					        COUNT(pt.video_id) as tracksCount
					 FROM playlists p
					 LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
					 WHERE p.user_id = ?
					 GROUP BY p.id
					 ORDER BY p.updated_at DESC`
				)
				.bind(userId)
				.all();
			return (results as any[]) || [];
		} catch (err) {
			console.warn('getUserPlaylists D1 error:', err);
			return [];
		}
	}

	// Memory fallback
	const userPlaylists: Playlist[] = [];
	for (const pl of memoryDb.playlists.values()) {
		if (pl.userId === userId) {
			userPlaylists.push({
				...pl,
				tracksCount: pl.tracks?.length || 0
			});
		}
	}
	return userPlaylists;
}

export async function getPlaylistById(
	db: D1Database | undefined,
	playlistId: string
): Promise<Playlist | null> {
	if (db) {
		try {
			const playlist = (await db
				.prepare(
					`SELECT id, user_id as userId, name, description, cover_url as coverUrl,
					        is_public as isPublic, created_at as createdAt, updated_at as updatedAt
					 FROM playlists WHERE id = ?`
				)
				.bind(playlistId)
				.first()) as any;

			if (!playlist) return null;

			const { results: tracks } = await db
				.prepare(
					`SELECT video_id as videoId, title, artist, thumbnail, duration, position
					 FROM playlist_tracks
					 WHERE playlist_id = ?
					 ORDER BY position ASC`
				)
				.bind(playlistId)
				.all();

			return {
				...playlist,
				tracks: (tracks as any[]) || [],
				tracksCount: tracks?.length || 0
			};
		} catch (err) {
			console.warn('getPlaylistById D1 error:', err);
			return null;
		}
	}

	const found = memoryDb.playlists.get(playlistId);
	if (!found) return null;
	return {
		...found,
		tracksCount: found.tracks?.length || 0
	};
}

export async function createPlaylist(
	db: D1Database | undefined,
	userId: string,
	name: string,
	description?: string
): Promise<Playlist> {
	const id = crypto.randomUUID().slice(0, 12);
	const now = Math.floor(Date.now() / 1000);

	if (db) {
		await db
			.prepare(
				'INSERT INTO playlists (id, user_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
			)
			.bind(id, userId, name, description || '', now, now)
			.run();
	} else {
		memoryDb.playlists.set(id, {
			id,
			userId,
			name,
			description,
			createdAt: now,
			updatedAt: now,
			tracks: []
		});
	}

	return {
		id,
		userId,
		name,
		description,
		createdAt: now,
		updatedAt: now,
		tracksCount: 0,
		tracks: []
	};
}

export async function addTrackToPlaylist(
	db: D1Database | undefined,
	playlistId: string,
	track: SongTrack
): Promise<void> {
	const now = Math.floor(Date.now() / 1000);

	if (db) {
		// Find max position
		const maxPosRow = (await db
			.prepare('SELECT MAX(position) as maxPos FROM playlist_tracks WHERE playlist_id = ?')
			.bind(playlistId)
			.first()) as any;
		const nextPos = (maxPosRow?.maxPos ?? -1) + 1;

		await db
			.prepare(
				`INSERT INTO playlist_tracks (playlist_id, video_id, title, artist, thumbnail, duration, position, added_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
				 ON CONFLICT(playlist_id, video_id) DO UPDATE SET
				 title = excluded.title,
				 artist = excluded.artist,
				 thumbnail = excluded.thumbnail,
				 duration = excluded.duration`
			)
			.bind(playlistId, track.videoId, track.title, track.artist, track.thumbnail, track.duration, nextPos, now)
			.run();

		await db.prepare('UPDATE playlists SET updated_at = ? WHERE id = ?').bind(now, playlistId).run();
	} else {
		const pl = memoryDb.playlists.get(playlistId);
		if (pl) {
			if (!pl.tracks) pl.tracks = [];
			const exists = pl.tracks.find((t) => t.videoId === track.videoId);
			if (!exists) {
				pl.tracks.push({ ...track, position: pl.tracks.length });
			}
			pl.updatedAt = now;
		}
	}
}

export async function removeTrackFromPlaylist(
	db: D1Database | undefined,
	playlistId: string,
	videoId: string
): Promise<void> {
	if (db) {
		await db
			.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND video_id = ?')
			.bind(playlistId, videoId)
			.run();
	} else {
		const pl = memoryDb.playlists.get(playlistId);
		if (pl && pl.tracks) {
			pl.tracks = pl.tracks.filter((t) => t.videoId !== videoId);
		}
	}
}

// ─── Liked Songs ────────────────────────────────────────────────────────────

export async function toggleLikeSong(
	db: D1Database | undefined,
	userId: string,
	track: SongTrack
): Promise<boolean> {
	const now = Math.floor(Date.now() / 1000);

	if (db) {
		const existing = await db
			.prepare('SELECT 1 FROM liked_songs WHERE user_id = ? AND video_id = ?')
			.bind(userId, track.videoId)
			.first();

		if (existing) {
			await db
				.prepare('DELETE FROM liked_songs WHERE user_id = ? AND video_id = ?')
				.bind(userId, track.videoId)
				.run();
			return false;
		} else {
			await db
				.prepare(
					'INSERT INTO liked_songs (user_id, video_id, title, artist, thumbnail, duration, liked_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
				)
				.bind(userId, track.videoId, track.title, track.artist, track.thumbnail, track.duration, now)
				.run();
			return true;
		}
	}

	let userLikes = memoryDb.likedSongs.get(userId);
	if (!userLikes) {
		userLikes = new Set<string>();
		memoryDb.likedSongs.set(userId, userLikes);
	}

	if (userLikes.has(track.videoId)) {
		userLikes.delete(track.videoId);
		return false;
	} else {
		userLikes.add(track.videoId);
		memoryDb.likedSongsDetails.set(track.videoId, { ...track, likedAt: now });
		return true;
	}
}

export async function getLikedSongIds(db: D1Database | undefined, userId: string): Promise<string[]> {
	if (db) {
		try {
			const { results } = await db
				.prepare('SELECT video_id as videoId FROM liked_songs WHERE user_id = ? ORDER BY liked_at DESC')
				.bind(userId)
				.all();
			return (results as any[])?.map((r) => r.videoId) || [];
		} catch (err) {
			console.warn('getLikedSongIds D1 error:', err);
			return [];
		}
	}

	const userLikes = memoryDb.likedSongs.get(userId);
	return userLikes ? Array.from(userLikes) : [];
}

export async function getLikedSongs(db: D1Database | undefined, userId: string): Promise<SongTrack[]> {
	if (db) {
		try {
			const { results } = await db
				.prepare(
					'SELECT video_id as videoId, title, artist, thumbnail, duration FROM liked_songs WHERE user_id = ? ORDER BY liked_at DESC'
				)
				.bind(userId)
				.all();
			return (results as any[]) || [];
		} catch (err) {
			console.warn('getLikedSongs D1 error:', err);
			return [];
		}
	}

	const ids = memoryDb.likedSongs.get(userId);
	if (!ids) return [];
	const tracks: SongTrack[] = [];
	for (const id of ids) {
		const track = memoryDb.likedSongsDetails.get(id);
		if (track) tracks.push(track);
	}
	return tracks;
}

// ─── History ────────────────────────────────────────────────────────────────

export async function recordHistory(
	db: D1Database | undefined,
	userId: string,
	track: SongTrack
): Promise<void> {
	const now = Math.floor(Date.now() / 1000);

	if (db) {
		try {
			await db
				.prepare(
					'INSERT INTO history (user_id, video_id, title, artist, thumbnail, duration, played_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
				)
				.bind(userId, track.videoId, track.title, track.artist, track.thumbnail, track.duration, now)
				.run();
		} catch (err) {
			console.warn('recordHistory D1 error:', err);
		}
	} else {
		memoryDb.history.unshift({ userId, track, playedAt: now });
		if (memoryDb.history.length > 50) memoryDb.history.pop();
	}
}

export async function getRecentHistory(
	db: D1Database | undefined,
	userId: string,
	limit: number = 30
): Promise<SongTrack[]> {
	if (db) {
		try {
			const { results } = await db
				.prepare(
					`SELECT video_id as videoId, title, artist, thumbnail, duration
					 FROM history
					 WHERE user_id = ?
					 ORDER BY played_at DESC
					 LIMIT ?`
				)
				.bind(userId, limit)
				.all();

			// Deduplicate by videoId in returned order
			const seen = new Set<string>();
			const unique: SongTrack[] = [];
			for (const r of (results as any[]) || []) {
				if (!seen.has(r.videoId)) {
					seen.add(r.videoId);
					unique.push(r);
				}
			}
			return unique;
		} catch (err) {
			console.warn('getRecentHistory D1 error:', err);
			return [];
		}
	}

	const seen = new Set<string>();
	const unique: SongTrack[] = [];
	for (const item of memoryDb.history) {
		if (item.userId === userId && !seen.has(item.track.videoId)) {
			seen.add(item.track.videoId);
			unique.push(item.track);
		}
	}
	return unique.slice(0, limit);
}

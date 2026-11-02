import type { UserSession, Session } from '#lib/types';
import { generateSessionToken, hashPassword, verifyPassword } from './crypto';

export const SESSION_COOKIE_NAME = 'villu_session';
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

// In-memory fallback for local dev without D1 binding
const memoryUsers = new Map<
	string,
	{
		id: string;
		username: string;
		email?: string;
		name?: string;
		passwordHash: string;
		passwordSalt: string;
		iterations: number;
		role: string;
	}
>();

const memorySessions = new Map<
	string,
	{
		id: string;
		userId: string;
		expiresAt: number;
		createdAt: number;
	}
>();

export async function hasAnyUsers(db: D1Database | undefined): Promise<boolean> {
	if (db) {
		try {
			const res = await db
				.prepare('SELECT COUNT(*) as count FROM users WHERE password_hash IS NOT NULL')
				.first<{ count: number }>();
			return (res?.count ?? 0) > 0;
		} catch (err) {
			console.warn('hasAnyUsers D1 check error:', err);
			// In case the column was not yet added, fallback to false
			return false;
		}
	}
	return memoryUsers.size > 0;
}

export async function claimLegacyData(db: D1Database | undefined, newUserId: string): Promise<void> {
	const legacyId = 'cGVyc29uYWxAdmls'; // 'personal@villu.online' base64url prefix
	if (!db) return;

	try {
		// Re-point playlists
		await db.prepare('UPDATE playlists SET user_id = ? WHERE user_id = ?').bind(newUserId, legacyId).run();

		// Re-point liked songs (ignoring duplicates if any)
		await db.prepare('UPDATE OR IGNORE liked_songs SET user_id = ? WHERE user_id = ?').bind(newUserId, legacyId).run();
		await db.prepare('DELETE FROM liked_songs WHERE user_id = ?').bind(legacyId).run();

		// Re-point history
		await db.prepare('UPDATE history SET user_id = ? WHERE user_id = ?').bind(newUserId, legacyId).run();

		// Clean up legacy placeholder user
		await db.prepare('DELETE FROM users WHERE id = ?').bind(legacyId).run();
		console.info(`Successfully claimed legacy records from ${legacyId} for user ${newUserId}`);
	} catch (err) {
		console.warn('claimLegacyData error:', err);
	}
}

export async function createUser(
	db: D1Database | undefined,
	username: string,
	password: string,
	email?: string,
	name?: string,
	role: string = 'user'
): Promise<UserSession> {
	const cleanUsername = username.trim().toLowerCase();
	if (!/^[a-zA-Z0-9_]{3,32}$/.test(cleanUsername)) {
		throw new Error('Username must be 3-32 alphanumeric characters or underscores');
	}
	if (!password || password.length < 8) {
		throw new Error('Password must be at least 8 characters long');
	}

	const id = crypto.randomUUID().slice(0, 16);
	const { hash, salt, iterations } = await hashPassword(password);
	const now = Math.floor(Date.now() / 1000);
	const cleanEmail = email?.trim().toLowerCase() || null;
	const displayName = name?.trim() || cleanUsername;

	if (db) {
		await db
			.prepare(
				`INSERT INTO users (id, username, email, name, password_hash, password_salt, iterations, role, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(id, cleanUsername, cleanEmail, displayName, hash, salt, iterations, role, now, now)
			.run();

		// If this is an admin account, claim any legacy data from the default placeholder
		if (role === 'admin') {
			await claimLegacyData(db, id);
		}
	} else {
		memoryUsers.set(id, {
			id,
			username: cleanUsername,
			email: cleanEmail || undefined,
			name: displayName,
			passwordHash: hash,
			passwordSalt: salt,
			iterations,
			role
		});
	}

	return {
		id,
		username: cleanUsername,
		email: cleanEmail || undefined,
		name: displayName,
		role
	};
}

export async function authenticateUser(
	db: D1Database | undefined,
	identifier: string,
	password: string
): Promise<UserSession | null> {
	const clean = identifier.trim().toLowerCase();
	if (!clean || !password) return null;

	if (db) {
		try {
			const user = await db
				.prepare(
					`SELECT id, username, email, name, password_hash, password_salt, iterations, role
					 FROM users
					 WHERE username = ? OR email = ?
					 LIMIT 1`
				)
				.bind(clean, clean)
				.first<any>();

			if (!user || !user.password_hash || !user.password_salt) {
				return null;
			}

			const isValid = await verifyPassword(
				password,
				user.password_hash,
				user.password_salt,
				user.iterations || 100_000
			);

			if (!isValid) return null;

			return {
				id: user.id,
				username: user.username,
				email: user.email,
				name: user.name,
				role: user.role
			};
		} catch (err) {
			console.error('authenticateUser D1 error:', err);
			return null;
		}
	}

	// Memory fallback
	for (const u of memoryUsers.values()) {
		if (u.username === clean || u.email === clean) {
			const isValid = await verifyPassword(password, u.passwordHash, u.passwordSalt, u.iterations);
			if (!isValid) return null;
			return {
				id: u.id,
				username: u.username,
				email: u.email,
				name: u.name,
				role: u.role
			};
		}
	}

	return null;
}

export async function createSession(
	db: D1Database | undefined,
	userId: string,
	request?: Request
): Promise<{ id: string; expiresAt: number }> {
	const sessionId = generateSessionToken();
	const now = Math.floor(Date.now() / 1000);
	const expiresAt = now + SESSION_MAX_AGE_SECONDS;
	const userAgent = request?.headers.get('user-agent')?.slice(0, 200) || null;

	if (db) {
		await db
			.prepare('INSERT INTO sessions (id, user_id, user_agent, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
			.bind(sessionId, userId, userAgent, expiresAt, now)
			.run();
	} else {
		memorySessions.set(sessionId, {
			id: sessionId,
			userId,
			expiresAt,
			createdAt: now
		});
	}

	return { id: sessionId, expiresAt };
}

export async function validateSession(
	db: D1Database | undefined,
	sessionId: string
): Promise<{ user: UserSession; session: Session } | null> {
	if (!sessionId) return null;
	const now = Math.floor(Date.now() / 1000);

	if (db) {
		try {
			const row = await db
				.prepare(
					`SELECT s.id as session_id, s.user_id, s.expires_at, s.created_at as session_created_at,
					        u.id, u.username, u.email, u.name, u.role
					 FROM sessions s
					 JOIN users u ON s.user_id = u.id
					 WHERE s.id = ? AND s.expires_at > ?
					 LIMIT 1`
				)
				.bind(sessionId, now)
				.first<any>();

			if (!row) return null;

			return {
				user: {
					id: row.id,
					username: row.username,
					email: row.email,
					name: row.name,
					role: row.role
				},
				session: {
					id: row.session_id,
					userId: row.user_id,
					expiresAt: row.expires_at,
					createdAt: row.session_created_at
				}
			};
		} catch (err) {
			console.warn('validateSession D1 error:', err);
			return null;
		}
	}

	// Memory fallback
	const mem = memorySessions.get(sessionId);
	if (!mem || mem.expiresAt <= now) {
		if (mem) memorySessions.delete(sessionId);
		return null;
	}

	const user = memoryUsers.get(mem.userId);
	if (!user) return null;

	return {
		user: {
			id: user.id,
			username: user.username,
			email: user.email,
			name: user.name,
			role: user.role
		},
		session: mem
	};
}

export async function destroySession(db: D1Database | undefined, sessionId: string): Promise<void> {
	if (!sessionId) return;
	if (db) {
		try {
			await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
		} catch (err) {
			console.warn('destroySession D1 error:', err);
		}
	} else {
		memorySessions.delete(sessionId);
	}
}


import type { UserSession, AuditLog } from '#lib/types';
import { hashPassword } from './auth/crypto';

export interface AdminUserView {
	id: string;
	username: string;
	email?: string;
	name?: string;
	role: string;
	isActive: boolean;
	createdAt: number;
	sessionCount: number;
	lastActive?: number;
}

export interface SystemListeningLog {
	id: number;
	userId: string;
	username: string;
	videoId: string;
	title: string;
	artist?: string;
	thumbnail?: string;
	playedAt: number;
}

export interface ActiveSessionView {
	id: string;
	userId: string;
	username: string;
	userAgent?: string;
	expiresAt: number;
	createdAt: number;
	isCurrent?: boolean;
}

export async function createAuditLog(
	db: D1Database | undefined,
	params: {
		userId?: string;
		username?: string;
		action: string;
		details?: string;
		ipHash?: string;
	}
): Promise<void> {
	const now = Math.floor(Date.now() / 1000);
	if (db) {
		try {
			await db
				.prepare(
					'INSERT INTO audit_logs (user_id, username, action, details, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)'
				)
				.bind(
					params.userId || null,
					params.username || null,
					params.action,
					params.details || null,
					params.ipHash || null,
					now
				)
				.run();
		} catch (err) {
			console.warn('createAuditLog error:', err);
		}
	}
}

export async function listAllUsers(db: D1Database | undefined): Promise<AdminUserView[]> {
	if (!db) return [];
	try {
		const now = Math.floor(Date.now() / 1000);
		const { results } = await db
			.prepare(
				`SELECT u.id, u.username, u.email, u.name, u.role,
				        COALESCE(u.is_active, 1) as is_active,
				        u.created_at,
				        COUNT(DISTINCT CASE WHEN s.expires_at > ? THEN s.id END) as session_count,
				        MAX(s.created_at) as last_active
				 FROM users u
				 LEFT JOIN sessions s ON u.id = s.user_id
				 WHERE u.password_hash IS NOT NULL
				 GROUP BY u.id
				 ORDER BY u.created_at ASC`
			)
			.bind(now)
			.all();

		return (results as any[]).map((r) => ({
			id: r.id,
			username: r.username,
			email: r.email || undefined,
			name: r.name || undefined,
			role: r.role || 'user',
			isActive: r.is_active === 1,
			createdAt: r.created_at || 0,
			sessionCount: Number(r.session_count) || 0,
			lastActive: r.last_active ? Number(r.last_active) : undefined
		}));
	} catch (err) {
		console.error('listAllUsers error:', err);
		return [];
	}
}

export async function toggleUserAccess(
	db: D1Database | undefined,
	targetUserId: string,
	isActive: boolean,
	adminUser: UserSession
): Promise<boolean> {
	if (!db) return false;
	// Prevent self-lockout
	if (targetUserId === adminUser.id && !isActive) {
		throw new Error('You cannot deactivate your own admin account.');
	}

	try {
		const newStatus = isActive ? 1 : 0;
		await db
			.prepare('UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?')
			.bind(newStatus, Math.floor(Date.now() / 1000), targetUserId)
			.run();

		// If deactivating, destroy all active sessions for that user
		if (!isActive) {
			await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(targetUserId).run();
		}

		await createAuditLog(db, {
			userId: adminUser.id,
			username: adminUser.username,
			action: isActive ? 'ENABLE_USER' : 'DISABLE_USER',
			details: `Target user: ${targetUserId}`
		});

		return true;
	} catch (err: any) {
		console.error('toggleUserAccess error:', err);
		throw err;
	}
}

export async function updateUserRole(
	db: D1Database | undefined,
	targetUserId: string,
	newRole: 'admin' | 'user',
	adminUser: UserSession
): Promise<boolean> {
	if (!db) return false;
	// Prevent self-demotion
	if (targetUserId === adminUser.id && newRole !== 'admin') {
		throw new Error('You cannot demote your own admin account.');
	}

	try {
		await db
			.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?')
			.bind(newRole, Math.floor(Date.now() / 1000), targetUserId)
			.run();

		await createAuditLog(db, {
			userId: adminUser.id,
			username: adminUser.username,
			action: 'CHANGE_ROLE',
			details: `User ${targetUserId} role updated to ${newRole}`
		});

		return true;
	} catch (err: any) {
		console.error('updateUserRole error:', err);
		throw err;
	}
}

export async function deleteUserAccount(
	db: D1Database | undefined,
	targetUserId: string,
	adminUser: UserSession
): Promise<boolean> {
	if (!db) return false;
	if (targetUserId === adminUser.id) {
		throw new Error('You cannot delete your own admin account.');
	}

	try {
		// Clean up sessions, playlists, likes, history, and user
		await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(targetUserId).run();
		await db.prepare('DELETE FROM liked_songs WHERE user_id = ?').bind(targetUserId).run();
		await db.prepare('DELETE FROM history WHERE user_id = ?').bind(targetUserId).run();
		await db.prepare('DELETE FROM playlists WHERE user_id = ?').bind(targetUserId).run();
		await db.prepare('DELETE FROM users WHERE id = ?').bind(targetUserId).run();

		await createAuditLog(db, {
			userId: adminUser.id,
			username: adminUser.username,
			action: 'DELETE_USER',
			details: `Deleted user: ${targetUserId}`
		});

		return true;
	} catch (err: any) {
		console.error('deleteUserAccount error:', err);
		throw err;
	}
}

export async function createManagedUser(
	db: D1Database | undefined,
	data: {
		username: string;
		password: string;
		name?: string;
		email?: string;
		role?: string;
		isActive?: boolean;
	},
	adminUser: UserSession
): Promise<AdminUserView> {
	if (!db) throw new Error('Database unavailable');
	const cleanUsername = data.username.trim().toLowerCase();
	const cleanEmail = data.email?.trim().toLowerCase() || `${cleanUsername}@local.villu`;
	const cleanRole = data.role === 'admin' ? 'admin' : 'user';
	const active = data.isActive !== false ? 1 : 0;

	if (!cleanUsername || !data.password) {
		throw new Error('Username and password are required.');
	}

	const existing = await db
		.prepare('SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1')
		.bind(cleanUsername, cleanEmail)
		.first();

	if (existing) {
		throw new Error('Username or email already exists.');
	}

	const iterations = 100_000;
	const { hash, salt } = await hashPassword(data.password, iterations);
	const newUserId = crypto.randomUUID().slice(0, 16);
	const now = Math.floor(Date.now() / 1000);

	await db
		.prepare(
			`INSERT INTO users (id, username, email, name, password_hash, password_salt, iterations, role, is_active, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			newUserId,
			cleanUsername,
			cleanEmail,
			data.name?.trim() || cleanUsername,
			hash,
			salt,
			iterations,
			cleanRole,
			active,
			now,
			now
		)
		.run();

	await createAuditLog(db, {
		userId: adminUser.id,
		username: adminUser.username,
		action: 'CREATE_USER',
		details: `Created user ${cleanUsername} with role ${cleanRole}`
	});

	return {
		id: newUserId,
		username: cleanUsername,
		email: cleanEmail,
		name: data.name?.trim() || cleanUsername,
		role: cleanRole,
		isActive: active === 1,
		createdAt: now,
		sessionCount: 0
	};
}

export async function listAuditLogs(db: D1Database | undefined, limit: number = 50): Promise<AuditLog[]> {
	if (!db) return [];
	try {
		const safeLimit = Math.max(1, Math.min(200, limit));
		const { results } = await db
			.prepare(
				`SELECT id, user_id as userId, username, action, details, ip_hash as ipHash, created_at as createdAt
				 FROM audit_logs
				 ORDER BY created_at DESC, id DESC
				 LIMIT ?`
			)
			.bind(safeLimit)
			.all();

		return (results as any[]) || [];
	} catch (err) {
		console.warn('listAuditLogs error:', err);
		return [];
	}
}

export async function listActiveSessions(
	db: D1Database | undefined,
	currentSessionId?: string
): Promise<ActiveSessionView[]> {
	if (!db) return [];
	try {
		const now = Math.floor(Date.now() / 1000);
		const { results } = await db
			.prepare(
				`SELECT s.id, s.user_id as userId, u.username, s.user_agent as userAgent,
				        s.expires_at as expiresAt, s.created_at as createdAt
				 FROM sessions s
				 JOIN users u ON s.user_id = u.id
				 WHERE s.expires_at > ?
				 ORDER BY s.created_at DESC
				 LIMIT 100`
			)
			.bind(now)
			.all();

		return (results as any[]).map((r) => ({
			...r,
			isCurrent: currentSessionId ? r.id === currentSessionId : false
		}));
	} catch (err) {
		console.warn('listActiveSessions error:', err);
		return [];
	}
}

export async function revokeSessionById(
	db: D1Database | undefined,
	sessionId: string,
	adminUser: UserSession
): Promise<boolean> {
	if (!db) return false;
	try {
		await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
		await createAuditLog(db, {
			userId: adminUser.id,
			username: adminUser.username,
			action: 'REVOKE_SESSION',
			details: `Session revoked: ${sessionId.slice(0, 8)}...`
		});
		return true;
	} catch (err: any) {
		console.error('revokeSessionById error:', err);
		throw err;
	}
}

export async function listSystemListeningLogs(
	db: D1Database | undefined,
	limit: number = 50
): Promise<SystemListeningLog[]> {
	if (!db) return [];
	try {
		const safeLimit = Math.max(1, Math.min(200, limit));
		const { results } = await db
			.prepare(
				`SELECT h.id, h.user_id as userId, u.username, h.video_id as videoId,
				        h.title, h.artist, h.thumbnail, h.played_at as playedAt
				 FROM history h
				 JOIN users u ON h.user_id = u.id
				 ORDER BY h.played_at DESC
				 LIMIT ?`
			)
			.bind(safeLimit)
			.all();

		return (results as any[]) || [];
	} catch (err) {
		console.warn('listSystemListeningLogs error:', err);
		return [];
	}
}

export async function getSystemSetting(db: D1Database | undefined, key: string): Promise<string | null> {
	if (!db) return null;
	try {
		const res = await db.prepare('SELECT value FROM system_settings WHERE key = ? LIMIT 1').bind(key).first<{ value: string }>();
		return res?.value ?? null;
	} catch (err) {
		console.warn(`getSystemSetting error for ${key}:`, err);
		return null;
	}
}

export async function setSystemSetting(
	db: D1Database | undefined,
	key: string,
	value: string,
	adminUser: { id: string; username: string }
): Promise<void> {
	if (!db) return;
	try {
		const now = Math.floor(Date.now() / 1000);
		await db
			.prepare('INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
			.bind(key, value, now)
			.run();

		await createAuditLog(db, {
			userId: adminUser.id,
			username: adminUser.username,
			action: 'UPDATE_SETTING',
			details: `Updated setting: ${key}`
		});
	} catch (err) {
		console.error(`setSystemSetting error for ${key}:`, err);
		throw err;
	}
}



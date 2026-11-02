import { error, redirect, fail, type Actions, type ServerLoad } from '@sveltejs/kit';
import { getBindings } from '#lib/server/cf';
import {
	listAllUsers,
	toggleUserAccess,
	updateUserRole,
	deleteUserAccount,
	createManagedUser,
	listAuditLogs,
	listActiveSessions,
	revokeSessionById,
	listSystemListeningLogs,
	getSystemSetting,
	setSystemSetting
} from '#lib/server/admin';

export const load: ServerLoad = async ({ locals, platform }) => {
	if (!locals.user) {
		throw redirect(303, '/login?redirectTo=/admin');
	}

	if (locals.user.role !== 'admin') {
		throw error(403, 'Forbidden: Admin access required');
	}

	const { DB, YOUTUBE_COOKIE } = getBindings(platform);
	const [users, auditLogs, activeSessions, listeningLogs, dbCookie] = await Promise.all([
		listAllUsers(DB),
		listAuditLogs(DB, 50),
		listActiveSessions(DB, locals.session?.id),
		listSystemListeningLogs(DB, 30),
		getSystemSetting(DB, 'youtube_cookie')
	]);

	const effectiveCookie = dbCookie || YOUTUBE_COOKIE || '';

	return {
		users,
		auditLogs,
		activeSessions,
		listeningLogs,
		currentUserId: locals.user.id,
		hasCustomCookie: !!effectiveCookie,
		cookiePreview: effectiveCookie ? `${effectiveCookie.slice(0, 15)}...${effectiveCookie.slice(-10)}` : null
	};
};

export const actions: Actions = {
	createUser: async ({ request, locals, platform }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			throw error(403, 'Unauthorized');
		}

		const data = await request.formData();
		const username = (data.get('username') as string)?.trim();
		const password = data.get('password') as string;
		const name = (data.get('name') as string)?.trim();
		const email = (data.get('email') as string)?.trim();
		const role = (data.get('role') as string) || 'user';
		const isActive = data.get('isActive') === '1';

		if (!username || !password) {
			return fail(400, { error: 'Username and password are required', username, name, email });
		}

		if (password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters long', username, name, email });
		}

		const { DB } = getBindings(platform);
		try {
			await createManagedUser(
				DB,
				{
					username,
					password,
					name,
					email,
					role,
					isActive
				},
				locals.user
			);
			return { success: true, message: `User "${username}" created successfully.` };
		} catch (err: any) {
			return fail(400, { error: err.message || 'Failed to create user', username, name, email });
		}
	},

	toggleAccess: async ({ request, locals, platform }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			throw error(403, 'Unauthorized');
		}

		const data = await request.formData();
		const targetUserId = data.get('userId') as string;
		const isActive = data.get('isActive') === '1';

		if (!targetUserId) {
			return fail(400, { error: 'User ID is required' });
		}

		const { DB } = getBindings(platform);
		try {
			await toggleUserAccess(DB, targetUserId, isActive, locals.user);
			return { success: true, message: `User access ${isActive ? 'enabled' : 'disabled'}.` };
		} catch (err: any) {
			return fail(400, { error: err.message || 'Failed to update access' });
		}
	},

	changeRole: async ({ request, locals, platform }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			throw error(403, 'Unauthorized');
		}

		const data = await request.formData();
		const targetUserId = data.get('userId') as string;
		const newRole = data.get('role') as 'admin' | 'user';

		if (!targetUserId || !newRole) {
			return fail(400, { error: 'User ID and role are required' });
		}

		const { DB } = getBindings(platform);
		try {
			await updateUserRole(DB, targetUserId, newRole, locals.user);
			return { success: true, message: `User role changed to ${newRole}.` };
		} catch (err: any) {
			return fail(400, { error: err.message || 'Failed to update role' });
		}
	},

	deleteUser: async ({ request, locals, platform }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			throw error(403, 'Unauthorized');
		}

		const data = await request.formData();
		const targetUserId = data.get('userId') as string;

		if (!targetUserId) {
			return fail(400, { error: 'User ID is required' });
		}

		const { DB } = getBindings(platform);
		try {
			await deleteUserAccount(DB, targetUserId, locals.user);
			return { success: true, message: 'User account and associated data deleted.' };
		} catch (err: any) {
			return fail(400, { error: err.message || 'Failed to delete user' });
		}
	},

	revokeSession: async ({ request, locals, platform }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			throw error(403, 'Unauthorized');
		}

		const data = await request.formData();
		const sessionId = data.get('sessionId') as string;

		if (!sessionId) {
			return fail(400, { error: 'Session ID is required' });
		}

		const { DB } = getBindings(platform);
		try {
			await revokeSessionById(DB, sessionId, locals.user);
			return { success: true, message: 'Session revoked.' };
		} catch (err: any) {
			return fail(400, { error: err.message || 'Failed to revoke session' });
		}
	},

	updateStreamCookie: async ({ request, locals, platform }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			throw error(403, 'Unauthorized');
		}

		const data = await request.formData();
		const cookie = (data.get('cookie') as string)?.trim();

		if (!cookie) {
			return fail(400, { error: 'Cookie content is required' });
		}

		const { DB } = getBindings(platform);
		try {
			await setSystemSetting(DB, 'youtube_cookie', cookie, locals.user);
			return { success: true, message: 'YouTube streaming cookie saved. Pure audio stream extraction is active!' };
		} catch (err: any) {
			return fail(400, { error: err.message || 'Failed to save streaming cookie' });
		}
	},

	clearStreamCookie: async ({ locals, platform }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			throw error(403, 'Unauthorized');
		}

		const { DB } = getBindings(platform);
		try {
			await setSystemSetting(DB, 'youtube_cookie', '', locals.user);
			return { success: true, message: 'Streaming cookie cleared.' };
		} catch (err: any) {
			return fail(400, { error: err.message || 'Failed to clear cookie' });
		}
	}
};


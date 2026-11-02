import { fail, redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import {
	hasAnyUsers,
	createUser,
	authenticateUser,
	createSession,
	SESSION_COOKIE_NAME,
	SESSION_MAX_AGE_SECONDS
} from '#lib/server/auth/session';
import { getBindings } from '#lib/server/cf';

export const load: ServerLoad = async ({ platform }) => {
	const { DB } = getBindings(platform);
	const hasUsers = await hasAnyUsers(DB);
	return {
		isSetupMode: !hasUsers
	};
};

export const actions: Actions = {
	login: async ({ request, cookies, platform, url }) => {
		const data = await request.formData();
		const username = (data.get('username') as string)?.trim();
		const password = data.get('password') as string;
		const redirectTo = (data.get('redirectTo') as string) || url.searchParams.get('redirectTo') || '/';

		if (!username || !password) {
			return fail(400, {
				error: 'Username and password are required',
				username
			});
		}

		const { DB } = getBindings(platform);
		const user = await authenticateUser(DB, username, password);

		if (!user) {
			return fail(401, {
				error: 'Invalid username or password',
				username
			});
		}

		const session = await createSession(DB, user.id, request);
		cookies.set(SESSION_COOKIE_NAME, session.id, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: SESSION_MAX_AGE_SECONDS
		});

		const safeRedirect = redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/';
		throw redirect(303, safeRedirect);
	},

	setup: async ({ request, cookies, platform }) => {
		const { DB } = getBindings(platform);
		const hasUsers = await hasAnyUsers(DB);

		if (hasUsers) {
			return fail(403, {
				error: 'Registration is closed. Please sign in.'
			});
		}

		const data = await request.formData();
		const username = (data.get('username') as string)?.trim();
		const password = data.get('password') as string;
		const confirmPassword = data.get('confirmPassword') as string;
		const name = (data.get('name') as string)?.trim();
		const email = (data.get('email') as string)?.trim();

		if (!username || !password) {
			return fail(400, { error: 'Username and password are required' });
		}

		if (password !== confirmPassword) {
			return fail(400, { error: 'Passwords do not match', username, name, email });
		}

		if (password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters long', username, name, email });
		}

		try {
			const user = await createUser(DB, username, password, email, name, 'admin');
			const session = await createSession(DB, user.id, request);

			cookies.set(SESSION_COOKIE_NAME, session.id, {
				path: '/',
				httpOnly: true,
				secure: true,
				sameSite: 'lax',
				maxAge: SESSION_MAX_AGE_SECONDS
			});
		} catch (err: any) {
			return fail(400, {
				error: err.message || 'Failed to create user',
				username,
				name,
				email
			});
		}

		throw redirect(303, '/');
	}
};


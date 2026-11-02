import { redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import { destroySession, SESSION_COOKIE_NAME } from '#lib/server/auth/session';
import { getBindings } from '#lib/server/cf';

export const load: ServerLoad = async ({ cookies, platform, locals }) => {
	const token = cookies.get(SESSION_COOKIE_NAME);
	if (token) {
		const { DB } = getBindings(platform);
		await destroySession(DB, token);
		cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
	}
	locals.user = null;
	locals.session = null;
	throw redirect(303, '/login');
};

export const actions: Actions = {
	default: async ({ cookies, platform, locals }) => {
		const token = cookies.get(SESSION_COOKIE_NAME);
		if (token) {
			const { DB } = getBindings(platform);
			await destroySession(DB, token);
			cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
		}
		locals.user = null;
		locals.session = null;
		throw redirect(303, '/login');
	}
};


import type { LayoutServerLoad } from './$types';
import { getBindings } from '#lib/server/cf';
import { getSystemSetting } from '#lib/server/admin';

export const load: LayoutServerLoad = async ({ locals, platform }) => {
	let hasCustomCookie = false;
	try {
		const { DB, YOUTUBE_COOKIE } = getBindings(platform);
		if (YOUTUBE_COOKIE) {
			hasCustomCookie = true;
		} else if (locals.user) {
			const dbCookie = await getSystemSetting(DB, 'youtube_cookie');
			hasCustomCookie = !!dbCookie;
		}
	} catch {}

	return {
		user: locals.user,
		hasCustomCookie
	};
};

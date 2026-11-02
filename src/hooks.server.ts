import { redirect, error } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { validateSession, destroySession, SESSION_COOKIE_NAME } from '#lib/server/auth/session';
import { getBindings } from '#lib/server/cf';

// Public routes that unauthenticated visitors are allowed to access
const PUBLIC_PATHS = [
	'/login',
	'/favicon.svg',
	'/manifest.json',
	'/robots.txt'
];

function isPublicRoute(pathname: string): boolean {
	if (PUBLIC_PATHS.includes(pathname)) return true;
	if (pathname.startsWith('/_app/')) return true;
	return false;
}

export const handle: Handle = async ({ event, resolve }) => {
	const { DB } = getBindings(event.platform);
	const sessionToken = event.cookies.get(SESSION_COOKIE_NAME);

	// 1. Session resolution
	if (sessionToken) {
		const result = await validateSession(DB, sessionToken);
		if (result) {
			event.locals.user = result.user;
			event.locals.session = result.session;
		} else {
			// Expired or invalid token — clean up cookie
			event.cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
			event.locals.user = null;
			event.locals.session = null;
		}
	} else {
		event.locals.user = null;
		event.locals.session = null;
	}

	const { pathname, search } = event.url;
	const isPublic = isPublicRoute(pathname);

	// 2. Logged-in user visiting /login -> redirect to home
	if (event.locals.user && pathname === '/login') {
		const redirectTo = event.url.searchParams.get('redirectTo') || '/';
		const safeRedirect = redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/';
		throw redirect(303, safeRedirect);
	}

	// 3. Unauthenticated access check on protected routes
	if (!event.locals.user && !isPublic) {
		// API requests receive 401 JSON error
		if (pathname.startsWith('/api/')) {
			throw error(401, 'Unauthorized');
		}

		// Web page requests are redirected to /login with target preserved
		const target = pathname + (search || '');
		throw redirect(303, `/login?redirectTo=${encodeURIComponent(target)}`);
	}

	// 4. Resolve the request
	const response = await resolve(event);

	// 5. Inject defense-in-depth security headers
	// Media stream proxy is excluded from nosniff so browser media decoders can handle MP4/WebM containers freely
	if (!pathname.startsWith('/api/stream/audio/')) {
		response.headers.set('X-Content-Type-Options', 'nosniff');
	}
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	response.headers.set(
		'Content-Security-Policy',
		"default-src 'self'; img-src 'self' https://i.ytimg.com https://yt3.googleusercontent.com https://*.ggpht.com https://*.google.com data:; media-src 'self' blob: data:; connect-src 'self' https://www.youtube.com https://*.googlevideo.com https://*.doubleclick.net; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; child-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://www.youtube.com https://s.ytimg.com; frame-ancestors 'none';"
	);

	return response;
};

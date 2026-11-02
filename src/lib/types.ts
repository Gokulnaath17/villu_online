export interface SongTrack {
	videoId: string;
	title: string;
	artist: string;
	thumbnail: string;
	duration: number; // in seconds
	album?: string;
}

export interface StreamData {
	videoId: string;
	url: string;
	itag?: number;
	codec?: string;
	bitrate?: number;
	expiresAt?: number; // epoch ms
	fromCache?: boolean;
}

export interface Playlist {
	id: string;
	userId: string;
	name: string;
	description?: string;
	coverUrl?: string;
	isPublic?: boolean;
	createdAt: number;
	updatedAt: number;
	tracksCount?: number;
	tracks?: SongTrack[];
}

export type LoopMode = 'off' | 'all' | 'one';

export interface UserSession {
	id: string;
	username: string;
	email?: string;
	name?: string;
	role?: string;
	isActive?: boolean;
}

export interface Session {
	id: string;
	userId: string;
	expiresAt: number;
	createdAt: number;
	userAgent?: string;
}

export interface AuditLog {
	id: number;
	userId?: string;
	username?: string;
	action: string;
	details?: string;
	ipHash?: string;
	createdAt: number;
}

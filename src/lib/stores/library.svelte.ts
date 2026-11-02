import type { Playlist, SongTrack } from '#lib/types';

class LibraryStore {
	private _likedIds = $state<Set<string>>(new Set());
	private _likedTracks = $state<SongTrack[]>([]);
	private _playlists = $state<Playlist[]>([]);
	private _history = $state<SongTrack[]>([]);
	private _isLoading = $state<boolean>(false);

	public get likedIds(): Set<string> {
		return this._likedIds;
	}
	public get likedTracks(): SongTrack[] {
		return this._likedTracks;
	}
	public get playlists(): Playlist[] {
		return this._playlists;
	}
	public get history(): SongTrack[] {
		return this._history;
	}
	public get isLoading(): boolean {
		return this._isLoading;
	}

	public isLiked(videoId: string): boolean {
		return this._likedIds.has(videoId);
	}

	public async loadAll() {
		this._isLoading = true;
		try {
			await Promise.all([this.loadLikes(), this.loadPlaylists(), this.loadHistory()]);
		} finally {
			this._isLoading = false;
		}
	}

	public async loadLikes() {
		try {
			const [idsRes, tracksRes] = await Promise.all([
				fetch('/api/library?idsOnly=true'),
				fetch('/api/library')
			]);
			if (idsRes.ok) {
				const ids = (await idsRes.json()) as string[];
				this._likedIds = new Set(ids);
			}
			if (tracksRes.ok) {
				this._likedTracks = (await tracksRes.json()) as SongTrack[];
			}
		} catch (err) {
			console.warn('Load likes error:', err);
		}
	}

	public async toggleLike(track: SongTrack): Promise<boolean> {
		const nextSet = new Set(this._likedIds);
		const currentlyLiked = nextSet.has(track.videoId);

		// Optimistic update
		if (currentlyLiked) {
			nextSet.delete(track.videoId);
			this._likedTracks = this._likedTracks.filter((t) => t.videoId !== track.videoId);
		} else {
			nextSet.add(track.videoId);
			this._likedTracks = [track, ...this._likedTracks];
		}
		this._likedIds = nextSet;

		try {
			const res = await fetch('/api/library', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ track })
			});
			if (res.ok) {
				const data = (await res.json()) as any;
				if (data.isLiked) {
					this._likedIds.add(track.videoId);
				} else {
					this._likedIds.delete(track.videoId);
				}
				return data.isLiked;
			}
		} catch (err) {
			console.warn('Toggle like error:', err);
		}
		return !currentlyLiked;
	}

	public async loadPlaylists() {
		try {
			const res = await fetch('/api/playlists');
			if (res.ok) {
				this._playlists = (await res.json()) as Playlist[];
			}
		} catch (err) {
			console.warn('Load playlists error:', err);
		}
	}

	public async createPlaylist(name: string, description?: string): Promise<Playlist | null> {
		try {
			const res = await fetch('/api/playlists', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, description })
			});
			if (res.ok) {
				const pl = (await res.json()) as Playlist;
				this._playlists = [pl, ...this._playlists];
				return pl;
			}
		} catch (err) {
			console.error('Create playlist error:', err);
		}
		return null;
	}

	public async addTrackToPlaylist(playlistId: string, track: SongTrack) {
		try {
			const res = await fetch(`/api/playlists/${playlistId}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ track })
			});
			if (res.ok) {
				await this.loadPlaylists();
			}
		} catch (err) {
			console.error('Add track error:', err);
		}
	}

	public async removeTrackFromPlaylist(playlistId: string, videoId: string) {
		try {
			const res = await fetch(`/api/playlists/${playlistId}?videoId=${videoId}`, {
				method: 'DELETE'
			});
			if (res.ok) {
				await this.loadPlaylists();
			}
		} catch (err) {
			console.error('Remove track error:', err);
		}
	}

	public async loadHistory() {
		try {
			const res = await fetch('/api/library/history');
			if (res.ok) {
				this._history = (await res.json()) as SongTrack[];
			}
		} catch (err) {
			console.warn('Load history error:', err);
		}
	}
}

export const libraryStore = new LibraryStore();

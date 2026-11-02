import type { SongTrack } from '#lib/types';

export class MediaSessionManager {
	private onPlayCallback: () => void = () => {};
	private onPauseCallback: () => void = () => {};
	private onNextCallback: () => void = () => {};
	private onPreviousCallback: () => void = () => {};
	private onSeekCallback: (pos: number) => void = () => {};
	private onSeekForwardCallback: (offset: number) => void = () => {};
	private onSeekBackwardCallback: (offset: number) => void = () => {};

	constructor(callbacks: {
		onPlay: () => void;
		onPause: () => void;
		onNext: () => void;
		onPrevious: () => void;
		onSeek: (pos: number) => void;
		onSeekForward?: (offset: number) => void;
		onSeekBackward?: (offset: number) => void;
	}) {
		this.onPlayCallback = callbacks.onPlay;
		this.onPauseCallback = callbacks.onPause;
		this.onNextCallback = callbacks.onNext;
		this.onPreviousCallback = callbacks.onPrevious;
		this.onSeekCallback = callbacks.onSeek;
		this.onSeekForwardCallback = callbacks.onSeekForward || ((off) => this.onSeekCallback(off));
		this.onSeekBackwardCallback = callbacks.onSeekBackward || ((off) => this.onSeekCallback(-off));

		this.initHandlers();
	}

	private initHandlers() {
		if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

		navigator.mediaSession.setActionHandler('play', () => this.onPlayCallback());
		navigator.mediaSession.setActionHandler('pause', () => this.onPauseCallback());
		navigator.mediaSession.setActionHandler('stop', () => this.onPauseCallback());
		navigator.mediaSession.setActionHandler('previoustrack', () => this.onPreviousCallback());
		navigator.mediaSession.setActionHandler('nexttrack', () => this.onNextCallback());
		navigator.mediaSession.setActionHandler('seekto', (details) => {
			if (typeof details.seekTime === 'number') {
				this.onSeekCallback(details.seekTime);
			}
		});
		navigator.mediaSession.setActionHandler('seekforward', (details) => {
			const offset = details.seekOffset || 10;
			this.onSeekForwardCallback(offset);
		});
		navigator.mediaSession.setActionHandler('seekbackward', (details) => {
			const offset = details.seekOffset || 10;
			this.onSeekBackwardCallback(offset);
		});
	}

	public updateMetadata(track: SongTrack) {
		if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

		navigator.mediaSession.metadata = new MediaMetadata({
			title: track.title,
			artist: track.artist,
			album: track.album || 'Villu Online',
			artwork: [
				{ src: track.thumbnail, sizes: '96x96', type: 'image/jpeg' },
				{ src: track.thumbnail, sizes: '128x128', type: 'image/jpeg' },
				{ src: track.thumbnail, sizes: '192x192', type: 'image/jpeg' },
				{ src: track.thumbnail, sizes: '256x256', type: 'image/jpeg' },
				{ src: track.thumbnail, sizes: '512x512', type: 'image/jpeg' }
			]
		});
	}

	public updatePlaybackState(isPlaying: boolean) {
		if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
		navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
	}

	public updatePositionState(duration: number, position: number) {
		if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
		if (duration > 0 && position >= 0 && position <= duration) {
			try {
				navigator.mediaSession.setPositionState({
					duration,
					playbackRate: 1.0,
					position
				});
			} catch (e) {
				// Ignore if browser restricts high frequency position sync
			}
		}
	}
}

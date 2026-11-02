import type { SongTrack, LoopMode } from '#lib/types';

class QueueStore {
	private _tracks = $state<SongTrack[]>([]);
	private _currentIndex = $state<number>(0);
	private _loopMode = $state<LoopMode>('off');
	private _isShuffle = $state<boolean>(false);
	private _shuffledIndices = $state<number[]>([]);

	public get tracks(): SongTrack[] {
		return this._tracks;
	}

	public get currentIndex(): number {
		return this._currentIndex;
	}

	public get loopMode(): LoopMode {
		return this._loopMode;
	}

	public get isShuffle(): boolean {
		return this._isShuffle;
	}

	public get currentTrack(): SongTrack | null {
		if (this._tracks.length === 0 || this._currentIndex < 0 || this._currentIndex >= this._tracks.length) {
			return null;
		}
		return this._tracks[this._currentIndex];
	}

	public get nextTrack(): SongTrack | null {
		if (this._tracks.length === 0) return null;
		if (this._loopMode === 'one') return this.currentTrack;

		const nextIdx = this.peekNextIndex();
		if (nextIdx !== null && nextIdx >= 0 && nextIdx < this._tracks.length) {
			return this._tracks[nextIdx];
		}
		return null;
	}

	public setTracks(newTracks: SongTrack[], startIndex: number = 0) {
		this._tracks = [...newTracks];
		this._currentIndex = Math.max(0, Math.min(startIndex, newTracks.length - 1));
		this.generateShuffleIndices();
	}

	public setIndex(index: number) {
		if (index >= 0 && index < this._tracks.length) {
			this._currentIndex = index;
		}
	}

	public insertNext(track: SongTrack) {
		if (this._tracks.length === 0) {
			this.setTracks([track], 0);
			return;
		}
		const insertPos = this._currentIndex + 1;
		this._tracks.splice(insertPos, 0, track);
		this.generateShuffleIndices();
	}

	public addToQueue(track: SongTrack) {
		if (this._tracks.length === 0) {
			this.setTracks([track], 0);
			return;
		}
		this._tracks.push(track);
		this.generateShuffleIndices();
	}

	public addBatch(tracks: SongTrack[]) {
		if (this._tracks.length === 0) {
			this.setTracks(tracks, 0);
			return;
		}
		this._tracks.push(...tracks);
		this.generateShuffleIndices();
	}

	public removeAt(index: number) {
		if (index < 0 || index >= this._tracks.length) return;
		this._tracks.splice(index, 1);
		if (this._currentIndex > index) {
			this._currentIndex--;
		} else if (this._currentIndex >= this._tracks.length) {
			this._currentIndex = Math.max(0, this._tracks.length - 1);
		}
		this.generateShuffleIndices();
	}

	public clearUpcoming() {
		if (this._tracks.length <= 1) return;
		const current = this.currentTrack;
		if (current) {
			this._tracks = [current];
			this._currentIndex = 0;
			this.generateShuffleIndices();
		}
	}

	/**
	 * Reorder Queue preserving active index pointer (as detailed in MECHANISM.md §6.1)
	 */
	public reorder(oldIndex: number, targetIndex: number) {
		if (oldIndex < 0 || oldIndex >= this._tracks.length) return;
		if (targetIndex < 0 || targetIndex >= this._tracks.length) return;
		if (oldIndex === targetIndex) return;

		const [moved] = this._tracks.splice(oldIndex, 1);
		this._tracks.splice(targetIndex, 0, moved);

		// Pointer preservation algorithm
		if (this._currentIndex === oldIndex) {
			this._currentIndex = targetIndex;
		} else if (oldIndex < this._currentIndex && targetIndex >= this._currentIndex) {
			this._currentIndex--;
		} else if (oldIndex > this._currentIndex && targetIndex <= this._currentIndex) {
			this._currentIndex++;
		}
		this.generateShuffleIndices();
	}

	public toggleShuffle() {
		this._isShuffle = !this._isShuffle;
		if (this._isShuffle) {
			this.generateShuffleIndices();
		}
	}

	public cycleLoopMode(): LoopMode {
		if (this._loopMode === 'off') {
			this._loopMode = 'all';
		} else if (this._loopMode === 'all') {
			this._loopMode = 'one';
		} else {
			this._loopMode = 'off';
		}
		return this._loopMode;
	}

	public peekNextIndex(): number | null {
		if (this._tracks.length === 0) return null;

		if (this._isShuffle) {
			const posInShuffled = this._shuffledIndices.indexOf(this._currentIndex);
			if (posInShuffled >= 0 && posInShuffled + 1 < this._shuffledIndices.length) {
				return this._shuffledIndices[posInShuffled + 1];
			}
			return this._loopMode === 'all' ? this._shuffledIndices[0] : null;
		}

		if (this._currentIndex + 1 < this._tracks.length) {
			return this._currentIndex + 1;
		}

		return this._loopMode === 'all' ? 0 : null;
	}

	public peekPrevIndex(): number | null {
		if (this._tracks.length === 0) return null;

		if (this._isShuffle) {
			const posInShuffled = this._shuffledIndices.indexOf(this._currentIndex);
			if (posInShuffled > 0) {
				return this._shuffledIndices[posInShuffled - 1];
			}
			return this._loopMode === 'all'
				? this._shuffledIndices[this._shuffledIndices.length - 1]
				: null;
		}

		if (this._currentIndex > 0) {
			return this._currentIndex - 1;
		}

		return this._loopMode === 'all' ? this._tracks.length - 1 : null;
	}

	private generateShuffleIndices() {
		const len = this._tracks.length;
		const indices = Array.from({ length: len }, (_, i) => i);
		for (let i = indices.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[indices[i], indices[j]] = [indices[j], indices[i]];
		}
		this._shuffledIndices = indices;
	}
}

export const queueStore = new QueueStore();

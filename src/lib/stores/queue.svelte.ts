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

	public get shuffledIndices(): number[] {
		return this._shuffledIndices;
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
		this._currentIndex = Math.max(0, Math.min(startIndex, Math.max(0, newTracks.length - 1)));
		this.generateShuffleIndices(this._currentIndex);
	}

	public setIndex(index: number) {
		if (index >= 0 && index < this._tracks.length) {
			this._currentIndex = index;
		}
	}

	public setShuffle(enabled: boolean) {
		if (this._isShuffle === enabled) return;
		this._isShuffle = enabled;
		if (this._isShuffle) {
			this.generateShuffleIndices(this._currentIndex);
		}
	}

	public toggleShuffle() {
		this.setShuffle(!this._isShuffle);
	}

	public setLoopMode(mode: LoopMode) {
		this._loopMode = mode;
	}

	public setShuffledIndices(indices: number[]) {
		if (Array.isArray(indices) && indices.length === this._tracks.length) {
			this._shuffledIndices = [...indices];
		}
	}

	public insertNext(track: SongTrack) {
		if (this._tracks.length === 0) {
			this.setTracks([track], 0);
			return;
		}
		const insertPos = this._currentIndex + 1;
		this._tracks.splice(insertPos, 0, track);

		if (this._isShuffle) {
			// In shuffle mode:
			// Shift all existing indices >= insertPos by +1
			const updated = this._shuffledIndices.map((idx) => (idx >= insertPos ? idx + 1 : idx));
			// Insert the new track right after the currently playing track in shuffle order
			const currentPos = updated.indexOf(this._currentIndex);
			if (currentPos >= 0) {
				updated.splice(currentPos + 1, 0, insertPos);
			} else {
				updated.push(insertPos);
			}
			this._shuffledIndices = updated;
		} else {
			this.generateShuffleIndices(this._currentIndex);
		}
	}

	public addToQueue(track: SongTrack) {
		if (this._tracks.length === 0) {
			this.setTracks([track], 0);
			return;
		}
		this._tracks.push(track);
		const newIdx = this._tracks.length - 1;
		if (this._isShuffle) {
			if (this._shuffledIndices.length === 0) {
				this.generateShuffleIndices(this._currentIndex);
			} else {
				this._shuffledIndices.push(newIdx);
			}
		}
	}

	public addBatch(tracks: SongTrack[]) {
		if (this._tracks.length === 0) {
			this.setTracks(tracks, 0);
			return;
		}
		const startIdx = this._tracks.length;
		this._tracks.push(...tracks);
		if (this._isShuffle) {
			if (this._shuffledIndices.length === 0) {
				this.generateShuffleIndices(this._currentIndex);
			} else {
				const newIndices = Array.from({ length: tracks.length }, (_, i) => startIdx + i);
				for (let i = newIndices.length - 1; i > 0; i--) {
					const j = Math.floor(Math.random() * (i + 1));
					[newIndices[i], newIndices[j]] = [newIndices[j], newIndices[i]];
				}
				this._shuffledIndices.push(...newIndices);
			}
		}
	}

	public removeAt(index: number) {
		if (index < 0 || index >= this._tracks.length) return;
		this._tracks.splice(index, 1);
		if (this._currentIndex > index) {
			this._currentIndex--;
		} else if (this._currentIndex >= this._tracks.length) {
			this._currentIndex = Math.max(0, this._tracks.length - 1);
		}

		if (this._isShuffle) {
			const pos = this._shuffledIndices.indexOf(index);
			if (pos !== -1) {
				this._shuffledIndices.splice(pos, 1);
			}
			this._shuffledIndices = this._shuffledIndices.map((idx) => (idx > index ? idx - 1 : idx));
		}
	}

	public clearUpcoming() {
		if (this._tracks.length <= 1) return;
		const current = this.currentTrack;
		if (current) {
			this._tracks = [current];
			this._currentIndex = 0;
			this._shuffledIndices = [0];
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

		if (this._isShuffle) {
			this._shuffledIndices = this._shuffledIndices.map((idx) => {
				if (idx === oldIndex) return targetIndex;
				if (oldIndex < targetIndex && idx > oldIndex && idx <= targetIndex) return idx - 1;
				if (oldIndex > targetIndex && idx >= targetIndex && idx < oldIndex) return idx + 1;
				return idx;
			});
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
			if (this._shuffledIndices.length !== this._tracks.length) {
				this.generateShuffleIndices(this._currentIndex);
			}
			let posInShuffled = this._shuffledIndices.indexOf(this._currentIndex);
			if (posInShuffled === -1) {
				this.generateShuffleIndices(this._currentIndex);
				posInShuffled = this._shuffledIndices.indexOf(this._currentIndex);
			}
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
			if (this._shuffledIndices.length !== this._tracks.length) {
				this.generateShuffleIndices(this._currentIndex);
			}
			let posInShuffled = this._shuffledIndices.indexOf(this._currentIndex);
			if (posInShuffled === -1) {
				this.generateShuffleIndices(this._currentIndex);
				posInShuffled = this._shuffledIndices.indexOf(this._currentIndex);
			}
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

	private generateShuffleIndices(startingIndex?: number) {
		const len = this._tracks.length;
		if (len === 0) {
			this._shuffledIndices = [];
			return;
		}
		if (len === 1) {
			this._shuffledIndices = [0];
			return;
		}

		const current =
			startingIndex !== undefined
				? Math.max(0, Math.min(startingIndex, len - 1))
				: Math.max(0, Math.min(this._currentIndex, len - 1));

		const others: number[] = [];
		for (let i = 0; i < len; i++) {
			if (i !== current) {
				others.push(i);
			}
		}

		// Unbiased Fisher-Yates shuffle
		for (let i = others.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[others[i], others[j]] = [others[j], others[i]];
		}

		this._shuffledIndices = [current, ...others];
	}
}

export const queueStore = new QueueStore();

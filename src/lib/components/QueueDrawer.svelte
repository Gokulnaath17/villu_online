<script lang="ts">
	import { queueStore } from '#lib/stores/queue.svelte';
	import { playerStore } from '#lib/stores/player.svelte';
	import { formatTime } from '#lib/utils';
	import { X, Trash2, ArrowUp, ArrowDown, Music, Play } from '@lucide/svelte';

	let tracks = $derived(queueStore.tracks);
	let currentIndex = $derived(queueStore.currentIndex);

	function handleMove(from: number, to: number) {
		queueStore.reorder(from, to);
	}

	function handleRemove(index: number) {
		queueStore.removeAt(index);
	}

	function handleClearUpcoming() {
		queueStore.clearUpcoming();
	}
</script>

{#if playerStore.isQueueOpen}
	<div
		class="fixed inset-y-0 right-0 z-40 w-full sm:w-96 bg-zinc-950/95 backdrop-blur-xl border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
	>
		<!-- Header -->
		<div class="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
			<div>
				<h3 class="text-base font-bold text-white flex items-center gap-2">
					<Music class="w-4 h-4 text-sky-400" />
					Playback Queue
				</h3>
				<p class="text-xs text-zinc-400 mt-0.5">
					{tracks.length} {tracks.length === 1 ? 'song' : 'songs'} in queue
				</p>
			</div>

			<div class="flex items-center gap-1">
				{#if tracks.length > 1}
					<button
						type="button"
						class="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-rose-400 transition-colors"
						onclick={handleClearUpcoming}
						title="Clear upcoming tracks"
					>
						<Trash2 class="w-4 h-4" />
					</button>
				{/if}
				<button
					type="button"
					class="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
					onclick={() => playerStore.setQueueOpen(false)}
					title="Close queue"
				>
					<X class="w-5 h-5" />
				</button>
			</div>
		</div>

		<!-- Tracks List -->
		<div class="flex-1 overflow-y-auto p-3 space-y-1.5">
			{#if tracks.length === 0}
				<div class="h-64 flex flex-col items-center justify-center text-center p-6 text-zinc-500">
					<Music class="w-10 h-10 mb-2 stroke-1" />
					<p class="text-sm font-medium">Your queue is empty</p>
					<p class="text-xs text-zinc-600 mt-1">Play any track or add songs to queue</p>
				</div>
			{:else}
				{#each tracks as track, idx (track.videoId + '-' + idx)}
					{@const isPlaying = idx === currentIndex}
					<div
						class="group relative flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-150 {isPlaying ? 'bg-sky-500/10 border border-sky-500/20' : 'hover:bg-white/5'}"
					>
						<!-- Thumbnail -->
						<div
							class="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-zinc-800 cursor-pointer"
							onclick={() => playerStore.playIndex(idx)}
							role="button"
							tabindex="0"
							onkeydown={(e) => e.key === 'Enter' && playerStore.playIndex(idx)}
						>
							<img src={track.thumbnail} alt={track.title} class="w-full h-full object-cover" />
							{#if isPlaying}
								<div class="absolute inset-0 bg-black/40 flex items-center justify-center">
									<span class="w-2 h-2 rounded-full bg-sky-400 animate-ping"></span>
								</div>
							{:else}
								<div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
									<Play class="w-4 h-4 text-white fill-white translate-x-0.5" />
								</div>
							{/if}
						</div>

						<!-- Details -->
						<div
							class="flex-1 min-w-0 cursor-pointer"
							onclick={() => playerStore.playIndex(idx)}
							role="button"
							tabindex="0"
							onkeydown={(e) => e.key === 'Enter' && playerStore.playIndex(idx)}
						>
							<h4 class="text-xs font-semibold truncate {isPlaying ? 'text-sky-400' : 'text-zinc-200 group-hover:text-white'}">
								{track.title}
							</h4>
							<p class="text-[11px] text-zinc-400 truncate mt-0.5">
								{track.artist}
							</p>
						</div>

						<!-- Duration -->
						<span class="text-[11px] font-mono text-zinc-500 shrink-0">
							{formatTime(track.duration)}
						</span>

						<!-- Reorder / Remove Controls -->
						<div class="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-0.5 shrink-0">
							{#if idx > 0}
								<button
									type="button"
									class="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white"
									onclick={() => handleMove(idx, idx - 1)}
									title="Move up"
								>
									<ArrowUp class="w-3.5 h-3.5" />
								</button>
							{/if}
							{#if idx < tracks.length - 1}
								<button
									type="button"
									class="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white"
									onclick={() => handleMove(idx, idx + 1)}
									title="Move down"
								>
									<ArrowDown class="w-3.5 h-3.5" />
								</button>
							{/if}
							<button
								type="button"
								class="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-rose-400"
								onclick={() => handleRemove(idx)}
								title="Remove"
							>
								<X class="w-3.5 h-3.5" />
							</button>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</div>
{/if}

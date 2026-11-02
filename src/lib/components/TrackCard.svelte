<script lang="ts">
	import type { SongTrack } from '#lib/types';
	import { playerStore } from '#lib/stores/player.svelte';
	import { queueStore } from '#lib/stores/queue.svelte';
	import { libraryStore } from '#lib/stores/library.svelte';
	import { formatTime } from '#lib/utils';
	import { Play, Pause, Heart, MoreVertical, Plus, ListPlus, Radio } from '@lucide/svelte';

	interface Props {
		track: SongTrack;
		index?: number;
		queueContext?: SongTrack[];
		showIndex?: boolean;
	}

	let { track, index, queueContext, showIndex = true }: Props = $props();

	let isMenuOpen = $state(false);
	let isPlaylistSelectOpen = $state(false);

	let isCurrent = $derived(playerStore.currentTrack?.videoId === track.videoId);
	let isPlaying = $derived(isCurrent && playerStore.isPlaying);
	let isLiked = $derived(libraryStore.isLiked(track.videoId));

	function handlePlay() {
		if (isCurrent) {
			playerStore.togglePlay();
		} else {
			playerStore.playTrack(track, queueContext, index);
		}
	}

	function handleToggleLike(e: MouseEvent) {
		e.stopPropagation();
		libraryStore.toggleLike(track);
	}

	function handleAddToQueue(e: MouseEvent) {
		e.stopPropagation();
		queueStore.addToQueue(track);
		isMenuOpen = false;
	}

	function handlePlayNext(e: MouseEvent) {
		e.stopPropagation();
		queueStore.insertNext(track);
		isMenuOpen = false;
	}

	function handleAddToPlaylist(playlistId: string, e: MouseEvent) {
		e.stopPropagation();
		libraryStore.addTrackToPlaylist(playlistId, track);
		isPlaylistSelectOpen = false;
		isMenuOpen = false;
	}
</script>

<div
	class="group relative flex items-center gap-3.5 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer select-none hover:bg-white/[0.06] {isCurrent ? 'bg-white/[0.08]' : ''}"
	onclick={handlePlay}
	role="button"
	tabindex="0"
	onkeydown={(e) => e.key === 'Enter' && handlePlay()}
>
	<!-- Index / Play indicator -->
	{#if showIndex && index !== undefined}
		<div class="w-6 text-center text-xs font-medium text-zinc-500 group-hover:hidden">
			{#if isPlaying}
				<span class="inline-block w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse"></span>
			{:else}
				{index + 1}
			{/if}
		</div>
	{/if}

	<!-- Thumbnail with overlay -->
	<div class="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-zinc-800 shadow-md">
		<img
			src={track.thumbnail}
			alt={track.title}
			class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
			loading="lazy"
		/>
		<div
			class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
		>
			{#if isPlaying}
				<Pause class="w-5 h-5 text-white fill-white" />
			{:else}
				<Play class="w-5 h-5 text-white fill-white translate-x-0.5" />
			{/if}
		</div>
	</div>

	<!-- Title & Artist -->
	<div class="flex-1 min-w-0 pr-2">
		<h4 class="text-sm font-semibold truncate transition-colors {isCurrent ? 'text-sky-400' : 'text-zinc-100 group-hover:text-white'}">
			{track.title}
		</h4>
		<p class="text-xs text-zinc-400 truncate mt-0.5">
			{track.artist}
		</p>
	</div>

	<!-- Duration -->
	<div class="text-xs text-zinc-400 font-mono tracking-tight shrink-0 hidden sm:block">
		{formatTime(track.duration)}
	</div>

	<!-- Like Button -->
	<button
		type="button"
		class="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors shrink-0"
		onclick={handleToggleLike}
		title={isLiked ? 'Unlike' : 'Like'}
	>
		<Heart class="w-4 h-4 {isLiked ? 'text-rose-500 fill-rose-500' : ''}" />
	</button>

	<!-- More Options Menu -->
	<div class="relative shrink-0">
		<button
			type="button"
			class="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
			onclick={(e) => {
				e.stopPropagation();
				isMenuOpen = !isMenuOpen;
				isPlaylistSelectOpen = false;
			}}
			title="More options"
		>
			<MoreVertical class="w-4 h-4" />
		</button>

		{#if isMenuOpen}
			<!-- Menu dropdown -->
			<div
				class="absolute right-0 top-full mt-1 w-48 rounded-xl bg-zinc-900 border border-white/10 shadow-2xl py-1.5 z-40 text-xs text-zinc-200"
				onclick={(e) => e.stopPropagation()}
				role="menu"
				tabindex="0"
			>
				<button
					class="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 transition-colors text-left"
					onclick={handlePlayNext}
				>
					<Radio class="w-3.5 h-3.5 text-zinc-400" />
					Play Next
				</button>
				<button
					class="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 transition-colors text-left"
					onclick={handleAddToQueue}
				>
					<ListPlus class="w-3.5 h-3.5 text-zinc-400" />
					Add to Queue
				</button>
				<button
					class="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 transition-colors text-left"
					onclick={(e) => {
						e.stopPropagation();
						isPlaylistSelectOpen = !isPlaylistSelectOpen;
					}}
				>
					<Plus class="w-3.5 h-3.5 text-zinc-400" />
					Add to Playlist...
				</button>

				{#if isPlaylistSelectOpen}
					<div class="mt-1 border-t border-white/10 pt-1 px-1">
						{#if libraryStore.playlists.length === 0}
							<div class="px-2 py-1 text-[11px] text-zinc-500 italic">No playlists yet</div>
						{:else}
							{#each libraryStore.playlists as pl}
								<button
									class="w-full flex items-center px-2 py-1.5 rounded hover:bg-white/10 text-left text-zinc-300 truncate"
									onclick={(e) => handleAddToPlaylist(pl.id, e)}
								>
									{pl.name}
								</button>
							{/each}
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

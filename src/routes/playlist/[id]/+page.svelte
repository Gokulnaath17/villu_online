<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { playerStore } from '#lib/stores/player.svelte';
	import { libraryStore } from '#lib/stores/library.svelte';
	import TrackCard from '#lib/components/TrackCard.svelte';
	import type { Playlist, SongTrack } from '#lib/types';
	import { Play, Shuffle, Trash2, Disc3, Loader2, Music } from '@lucide/svelte';

	let playlist = $state<Playlist | null>(null);
	let isLoading = $state(true);
	let playlistId = $derived(page.params.id);

	async function loadPlaylist() {
		isLoading = true;
		try {
			const res = await fetch(`/api/playlists/${playlistId}`);
			if (res.ok) {
				playlist = await res.json();
			}
		} catch (err) {
			console.error('Failed to load playlist:', err);
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		loadPlaylist();
	});

	function playAll() {
		if (playlist && playlist.tracks && playlist.tracks.length > 0) {
			playerStore.playTrack(playlist.tracks[0], playlist.tracks, 0);
		}
	}

	async function removeTrack(videoId: string) {
		if (!playlist) return;
		await libraryStore.removeTrackFromPlaylist(playlist.id, videoId);
		await loadPlaylist();
	}
</script>

{#if isLoading}
	<div class="h-64 flex flex-col items-center justify-center text-zinc-500 gap-3">
		<Loader2 class="w-8 h-8 animate-spin text-sky-400" />
		<p class="text-xs font-medium tracking-wide">Loading playlist...</p>
	</div>
{:else if playlist}
	<div class="space-y-8 animate-in fade-in duration-200">
		<!-- Playlist Header -->
		<div class="flex flex-col sm:flex-row items-center sm:items-end gap-6 p-6 rounded-3xl bg-gradient-to-t from-zinc-900 to-zinc-900/40 border border-white/5 shadow-xl">
			<div class="w-36 h-36 sm:w-44 sm:h-44 rounded-2xl bg-zinc-800 flex items-center justify-center overflow-hidden shadow-2xl shrink-0 ring-1 ring-white/10">
				{#if playlist.coverUrl}
					<img src={playlist.coverUrl} alt={playlist.name} class="w-full h-full object-cover" />
				{:else}
					<Disc3 class="w-20 h-20 text-zinc-600" />
				{/if}
			</div>

			<div class="space-y-3 text-center sm:text-left flex-1 min-w-0">
				<span class="text-xs font-bold uppercase tracking-wider text-sky-400">Playlist</span>
				<h2 class="text-2xl sm:text-4xl font-extrabold text-white truncate">
					{playlist.name}
				</h2>
				{#if playlist.description}
					<p class="text-xs sm:text-sm text-zinc-400 max-w-xl">{playlist.description}</p>
				{/if}
				<div class="text-xs text-zinc-500 font-medium">
					<span>{playlist.tracks?.length || 0} songs</span>
				</div>
			</div>
		</div>

		<!-- Action Buttons -->
		<div class="flex items-center gap-3">
			<button
				type="button"
				class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs sm:text-sm transition-all shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
				onclick={playAll}
				disabled={!playlist.tracks || playlist.tracks.length === 0}
			>
				<Play class="w-4 h-4 fill-white" />
				Play All
			</button>
		</div>

		<!-- Tracks List -->
		{#if !playlist.tracks || playlist.tracks.length === 0}
			<div class="h-48 flex flex-col items-center justify-center text-center text-zinc-500">
				<Music class="w-10 h-10 mb-2 stroke-1" />
				<p class="text-sm font-medium">This playlist is empty</p>
				<p class="text-xs text-zinc-600 mt-1">Search for tracks and add them using the track options menu</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
				{#each playlist.tracks as track, idx}
					<div class="relative group">
						<TrackCard {track} index={idx} queueContext={playlist.tracks} showIndex={true} />
						<button
							type="button"
							class="absolute right-12 top-1/2 -translate-y-1/2 p-2 rounded-full text-zinc-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
							onclick={() => removeTrack(track.videoId)}
							title="Remove from playlist"
						>
							<Trash2 class="w-3.5 h-3.5" />
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{:else}
	<div class="h-64 flex flex-col items-center justify-center text-center text-zinc-500">
		<p class="text-sm font-medium">Playlist not found</p>
	</div>
{/if}

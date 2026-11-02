<script lang="ts">
	import { onMount } from 'svelte';
	import { libraryStore } from '#lib/stores/library.svelte';
	import { playerStore } from '#lib/stores/player.svelte';
	import TrackCard from '#lib/components/TrackCard.svelte';
	import { Heart, ListMusic, History, Play, Plus, Shuffle, Disc3 } from '@lucide/svelte';

	let activeTab = $state<'liked' | 'playlists' | 'history'>('liked');
	let isCreatingPlaylist = $state(false);
	let newPlaylistName = $state('');

	let likedTracks = $derived(libraryStore.likedTracks);
	let playlists = $derived(libraryStore.playlists);
	let history = $derived(libraryStore.history);

	onMount(() => {
		libraryStore.loadAll();
	});

	function playAllLiked() {
		if (likedTracks.length > 0) {
			playerStore.playTrack(likedTracks[0], likedTracks, 0);
		}
	}

	async function handleCreatePlaylist(e: SubmitEvent) {
		e.preventDefault();
		if (!newPlaylistName.trim()) return;
		await libraryStore.createPlaylist(newPlaylistName.trim());
		newPlaylistName = '';
		isCreatingPlaylist = false;
	}
</script>

<div class="space-y-8 animate-in fade-in duration-200">
	<!-- Library Header & Tabs -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
		<div>
			<h2 class="text-2xl sm:text-3xl font-extrabold text-white">Your Library</h2>
			<p class="text-xs sm:text-sm text-zinc-400 mt-1">Saved collections and listening activity</p>
		</div>

		<!-- Segmented Tab Control -->
		<div class="inline-flex rounded-xl bg-zinc-900 p-1 border border-white/5">
			<button
				type="button"
				class="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all {activeTab === 'liked' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
				onclick={() => (activeTab = 'liked')}
			>
				<Heart class="w-3.5 h-3.5 {activeTab === 'liked' ? 'text-rose-500 fill-rose-500' : ''}" />
				Liked ({likedTracks.length})
			</button>
			<button
				type="button"
				class="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all {activeTab === 'playlists' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
				onclick={() => (activeTab = 'playlists')}
			>
				<ListMusic class="w-3.5 h-3.5" />
				Playlists ({playlists.length})
			</button>
			<button
				type="button"
				class="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all {activeTab === 'history' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
				onclick={() => (activeTab = 'history')}
			>
				<History class="w-3.5 h-3.5" />
				History
			</button>
		</div>
	</div>

	<!-- Tab 1: Liked Songs -->
	{#if activeTab === 'liked'}
		<div class="space-y-6">
			<!-- Header Card -->
			<div class="flex items-center gap-6 p-6 rounded-2xl bg-gradient-to-r from-rose-950/40 via-zinc-900 to-zinc-900/60 border border-white/5">
				<div class="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-xl shadow-rose-950/50 shrink-0">
					<Heart class="w-10 h-10 text-white fill-white" />
				</div>
				<div class="space-y-2">
					<h3 class="text-xl sm:text-2xl font-bold text-white">Liked Songs</h3>
					<p class="text-xs sm:text-sm text-zinc-400">{likedTracks.length} tracks favorited</p>
					{#if likedTracks.length > 0}
						<button
							type="button"
							class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-rose-500 hover:bg-rose-400 text-white font-semibold text-xs transition-colors shadow-lg"
							onclick={playAllLiked}
						>
							<Play class="w-3.5 h-3.5 fill-white" />
							Play All
						</button>
					{/if}
				</div>
			</div>

			<!-- Track List -->
			{#if likedTracks.length === 0}
				<div class="h-48 flex flex-col items-center justify-center text-center text-zinc-500">
					<Heart class="w-8 h-8 mb-2 stroke-1 text-zinc-600" />
					<p class="text-sm font-medium">No liked songs yet</p>
					<p class="text-xs text-zinc-600 mt-1">Click the heart icon on any track to add it here</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
					{#each likedTracks as track, idx}
						<TrackCard {track} index={idx} queueContext={likedTracks} showIndex={true} />
					{/each}
				</div>
			{/if}
		</div>

	<!-- Tab 2: Playlists -->
	{:else if activeTab === 'playlists'}
		<div class="space-y-6">
			<div class="flex items-center justify-between">
				<h3 class="text-base font-bold text-white">Your Playlists</h3>
				<button
					type="button"
					class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs transition-colors"
					onclick={() => (isCreatingPlaylist = !isCreatingPlaylist)}
				>
					<Plus class="w-3.5 h-3.5" />
					Create Playlist
				</button>
			</div>

			{#if isCreatingPlaylist}
				<form onsubmit={handleCreatePlaylist} class="p-4 rounded-xl bg-zinc-900 border border-white/10 max-w-md space-y-3">
					<h4 class="text-sm font-semibold text-white">New Playlist</h4>
					<input
						type="text"
						bind:value={newPlaylistName}
						placeholder="Give your playlist a name..."
						class="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
					/>
					<div class="flex justify-end gap-2">
						<button
							type="button"
							class="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
							onclick={() => (isCreatingPlaylist = false)}
						>
							Cancel
						</button>
						<button
							type="submit"
							class="px-3 py-1.5 text-xs font-semibold bg-sky-500 text-white rounded-lg hover:bg-sky-400"
						>
							Create
						</button>
					</div>
				</form>
			{/if}

			{#if playlists.length === 0}
				<div class="h-48 flex flex-col items-center justify-center text-center text-zinc-500">
					<ListMusic class="w-8 h-8 mb-2 stroke-1 text-zinc-600" />
					<p class="text-sm font-medium">No playlists created</p>
					<p class="text-xs text-zinc-600 mt-1">Create your first custom playlist above</p>
				</div>
			{:else}
				<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
					{#each playlists as pl}
						<a
							href="/playlist/{pl.id}"
							class="group p-4 rounded-2xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-white/5 transition-all duration-200 block text-left"
						>
							<div class="w-full aspect-square rounded-xl bg-zinc-800 flex items-center justify-center mb-3 overflow-hidden shadow-md group-hover:scale-[1.02] transition-transform">
								{#if pl.coverUrl}
									<img src={pl.coverUrl} alt={pl.name} class="w-full h-full object-cover" />
								{:else}
									<Disc3 class="w-12 h-12 text-zinc-600 group-hover:text-sky-400 transition-colors" />
								{/if}
							</div>
							<h4 class="text-sm font-semibold text-white truncate">{pl.name}</h4>
							<p class="text-xs text-zinc-500 mt-0.5">{pl.tracksCount || 0} tracks</p>
						</a>
					{/each}
				</div>
			{/if}
		</div>

	<!-- Tab 3: History -->
	{:else if activeTab === 'history'}
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<h3 class="text-base font-bold text-white">Listening History</h3>
				{#if history.length > 0}
					<button
						type="button"
						class="text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1.5"
						onclick={() => playerStore.playTrack(history[0], history, 0)}
					>
						<Play class="w-3.5 h-3.5 fill-current" />
						Play History
					</button>
				{/if}
			</div>

			{#if history.length === 0}
				<div class="h-48 flex flex-col items-center justify-center text-center text-zinc-500">
					<History class="w-8 h-8 mb-2 stroke-1 text-zinc-600" />
					<p class="text-sm font-medium">No listening history recorded</p>
					<p class="text-xs text-zinc-600 mt-1">Tracks you stream will automatically appear here</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
					{#each history as track, idx}
						<TrackCard {track} index={idx} queueContext={history} showIndex={true} />
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

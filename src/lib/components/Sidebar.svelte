<script lang="ts">
	import { page } from '$app/state';
	import { libraryStore } from '#lib/stores/library.svelte';
	import { Home, Search, Library, Heart, Plus, Radio, Disc3, LogOut, Shield } from '@lucide/svelte';

	let isCreatingPlaylist = $state(false);
	let newPlaylistName = $state('');
	let user = $derived(page.data.user);

	async function handleCreatePlaylist(e: SubmitEvent) {
		e.preventDefault();
		if (!newPlaylistName.trim()) return;
		await libraryStore.createPlaylist(newPlaylistName.trim());
		newPlaylistName = '';
		isCreatingPlaylist = false;
	}
</script>

<aside aria-label="Sidebar Navigation" class="w-64 bg-zinc-950/80 border-r border-white/5 flex flex-col h-full shrink-0 select-none hidden md:flex">
	<!-- Brand Header -->
	<div class="p-6 pb-4 flex items-center gap-3">
		<div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-sky-500/20">
			<Disc3 class="w-5 h-5 text-white animate-spin [animation-duration:10s]" />
		</div>
		<div>
			<h1 class="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
				Villu <span class="text-sky-400">Online</span>
			</h1>
			<p class="text-[11px] text-zinc-500 font-medium">Personal Music Cloud</p>
		</div>
	</div>

	<!-- Main Navigation Links -->
	<nav class="px-3 py-2 space-y-1">
		<a
			href="/"
			class="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors {page.url.pathname === '/' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'}"
		>
			<Home class="w-4 h-4 {page.url.pathname === '/' ? 'text-sky-400' : ''}" />
			Home
		</a>
		<a
			href="/search"
			class="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors {page.url.pathname.startsWith('/search') ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'}"
		>
			<Search class="w-4 h-4 {page.url.pathname.startsWith('/search') ? 'text-sky-400' : ''}" />
			Search
		</a>
		<a
			href="/library"
			class="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors {page.url.pathname.startsWith('/library') ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'}"
		>
			<Library class="w-4 h-4 {page.url.pathname.startsWith('/library') ? 'text-sky-400' : ''}" />
			Your Library
		</a>
		{#if user?.role === 'admin'}
			<a
				href="/admin"
				class="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors {page.url.pathname.startsWith('/admin') ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30' : 'text-zinc-400 hover:text-white hover:bg-white/5'}"
			>
				<Shield class="w-4 h-4 {page.url.pathname.startsWith('/admin') ? 'text-sky-400' : ''}" />
				Admin Center
			</a>
		{/if}
	</nav>

	<!-- Quick Liked Songs Button -->
	<div class="px-3 pt-2">
		<a
			href="/library"
			class="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/5 transition-colors group"
		>
			<div class="w-6 h-6 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shrink-0 shadow-sm">
				<Heart class="w-3.5 h-3.5 text-white fill-white" />
			</div>
			<span class="truncate">Liked Songs</span>
			{#if libraryStore.likedIds.size > 0}
				<span class="ml-auto text-xs text-zinc-500 font-mono">{libraryStore.likedIds.size}</span>
			{/if}
		</a>
	</div>

	<!-- Playlists Header -->
	<div class="px-6 pt-6 pb-2 flex items-center justify-between">
		<span class="text-xs uppercase tracking-wider font-semibold text-zinc-500">Playlists</span>
		<button
			type="button"
			class="p-1 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
			onclick={() => (isCreatingPlaylist = !isCreatingPlaylist)}
			title="Create Playlist"
		>
			<Plus class="w-4 h-4" />
		</button>
	</div>

	<!-- Inline Create Playlist Form -->
	{#if isCreatingPlaylist}
		<form onsubmit={handleCreatePlaylist} class="px-4 py-2">
			<input
				type="text"
				bind:value={newPlaylistName}
				placeholder="Playlist name..."
				class="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500"
			/>
			<div class="flex justify-end gap-1.5 mt-2">
				<button
					type="button"
					class="px-2.5 py-1 text-xs text-zinc-400 hover:text-white"
					onclick={() => (isCreatingPlaylist = false)}
				>
					Cancel
				</button>
				<button
					type="submit"
					class="px-2.5 py-1 text-xs font-semibold bg-sky-500 text-white rounded-md hover:bg-sky-400"
				>
					Save
				</button>
			</div>
		</form>
	{/if}

	<!-- Playlists Scroll List -->
	<div class="flex-1 overflow-y-auto px-3 py-1 space-y-0.5 min-h-0">
		{#if libraryStore.playlists.length === 0}
			<p class="px-3.5 py-3 text-xs text-zinc-500 italic">No custom playlists</p>
		{:else}
			{#each libraryStore.playlists as pl}
				<a
					href="/playlist/{pl.id}"
					class="flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors truncate {page.url.pathname === `/playlist/${pl.id}` ? 'bg-white/10 text-white' : ''}"
				>
					<span class="truncate">{pl.name}</span>
					{#if pl.tracksCount !== undefined && pl.tracksCount > 0}
						<span class="text-[10px] text-zinc-600 font-mono ml-2">{pl.tracksCount}</span>
					{/if}
				</a>
			{/each}
		{/if}
	</div>

	<!-- Bottom User & System Pill -->
	<div class="p-4 border-t border-white/5 space-y-3 shrink-0">
		{#if user}
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2.5 min-w-0">
					<div class="w-7 h-7 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center font-bold text-xs uppercase shrink-0">
						{(user.name || user.username || 'U').slice(0, 1)}
					</div>
					<div class="min-w-0">
						<p class="text-xs font-semibold text-zinc-200 truncate">{user.name || user.username}</p>
						<p class="text-[10px] text-zinc-500 truncate">@{user.username}</p>
					</div>
				</div>
				<a
					href="/logout"
					class="p-2 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
					title="Sign out"
				>
					<LogOut class="w-4 h-4" />
				</a>
			</div>
		{/if}
		<div class="flex items-center justify-between text-xs text-zinc-500 pt-1">
			<div class="flex items-center gap-2">
				<span class="w-2 h-2 rounded-full bg-emerald-500"></span>
				<span>Connected to Edge</span>
			</div>
			<span class="font-mono text-[10px] text-zinc-600">v0.1</span>
		</div>
	</div>
</aside>

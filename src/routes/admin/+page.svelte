<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import {
		Shield,
		Users,
		FileText,
		Radio,
		Plus,
		Trash2,
		CheckCircle2,
		XCircle,
		AlertCircle,
		Laptop,
		Music,
		UserCheck,
		UserX,
		KeyRound
	} from '@lucide/svelte';

	let { data, form }: PageProps = $props();

	let activeTab = $state<'users' | 'logs' | 'sessions' | 'history'>('users');
	let isCreateModalOpen = $state(false);

	function formatDate(epochSec: number): string {
		if (!epochSec) return 'Never';
		return new Date(epochSec * 1000).toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatTimeAgo(epochSec: number): string {
		if (!epochSec) return 'Never';
		const diff = Math.floor(Date.now() / 1000 - epochSec);
		if (diff < 60) return `${diff}s ago`;
		if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
		if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
		return `${Math.floor(diff / 86400)}d ago`;
	}
</script>

<svelte:head>
	<title>Admin Dashboard — Villu Online</title>
</svelte:head>

<div class="space-y-8 animate-in fade-in duration-200">
	<!-- Admin Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
		<div class="flex items-center gap-3.5">
			<div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 text-white shrink-0">
				<Shield class="w-6 h-6" />
			</div>
			<div>
				<h1 class="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2">
					Admin Center
					<span class="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-400 font-semibold border border-sky-500/30">
						Superadmin
					</span>
				</h1>
				<p class="text-xs sm:text-sm text-zinc-400 mt-0.5">
					User access management, security auditing, and system monitoring
				</p>
			</div>
		</div>

		<div class="flex items-center gap-2">
			{#if activeTab === 'users'}
				<button
					type="button"
					class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs transition-colors shadow-lg hover:shadow-sky-500/25 active:scale-95 cursor-pointer"
					onclick={() => (isCreateModalOpen = true)}
				>
					<Plus class="w-4 h-4" />
					Add User
				</button>
			{/if}
		</div>
	</div>

	<!-- Alert Messages -->
	{#if form?.error}
		<div class="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
			<AlertCircle class="w-4 h-4 shrink-0 text-rose-400" />
			<span>{form.error}</span>
		</div>
	{/if}
	{#if form?.success && form?.message}
		<div class="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-3">
			<CheckCircle2 class="w-4 h-4 shrink-0 text-emerald-400" />
			<span>{form.message}</span>
		</div>
	{/if}

	<!-- Navigation Tabs -->
	<div class="inline-flex rounded-xl bg-zinc-900 p-1 border border-white/5 flex-wrap gap-1">
		<button
			type="button"
			class="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer {activeTab === 'users' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
			onclick={() => (activeTab = 'users')}
		>
			<Users class="w-3.5 h-3.5" />
			Users ({data.users.length})
		</button>
		<button
			type="button"
			class="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer {activeTab === 'logs' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
			onclick={() => (activeTab = 'logs')}
		>
			<FileText class="w-3.5 h-3.5" />
			Audit Logs ({data.auditLogs.length})
		</button>
		<button
			type="button"
			class="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer {activeTab === 'sessions' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
			onclick={() => (activeTab = 'sessions')}
		>
			<Laptop class="w-3.5 h-3.5" />
			Active Sessions ({data.activeSessions.length})
		</button>
		<button
			type="button"
			class="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer {activeTab === 'history' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
			onclick={() => (activeTab = 'history')}
		>
			<Music class="w-3.5 h-3.5" />
			Playback Stream Logs
		</button>
	</div>

	<!-- TAB 1: USERS -->
	{#if activeTab === 'users'}
		<div class="rounded-2xl border border-white/5 bg-zinc-950/60 overflow-hidden shadow-xl">
			<div class="overflow-x-auto">
				<table class="w-full text-left text-xs">
					<thead class="bg-white/[0.02] border-b border-white/5 text-zinc-400 uppercase tracking-wider text-[10px]">
						<tr>
							<th class="px-5 py-3 font-semibold">User</th>
							<th class="px-5 py-3 font-semibold">Role</th>
							<th class="px-5 py-3 font-semibold">Status</th>
							<th class="px-5 py-3 font-semibold">Active Sessions</th>
							<th class="px-5 py-3 font-semibold">Created</th>
							<th class="px-5 py-3 font-semibold text-right">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-white/5 text-zinc-300">
						{#each data.users as u}
							<tr class="hover:bg-white/[0.02] transition-colors">
								<td class="px-5 py-4">
									<div class="flex items-center gap-3">
										<div class="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500/20 to-indigo-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center font-bold text-xs uppercase shrink-0">
											{(u.name || u.username || 'U').slice(0, 1)}
										</div>
										<div>
											<p class="font-semibold text-white">{u.name || u.username}</p>
											<p class="text-[11px] text-zinc-500">@{u.username} • {u.email || 'No email'}</p>
										</div>
									</div>
								</td>
								<td class="px-5 py-4">
									<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold {u.role === 'admin' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-zinc-800 text-zinc-400'}">
										{u.role}
									</span>
								</td>
								<td class="px-5 py-4">
									{#if u.isActive}
										<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
											<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
											Active
										</span>
									{:else}
										<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
											<span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
											Disabled
										</span>
									{/if}
								</td>
								<td class="px-5 py-4 font-mono text-[11px] text-zinc-400">
									{u.sessionCount} active
								</td>
								<td class="px-5 py-4 text-zinc-500 text-[11px]">
									{formatDate(u.createdAt)}
								</td>
								<td class="px-5 py-4 text-right">
									<div class="flex items-center justify-end gap-2">
										{#if u.id !== data.currentUserId}
											<!-- Toggle Access Form -->
											<form method="POST" action="?/toggleAccess" use:enhance>
												<input type="hidden" name="userId" value={u.id} />
												<input type="hidden" name="isActive" value={u.isActive ? '0' : '1'} />
												<button
													type="submit"
													class="p-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer {u.isActive ? 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10' : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'}"
													title={u.isActive ? 'Disable User Access' : 'Enable User Access'}
												>
													{#if u.isActive}
														<UserX class="w-3.5 h-3.5" />
													{:else}
														<UserCheck class="w-3.5 h-3.5" />
													{/if}
												</button>
											</form>

											<!-- Change Role Form -->
											<form method="POST" action="?/changeRole" use:enhance>
												<input type="hidden" name="userId" value={u.id} />
												<input type="hidden" name="role" value={u.role === 'admin' ? 'user' : 'admin'} />
												<button
													type="submit"
													class="px-2 py-1 rounded-lg border border-white/10 text-[11px] text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
													title="Toggle Admin Role"
												>
													{u.role === 'admin' ? 'Make User' : 'Make Admin'}
												</button>
											</form>

											<!-- Delete User Form -->
											<form method="POST" action="?/deleteUser" use:enhance onsubmit={(e) => !confirm(`Delete user @${u.username}? This removes all their library data permanently.`) && e.preventDefault()}>
												<input type="hidden" name="userId" value={u.id} />
												<button
													type="submit"
													class="p-1.5 rounded-lg border border-white/10 text-zinc-500 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 transition-colors cursor-pointer"
													title="Delete User Account"
												>
													<Trash2 class="w-3.5 h-3.5" />
												</button>
											</form>
										{:else}
											<span class="text-[10px] text-zinc-500 italic px-2">You (Current Admin)</span>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<!-- TAB 2: AUDIT LOGS -->
	{#if activeTab === 'logs'}
		<div class="rounded-2xl border border-white/5 bg-zinc-950/60 overflow-hidden shadow-xl">
			<div class="p-4 border-b border-white/5 flex items-center justify-between">
				<h3 class="text-sm font-semibold text-white flex items-center gap-2">
					<FileText class="w-4 h-4 text-sky-400" />
					Security & System Audit Log
				</h3>
				<span class="text-xs text-zinc-500">Last 50 events</span>
			</div>
			{#if data.auditLogs.length === 0}
				<div class="p-8 text-center text-zinc-500 text-xs">
					No audit logs recorded yet.
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead class="bg-white/[0.02] border-b border-white/5 text-zinc-400 uppercase tracking-wider text-[10px]">
							<tr>
								<th class="px-5 py-3 font-semibold">Timestamp</th>
								<th class="px-5 py-3 font-semibold">Action</th>
								<th class="px-5 py-3 font-semibold">Initiated By</th>
								<th class="px-5 py-3 font-semibold">Details</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-white/5 text-zinc-300 font-mono text-[11px]">
							{#each data.auditLogs as log}
								<tr class="hover:bg-white/[0.02] transition-colors">
									<td class="px-5 py-3 text-zinc-500 whitespace-nowrap">
										{formatDate(log.createdAt)}
									</td>
									<td class="px-5 py-3">
										<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold {log.action.includes('DISABLE') || log.action.includes('DELETE') ? 'bg-rose-500/20 text-rose-300' : log.action.includes('CREATE') || log.action.includes('ENABLE') ? 'bg-emerald-500/20 text-emerald-300' : 'bg-sky-500/20 text-sky-300'}">
											{log.action}
										</span>
									</td>
									<td class="px-5 py-3 text-zinc-300">
										{log.username || log.userId || 'System'}
									</td>
									<td class="px-5 py-3 text-zinc-400 font-sans text-xs">
										{log.details || '—'}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}

	<!-- TAB 3: ACTIVE SESSIONS -->
	{#if activeTab === 'sessions'}
		<div class="rounded-2xl border border-white/5 bg-zinc-950/60 overflow-hidden shadow-xl">
			<div class="p-4 border-b border-white/5 flex items-center justify-between">
				<h3 class="text-sm font-semibold text-white flex items-center gap-2">
					<Laptop class="w-4 h-4 text-sky-400" />
					Active Device Sessions
				</h3>
				<span class="text-xs text-zinc-500">Live sessions in D1</span>
			</div>
			{#if data.activeSessions.length === 0}
				<div class="p-8 text-center text-zinc-500 text-xs">
					No active sessions found.
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead class="bg-white/[0.02] border-b border-white/5 text-zinc-400 uppercase tracking-wider text-[10px]">
							<tr>
								<th class="px-5 py-3 font-semibold">User</th>
								<th class="px-5 py-3 font-semibold">Client / Device</th>
								<th class="px-5 py-3 font-semibold">Logged In</th>
								<th class="px-5 py-3 font-semibold">Expires</th>
								<th class="px-5 py-3 font-semibold text-right">Action</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-white/5 text-zinc-300">
							{#each data.activeSessions as s}
								<tr class="hover:bg-white/[0.02] transition-colors">
									<td class="px-5 py-3.5">
										<div class="flex items-center gap-2">
											<span class="font-semibold text-white">@{s.username}</span>
											{#if s.isCurrent}
												<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">
													Current
												</span>
											{/if}
										</div>
									</td>
									<td class="px-5 py-3.5 text-zinc-400 text-xs max-w-xs truncate" title={s.userAgent || 'Unknown'}>
										{s.userAgent || 'Unknown Device'}
									</td>
									<td class="px-5 py-3.5 text-zinc-500 text-[11px] whitespace-nowrap">
										{formatTimeAgo(s.createdAt)}
									</td>
									<td class="px-5 py-3.5 text-zinc-500 text-[11px] whitespace-nowrap">
										{formatDate(s.expiresAt)}
									</td>
									<td class="px-5 py-3.5 text-right">
										{#if !s.isCurrent}
											<form method="POST" action="?/revokeSession" use:enhance>
												<input type="hidden" name="sessionId" value={s.id} />
												<button
													type="submit"
													class="px-2.5 py-1 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs transition-colors cursor-pointer"
												>
													Revoke
												</button>
											</form>
										{:else}
											<span class="text-[10px] text-zinc-500 italic">This Device</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}

	<!-- TAB 4: LISTENING LOGS -->
	{#if activeTab === 'history'}
		<div class="rounded-2xl border border-white/5 bg-zinc-950/60 overflow-hidden shadow-xl">
			<div class="p-4 border-b border-white/5 flex items-center justify-between">
				<h3 class="text-sm font-semibold text-white flex items-center gap-2">
					<Radio class="w-4 h-4 text-sky-400" />
					Global Stream Activity Feed
				</h3>
				<span class="text-xs text-zinc-500">Recent stream events</span>
			</div>
			{#if data.listeningLogs.length === 0}
				<div class="p-8 text-center text-zinc-500 text-xs">
					No recent playback events recorded in D1 history.
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead class="bg-white/[0.02] border-b border-white/5 text-zinc-400 uppercase tracking-wider text-[10px]">
							<tr>
								<th class="px-5 py-3 font-semibold">Track</th>
								<th class="px-5 py-3 font-semibold">Listener</th>
								<th class="px-5 py-3 font-semibold">Played At</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-white/5 text-zinc-300">
							{#each data.listeningLogs as item}
								<tr class="hover:bg-white/[0.02] transition-colors">
									<td class="px-5 py-3">
										<div class="flex items-center gap-3">
											{#if item.thumbnail}
												<img src={item.thumbnail} alt="" class="w-9 h-9 rounded-lg object-cover bg-zinc-800" />
											{/if}
											<div class="min-w-0">
												<p class="font-semibold text-white truncate max-w-sm">{item.title}</p>
												<p class="text-[11px] text-zinc-500 truncate">{item.artist || 'Unknown'}</p>
											</div>
										</div>
									</td>
									<td class="px-5 py-3 text-sky-400 font-semibold">
										@{item.username}
									</td>
									<td class="px-5 py-3 text-zinc-500 text-[11px] whitespace-nowrap">
										{formatDate(item.playedAt)} ({formatTimeAgo(item.playedAt)})
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- CREATE USER MODAL -->
{#if isCreateModalOpen}
	<div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
		<div class="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
			<div class="flex items-center justify-between border-b border-white/5 pb-4">
				<h3 class="text-lg font-bold text-white flex items-center gap-2">
					<KeyRound class="w-5 h-5 text-sky-400" />
					Create User Account
				</h3>
				<button
					type="button"
					class="p-1 rounded-lg text-zinc-400 hover:text-white"
					onclick={() => (isCreateModalOpen = false)}
				>
					<XCircle class="w-5 h-5" />
				</button>
			</div>

			<form method="POST" action="?/createUser" use:enhance={() => {
				return async ({ result, update }) => {
					await update();
					if (result.type === 'success') {
						isCreateModalOpen = false;
					}
				};
			}} class="space-y-4 text-xs">
				<div class="space-y-1.5">
					<label for="username" class="block font-semibold text-zinc-300">Username *</label>
					<input
						type="text"
						id="username"
						name="username"
						required
						placeholder="e.g. gokul_friend"
						class="w-full bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500"
					/>
				</div>

				<div class="space-y-1.5">
					<label for="name" class="block font-semibold text-zinc-300">Display Name</label>
					<input
						type="text"
						id="name"
						name="name"
						placeholder="e.g. Alex"
						class="w-full bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500"
					/>
				</div>

				<div class="space-y-1.5">
					<label for="email" class="block font-semibold text-zinc-300">Email (Optional)</label>
					<input
						type="email"
						id="email"
						name="email"
						placeholder="user@example.com"
						class="w-full bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500"
					/>
				</div>

				<div class="space-y-1.5">
					<label for="password" class="block font-semibold text-zinc-300">Password (min. 8 characters) *</label>
					<input
						type="password"
						id="password"
						name="password"
						required
						minlength="8"
						placeholder="••••••••"
						class="w-full bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500"
					/>
				</div>

				<div class="grid grid-cols-2 gap-3 pt-2">
					<div class="space-y-1.5">
						<label for="role" class="block font-semibold text-zinc-300">Role</label>
						<select
							id="role"
							name="role"
							class="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
						>
							<option value="user">Standard User</option>
							<option value="admin">Administrator</option>
						</select>
					</div>

					<div class="space-y-1.5">
						<label for="isActive" class="block font-semibold text-zinc-300">Initial Access</label>
						<select
							id="isActive"
							name="isActive"
							class="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
						>
							<option value="1">Enabled (Active)</option>
							<option value="0">Disabled (Hold)</option>
						</select>
					</div>
				</div>

				<div class="flex justify-end gap-2 pt-4 border-t border-white/5">
					<button
						type="button"
						class="px-4 py-2 rounded-xl text-zinc-400 hover:text-white transition-colors"
						onclick={() => (isCreateModalOpen = false)}
					>
						Cancel
					</button>
					<button
						type="submit"
						class="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold shadow-lg shadow-sky-500/20 transition-all cursor-pointer"
					>
						Create Account
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}


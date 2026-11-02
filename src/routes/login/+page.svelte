<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import type { ActionData, PageData } from './$types';
	import { Disc3, Lock, User, KeyRound, ShieldCheck, AlertCircle, ArrowRight, Loader2, Mail } from '@lucide/svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let isSubmitting = $state(false);
	let redirectTo = $derived(page.url.searchParams.get('redirectTo') || '/');
</script>

<svelte:head>
	<title>{data.isSetupMode ? 'Setup Admin Account' : 'Sign In'} — Villu Online</title>
</svelte:head>

<div class="min-h-screen w-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-[#09090b] text-zinc-100 font-sans relative overflow-hidden">
	<!-- Atmospheric glow backdrop -->
	<div class="absolute -top-40 -left-40 w-96 h-96 bg-sky-600/10 rounded-full blur-3xl pointer-events-none"></div>
	<div class="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

	<div class="w-full max-w-md space-y-8 relative z-10 animate-in fade-in zoom-in-95 duration-200">
		<!-- Brand Header -->
		<div class="text-center space-y-3">
			<div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 shadow-xl shadow-sky-500/20 mb-1">
				<Disc3 class="w-7 h-7 text-white animate-spin [animation-duration:12s]" />
			</div>
			<h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
				Villu <span class="text-sky-400">Online</span>
			</h1>
			<p class="text-xs sm:text-sm text-zinc-400">
				{data.isSetupMode
					? 'Welcome! Initialize your admin credentials to secure your personal cloud.'
					: 'Personal music streaming server. Please authenticate to continue.'}
			</p>
		</div>

		<!-- Card Container -->
		<div class="rounded-3xl bg-zinc-900/80 border border-white/10 p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
			{#if form?.error}
				<div class="flex items-start gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs animate-in fade-in">
					<AlertCircle class="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
					<span>{form.error}</span>
				</div>
			{/if}

			{#if data.isSetupMode}
				<!-- First-Run Bootstrap Setup Form -->
				<form
					method="POST"
					action="?/setup"
					use:enhance={() => {
						isSubmitting = true;
						return async ({ update }) => {
							isSubmitting = false;
							await update();
						};
					}}
					class="space-y-4"
				>
					<div class="space-y-1.5">
						<label for="setup-username" class="block text-xs font-semibold text-zinc-300">
							Admin Username
						</label>
						<div class="relative">
							<User class="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
							<input
								id="setup-username"
								type="text"
								name="username"
								required
								autocomplete="username"
								placeholder="e.g. gokul"
								value={form?.username || ''}
								class="w-full bg-zinc-950 border border-white/10 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
							/>
						</div>
					</div>

					<div class="space-y-1.5">
						<label for="setup-name" class="block text-xs font-semibold text-zinc-300">
							Display Name (Optional)
						</label>
						<div class="relative">
							<ShieldCheck class="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
							<input
								id="setup-name"
								type="text"
								name="name"
								placeholder="e.g. Gokul"
								value={form?.name || ''}
								class="w-full bg-zinc-950 border border-white/10 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
							/>
						</div>
					</div>

					<div class="space-y-1.5">
						<label for="setup-email" class="block text-xs font-semibold text-zinc-300">
							Email (Optional)
						</label>
						<div class="relative">
							<Mail class="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
							<input
								id="setup-email"
								type="email"
								name="email"
								placeholder="you@domain.com"
								value={form?.email || ''}
								class="w-full bg-zinc-950 border border-white/10 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
							/>
						</div>
					</div>

					<div class="space-y-1.5">
						<label for="setup-password" class="block text-xs font-semibold text-zinc-300">
							Master Password (min 8 chars)
						</label>
						<div class="relative">
							<Lock class="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
							<input
								id="setup-password"
								type="password"
								name="password"
								required
								autocomplete="new-password"
								placeholder="••••••••••••"
								class="w-full bg-zinc-950 border border-white/10 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
							/>
						</div>
					</div>

					<div class="space-y-1.5">
						<label for="setup-confirm-password" class="block text-xs font-semibold text-zinc-300">
							Confirm Password
						</label>
						<div class="relative">
							<KeyRound class="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
							<input
								id="setup-confirm-password"
								type="password"
								name="confirmPassword"
								required
								autocomplete="new-password"
								placeholder="••••••••••••"
								class="w-full bg-zinc-950 border border-white/10 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
							/>
						</div>
					</div>

					<button
						type="submit"
						disabled={isSubmitting}
						class="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs sm:text-sm transition-all shadow-lg shadow-sky-500/25 active:scale-[0.98] disabled:opacity-50"
					>
						{#if isSubmitting}
							<Loader2 class="w-4 h-4 animate-spin" />
							Securing credentials...
						{:else}
							<span>Create Admin & Initialize</span>
							<ArrowRight class="w-4 h-4" />
						{/if}
					</button>
				</form>
			{:else}
				<!-- Standard Login Form -->
				<form
					method="POST"
					action="?/login"
					use:enhance={() => {
						isSubmitting = true;
						return async ({ update }) => {
							isSubmitting = false;
							await update();
						};
					}}
					class="space-y-4"
				>
					<input type="hidden" name="redirectTo" value={redirectTo} />

					<div class="space-y-1.5">
						<label for="login-username" class="block text-xs font-semibold text-zinc-300">
							Username or Email
						</label>
						<div class="relative">
							<User class="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
							<input
								id="login-username"
								type="text"
								name="username"
								required
								autocomplete="username"
								placeholder="Enter your username"
								value={form?.username || ''}
								class="w-full bg-zinc-950 border border-white/10 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
							/>
						</div>
					</div>

					<div class="space-y-1.5">
						<label for="login-password" class="block text-xs font-semibold text-zinc-300">
							Password
						</label>
						<div class="relative">
							<Lock class="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
							<input
								id="login-password"
								type="password"
								name="password"
								required
								autocomplete="current-password"
								placeholder="Enter your password"
								class="w-full bg-zinc-950 border border-white/10 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
							/>
						</div>
					</div>

					<button
						type="submit"
						disabled={isSubmitting}
						class="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs sm:text-sm transition-all shadow-lg shadow-sky-500/25 active:scale-[0.98] disabled:opacity-50"
					>
						{#if isSubmitting}
							<Loader2 class="w-4 h-4 animate-spin" />
							Authenticating...
						{:else}
							<span>Sign In</span>
							<ArrowRight class="w-4 h-4" />
						{/if}
					</button>
				</form>
			{/if}
		</div>

		<!-- Footer Note -->
		<div class="text-center text-[11px] text-zinc-600">
			<span>Protected by Cloudflare Edge & PBKDF2 cryptography</span>
		</div>
	</div>
</div>


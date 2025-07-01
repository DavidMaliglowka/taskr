const esbuild = require("esbuild");
const path = require("path");
const postcss = require("esbuild-postcss");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

/**
 * @type {import('esbuild').Plugin}
 */
const aliasPlugin = {
	name: 'alias',
	setup(build) {
		// Handle @/ aliases for shadcn/ui
		build.onResolve({ filter: /^@\// }, args => {
			return {
				path: path.resolve(__dirname, 'src', args.path.slice(2))
			};
		});
	},
};

async function main() {
	// Build configuration for the VS Code extension
	const extensionCtx = await esbuild.context({
		entryPoints: ['src/extension.ts'],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outdir: 'dist',
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [
			esbuildProblemMatcherPlugin,
			aliasPlugin,
		],
	});

	// Build configuration for the React webview
	const webviewCtx = await esbuild.context({
		entryPoints: ['src/webview/index.tsx'],
		bundle: true,
		format: 'esm',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'browser',
		outdir: 'dist',
		logLevel: 'silent',
		plugins: [
			esbuildProblemMatcherPlugin,
			aliasPlugin,
			postcss()
		],
	});

	if (watch) {
		await Promise.all([
			extensionCtx.watch(),
			webviewCtx.watch()
		]);
	} else {
		await Promise.all([
			extensionCtx.rebuild(),
			webviewCtx.rebuild()
		]);
		await extensionCtx.dispose();
		await webviewCtx.dispose();
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});

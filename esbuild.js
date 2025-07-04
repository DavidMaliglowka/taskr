const esbuild = require("esbuild");
const path = require("path");

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
			const resolvedPath = path.resolve(__dirname, 'src', args.path.slice(2));
			
			// Try to resolve with common TypeScript extensions
			const fs = require('fs');
			const extensions = ['.tsx', '.ts', '.jsx', '.js'];
			
			// Check if it's a file first
			for (const ext of extensions) {
				const fullPath = resolvedPath + ext;
				if (fs.existsSync(fullPath)) {
					return { path: fullPath };
				}
			}
			
			// Check if it's a directory with index file
			for (const ext of extensions) {
				const indexPath = path.join(resolvedPath, 'index' + ext);
				if (fs.existsSync(indexPath)) {
					return { path: indexPath };
				}
			}
			
			// Fallback to original behavior
			return { path: resolvedPath };
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
		// Add production optimizations
		...(production && {
			drop: ['debugger'],
			pure: ['console.log', 'console.debug', 'console.trace'],
		}),
		plugins: [
			esbuildProblemMatcherPlugin,
			aliasPlugin,
		],
	});

	// Build configuration for the React webview
	const webviewCtx = await esbuild.context({
		entryPoints: ['src/webview/index.tsx'],
		bundle: true,
		format: 'iife',
		globalName: 'App',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'browser',
		outdir: 'dist',
		logLevel: 'silent',
		target: ['es2020'],
		jsx: 'automatic',
		jsxImportSource: 'react',
		external: ['*.css'],
		define: {
			'process.env.NODE_ENV': production ? '"production"' : '"development"',
			'global': 'globalThis'
		},
		// Add production optimizations for webview too
		...(production && {
			drop: ['debugger'],
			pure: ['console.log', 'console.debug', 'console.trace'],
		}),
		plugins: [
			esbuildProblemMatcherPlugin,
			aliasPlugin,
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
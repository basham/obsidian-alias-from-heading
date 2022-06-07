import { Plugin, TFile } from 'obsidian';

export default class AliasFromHeadingPlugin extends Plugin {
	async onload () {
		this.registerEvent(this.app.metadataCache.on('resolve', (file) => {
			this.updateAlias(file.path);
		}));
	}

	async updateAlias (path: string) {
		const cache = this.app.metadataCache.getCache(path);
		const { frontmatter = {}, headings } = cache;
		if (!Array.isArray(headings)) {
			return;
		}
		// This gets the first heading.
		// However, it could be configured to get the first heading with `{ level: 1 }`?
		const { heading } = headings[0];
		const { hash } = this.app.metadataCache.fileCache[path];
		const { alias = [] } = frontmatter
		const uniqueAlias = [...new Set([ heading, ...alias ])];
		const updatedCache = {
			...cache,
			frontmatter: {
				...frontmatter,
				alias: uniqueAlias
			}
		};
		this.app.metadataCache.metadataCache[hash] = updatedCache;

		console.log('Added alias from heading:', path, heading, cache);
		const filesToUpdate = Object.entries(this.app.metadataCache.resolvedLinks)
			.reduce((paths, [toPath, links]) => {
				console.log('##', paths, toPath, links);
				const hasRef = Object.keys(links).includes(path);
				return hasRef ? [...paths, toPath] : paths;
			}, [])
			.map((p:string) => [p, this.app.metadataCache.getCache(p)])
		console.log('NEED TO UPDATE', filesToUpdate)
	}

	async updateLinks (path: string) {
		console.log('##', this.app.metadataCache);
		return;
		const { vault } = this.app;
		const files:TFile[] = vault.getMarkdownFiles();
		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			const contents = await vault.read(file);

		}
		const fileContents: string[] = await Promise.all(
			vault.getMarkdownFiles().map((file) => vault.cachedRead(file))
		);
	}
}

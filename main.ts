import { MetadataCache, Notice, Plugin, ReferenceCache, TFile } from 'obsidian';

interface MetadataCacheExtra extends MetadataCache {
	fileCache: any;
	metadataCache: any;
}

export default class AliasFromHeadingPlugin extends Plugin {
	async onload () {
		const plugin = this;
		const { metadataCache, vault, workspace } = this.app;
		const headingByPath = new Map();

		function updateHeadingByFile (file:TFile) {
			if (!file) {
				return;
			}
			const { path } = file;
			const heading = plugin.updateCache(path);
			headingByPath.set(path, heading);
		}

		updateHeadingByFile(workspace.getActiveFile());

		this.registerEvent(workspace.on('file-open', updateHeadingByFile));

		this.registerEvent(vault.on('rename', (file, oldPath) => {
			if (!headingByPath.has(oldPath)) {
				return;
			}
			const heading = headingByPath.get(oldPath);
			headingByPath.set(file.path, heading);
			headingByPath.delete(oldPath);
		}));

		this.registerEvent(metadataCache.on('changed', async (file) => {
			const { path } = file;
			const heading = this.updateCache(path);
			const prevHeading = headingByPath.get(path);

			if (prevHeading === heading) {
				return;
			}

			headingByPath.set(path, heading);

			const modifiedFiles = Object.entries(metadataCache.resolvedLinks)
				.reduce((paths, [toPath, links]) => {
					const hasRef = Object.keys(links).includes(path);
					return hasRef ? [...paths, toPath] : paths;
				}, [])
				.map((p:string) => {
					const f = <TFile>vault.getAbstractFileByPath(p);
					const { links = [] } = metadataCache.getCache(p);
					const rc = links
						.filter((rc) => rc.link === metadataCache.fileToLinktext(file, ''))
						.filter((rc) => rc.displayText === prevHeading || rc.displayText === rc.link)[0]
					return [f, rc];
				})
				.filter(([, rc]:[TFile, ReferenceCache]) => rc)
				.map(async ([f, rc]:[TFile, ReferenceCache]) => {
					const prevContents = await vault.read(f);
					const nextLink = `[[${rc.link}|${heading === undefined ? rc.link : heading}]]`;
					const contents = replaceAll(prevContents, rc.original, nextLink);
					await vault.modify(f, contents);
					return f.path;
				})

			if (!modifiedFiles.length) {
				return;
			}

			await Promise.all(modifiedFiles);
			const fileCount = modifiedFiles.length;
			new Notice(`Updated links in ${fileCount} ${pluralize(fileCount, 'file')}.`);
		}));
	}

	updateCache (path: string) {
		const { metadataCache } = this.app;
		const cache = metadataCache.getCache(path);
		const { frontmatter = {}, headings } = cache;
		if (!Array.isArray(headings) || !headings.length) {
			return;
		}
		// This gets the first heading.
		// However, it could be configured to get the first heading with `{ level: 1 }`?
		const { heading } = headings[0];
		const { hash } = (<MetadataCacheExtra>metadataCache).fileCache[path];
		const { alias } = <any>frontmatter;
		const _alias = alias ? Array.isArray(alias) ? alias : [alias] : []
		const uniqueAlias = [...new Set([ heading, ..._alias ])];
		const updatedCache = {
			...cache,
			frontmatter: {
				...frontmatter,
				alias: uniqueAlias
			}
		};
		(<MetadataCacheExtra>metadataCache).metadataCache[hash] = updatedCache;
		return heading;
	}
}

function escapeRegExp(source:string):string {
	return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pluralize (count:number, singular:string, plural = `${singular}s`):string {
	return count === 1 ? singular : plural;
}

function replaceAll (source:string, find:string, replace:string):string {
	return source.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

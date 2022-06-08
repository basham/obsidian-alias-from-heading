import { MetadataCache, Notice, Plugin, ReferenceCache, TFile } from 'obsidian';

interface MetadataCacheExtra extends MetadataCache {
	fileCache: any;
	metadataCache: any;
}

export default class AliasFromHeadingPlugin extends Plugin {
	async onload () {
		const { metadataCache, vault } = this.app;
		const cache = new Map();
		this.registerEvent(metadataCache.on('resolve', async (file) => {
			const { path } = file;
			const heading = this.updateAlias(path);
			const prevHeading = cache.get(path);

			if (prevHeading === heading) {
				return;
			}

			cache.set(path, heading);

			const modifiedFiles = Object.entries(metadataCache.resolvedLinks)
				.reduce((paths, [toPath, links]) => {
					const hasRef = Object.keys(links).includes(path);
					return hasRef ? [...paths, toPath] : paths;
				}, [])
				.map((p:string) => {
					const file = <TFile>vault.getAbstractFileByPath(p);
					const { links = [] } = metadataCache.getCache(p);
					const rc = links
						.filter((rc) => `${rc.link}.md` === path)
						.filter((rc) => rc.displayText === prevHeading || rc.displayText === rc.link)[0]
					return [file, rc];
				})
				.filter(([, rc]:[TFile, ReferenceCache]) => rc)
				.map(async ([file, rc]:[TFile, ReferenceCache]) => {
					const prevContents = await vault.read(file);
					const nextLink = `[[${rc.link}|${heading === undefined ? rc.link : heading}]]`;
					const contents = replaceAll(prevContents, rc.original, nextLink);
					await vault.modify(file, contents);
					return file.path;
				})

			if (!modifiedFiles.length) {
				return;
			}

			await Promise.all(modifiedFiles);
			const fileCount = modifiedFiles.length;
			new Notice(`Updated links in ${fileCount} ${pluralize(fileCount, 'file')}.`);
		}));
	}

	updateAlias (path: string) {
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

function pluralize (count:number, singular:string, plural:string = `${singular}s`):string {
	return count === 1 ? singular : plural;
}

function replaceAll (source:string, find:string, replace:string):string {
	return source.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

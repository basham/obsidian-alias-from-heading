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
					const { links = [] } = metadataCache.getCache(p);
					const linksToReplace = links
						.filter((rc:ReferenceCache) => rc.link.split('#')[0] === metadataCache.fileToLinktext(file, ''))
						.filter((rc:ReferenceCache) => rc.displayText === prevHeading || rc.displayText === rc.link)
						.filter((rc:ReferenceCache) => rc.original !== `[[${rc.link}]]`)
						.map((rc:ReferenceCache) => [
							rc.original,
							`[[${rc.link}|${heading === undefined ? rc.link : heading}]]`
						])
					return [p, linksToReplace];
				})
				.filter(([, linksToReplace]:[string, []]) => linksToReplace.length)
				.map(async ([p, linksToReplace]:[string, []]) => {
					const f = <TFile>vault.getAbstractFileByPath(p);
					const prevContents = await vault.read(f);
					const contents = linksToReplace.reduce(
						(source, [find, replace]:string[]) => replaceAll(source, find, replace),
						prevContents
					);
					await vault.modify(f, contents);
					return linksToReplace.length;
				})

			const fileCount = modifiedFiles.length;

			if (!fileCount) {
				return;
			}

			const linkCount = (await Promise.all(modifiedFiles))
				.reduce((sum, value) => sum + value, 0)

			new Notice(`Updated ${linkCount} ${pluralize(linkCount, 'link')} in ${fileCount} ${pluralize(fileCount, 'file')}.`);
		}));
	}

	updateCache (path: string) {
		const { metadataCache } = this.app;
		const cache = metadataCache.getCache(path);
		const { frontmatter = {}, headings } = cache;
		if (!Array.isArray(headings) || !headings.length) {
			return;
		}
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

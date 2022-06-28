import { debounce, MetadataCache, Notice, Plugin, ReferenceCache, TFile } from 'obsidian';

interface MetadataCacheExtra extends MetadataCache {
	fileCache: any;
	metadataCache: any;
}

export default class AliasFromHeadingPlugin extends Plugin {
	async onload () {
		const { metadataCache, vault, workspace } = this.app;
		const headingByPath = new Map();

		const clearHeadings = debounce((path) => {
			if (!headingByPath.has(path)) {
				return;
			}
			const heading = headingByPath.get(path);
			headingByPath.clear();
			headingByPath.set(path, heading);
		}, 10000, true);

		const loadFile = (file:TFile) => {
			if (!file) {
				return;
			}
			// Cache the current heading for each active or opened file.
			// Once a new file opens, clear out the old data after
			// a debounced 10 seconds. This gives plenty of time for
			// any links to be updated, if the user updates the heading
			// and quickly opens another file.
			const { path } = file;
			const heading = this.loadHeading(path);
			headingByPath.set(path, heading);
			clearHeadings(path);
		};

		workspace.onLayoutReady(() => loadFile(workspace.getActiveFile()));

		this.registerEvent(workspace.on('file-open', loadFile));

		this.registerEvent(vault.on('rename', (file, oldPath) => {
			if (!(file instanceof TFile)) {
				return;
			}
			const { path } = file;
			const heading = headingByPath.get(oldPath);
			headingByPath.set(path, heading);
		}));

		this.registerEvent(metadataCache.on('changed', async (file) => {
			const { path } = file;

			if (!headingByPath.has(path)) {
				return;
			}

			const prevHeading = headingByPath.get(path);
			const heading = this.loadHeading(path);
			headingByPath.set(path, heading);

			if (prevHeading === heading) {
				return;
			}

			const modifiedFiles = Object.entries(metadataCache.resolvedLinks)
				.reduce((paths, [toPath, links]) => {
					const hasRef = Object.keys(links).includes(path);
					return hasRef ? [...paths, toPath] : paths;
				}, [])
				.map((p:string) => {
					const { links = [] } = metadataCache.getCache(p);
					const linksToReplace = links
						.map((rc:ReferenceCache) => rc.link)
						.filter((link) => link.split('#')[0] === metadataCache.fileToLinktext(file, ''))
						// Make pairs of links to be found and replaced.
						// Some of these pairs may be redundant or result in no matches
						// for any given path, but that's okay.
						// The `rc.original` and `rc.displayText` values are not used,
						// because it could be inaccurate if the heading ends with a `]`.
						// The Obsidian algorithm for detecting links is correct,
						// but this extra work is needed to match to the user intent.
						.map((link) =>
							[prevHeading, heading]
								.map((h) => `[[${link}|${h === undefined ? link : h}]]`)
						)
					return [p, linksToReplace];
				})
				.filter(([, linksToReplace]:[string, []]) => linksToReplace.length)
				.map(async ([p, linksToReplace]:[string, []]) => {
					const f = <TFile>vault.getAbstractFileByPath(p);
					const prevContents = await vault.read(f);
					const [contents, matches]:(string | number)[] = linksToReplace.reduce(
						([source, total]:[string, number], [find, replace]:string[]) => {
							// The heading must be a regular expression and not a string.
							// This solves two problems with the use of `String.replace()`.
							// 1. This allows replacement patterns (`$$, `$&`, etc.)
							//    to be included in the heading without causing mismatches,
							//    similar to the aforementioned `]` problem.
							// 2. This allows the second parameter to be a function,
							//    so the number of matches can be counted as a side effect.
							let count = 0;
							const re = new RegExp(escapeRegExp(find), 'g');
							const s = source.replace(re, () => {
								count++;
								return replace;
							});
							return [s, count + total];
						},
						[prevContents, 0]
					);
					await vault.modify(f, <string>contents);
					return matches;
				})

			const linkMatches = (await Promise.all(modifiedFiles))
				.filter((m) => m);
			const fileCount = linkMatches.length;
			const linkCount = linkMatches
				.reduce((sum, value) => sum + value, 0);

			if (!fileCount || !linkCount) {
				return;
			}

			new Notice(`Updated ${linkCount} ${pluralize(linkCount, 'link')} in ${fileCount} ${pluralize(fileCount, 'file')}.`);
		}));

		this.registerEvent(metadataCache.on('resolve', async (file) => {
			const { path } = file;
			// Update metadata for all files in the vault on load.
			// Keep it updated even if files are modified outside of Obsidian.
			// This is also triggered after files are changed.
			// There is a small performance penalty in that case,
			// because the same work was already done during the `change` event.
			this.loadHeading(path);
		}));
	}

	loadHeading (path: string) {
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

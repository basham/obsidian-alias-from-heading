import { CachedMetadata, debounce, Events, MetadataCache, Notice, parseFrontMatterAliases, Plugin, ReferenceCache, TFile } from 'obsidian';

interface MetadataCacheExtra extends MetadataCache {
	fileCache: any;
	metadataCache: any;
}

interface CachedMetadataExtra extends CachedMetadata {
	_frontmatter: any;
}

export default class AliasFromHeadingPlugin extends Plugin {
	unloadQueue:Set<Function> = new Set();

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

			const { path } = file;
			const heading = this.loadHeading(path);
			const activeFile = workspace.getActiveFile();

			if (path !== activeFile?.path) {
				return;
			}

			// Cache the current heading for each active or opened file.
			// Once a new file opens, clear out the old data after
			// a debounced 10 seconds. This gives plenty of time for
			// any links to be updated, if the user updates the heading
			// and quickly opens another file.
			headingByPath.set(path, heading);
			clearHeadings(path);
		};

		workspace.onLayoutReady(() => {
			const files = vault.getMarkdownFiles();
			files.forEach(loadFile);
		});

		this.registerAndUnloadEvent(workspace, 'file-open', loadFile);

		this.registerAndUnloadEvent(metadataCache, 'resolve', loadFile);

		this.registerAndUnloadEvent(vault, 'rename', (file, oldPath) => {
			if (!(file instanceof TFile)) {
				return;
			}
			const { path } = file;
			const heading = headingByPath.get(oldPath);
			headingByPath.set(path, heading);
		});

		this.registerAndUnloadEvent(metadataCache, 'changed', async (file) => {
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
		});
	}

	async unload() {
		this.unloadQueue.forEach((cb:Function) => cb());
		this.unloadQueue.clear();
		// Swap any modified frontmatter for the original.
		const metadataCache = <MetadataCacheExtra>this.app.metadataCache;
		Object.keys(metadataCache.metadataCache).forEach((hash) => {
			const cache = <CachedMetadataExtra>metadataCache.metadataCache[hash];
			if (!cache.hasOwnProperty('_frontmatter')) {
				return;
			}
			if (cache._frontmatter === undefined) {
				delete cache.frontmatter;
			} else {
				cache.frontmatter = cache._frontmatter;
			}
			delete cache._frontmatter;
		});
	}

	registerAndUnloadEvent (emitter:Events, name:string, callback: (...data: any) => any) {
		const eventRef = emitter.on(name, callback);
		this.registerEvent(eventRef);
		// Manually unsubscribe to events, since `this.registerEvent()`
		// seems to not be doing it on plugin unload.
		this.unloadQueue.add(() => emitter.off(name, callback));
	}

	loadHeading (path: string) {
		const metadataCache = <MetadataCacheExtra>this.app.metadataCache;
		const cache = <CachedMetadataExtra>metadataCache.getCache(path);
		if (!cache) {
			return;
		}
		const { headings } = cache;
		if (!Array.isArray(headings) || !headings.length) {
			return;
		}
		const _frontmatter = cache.hasOwnProperty('_frontmatter') ? cache._frontmatter : cache.frontmatter;
		const { heading } = headings[0];
		const aliases = parseFrontMatterAliases(_frontmatter) || [];
		const frontmatter = <any>{ ...(_frontmatter || {}) };
		frontmatter.aliases = [...new Set([ heading, ...aliases ])];
		// Delete the `alias` key, so it doesn't override any use of `aliases`.
		delete frontmatter.alias;
		// Save a duplicate of the original frontmatter as `_frontmatter`.
		// If `_frontmatter` is not present, the frontmatter has not been
		// modified by this plugin or it has been overwritten.
		const updatedCache = { ...cache, _frontmatter, frontmatter };
		const { hash } = metadataCache.fileCache[path];
		metadataCache.metadataCache[hash] = updatedCache;
		return heading;
	}
}

function escapeRegExp(source:string):string {
	return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pluralize (count:number, singular:string, plural = `${singular}s`):string {
	return count === 1 ? singular : plural;
}

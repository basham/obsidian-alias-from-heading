import { CachedMetadata, debounce, Notice, Plugin, ReferenceCache, TFile } from 'obsidian';

interface LinkSuggestion {
	file: TFile;
	path: string;
	alias?: string;
}

export default class AliasFromHeadingPlugin extends Plugin {
	removeMetadataCachePatch: () => void;

	onload () {
		const { metadataCache, vault, workspace } = this.app;
		const headingByPath = new Map();

		function getHeading (file:TFile) {
			const { headings } = metadataCache.getFileCache(file);
			if (!Array.isArray(headings) || !headings.length) {
				return;
			}
			const { heading } = headings[0];
			return heading;
		}

		// Once a file opens, clear out the old data after
		// a debounced 10 seconds. This gives plenty of time for
		// any links to be updated, if the user updates the heading
		// and quickly opens another file.
		const clearHeadings = debounce((path) => {
			if (!headingByPath.has(path)) {
				return;
			}
			const heading = headingByPath.get(path);
			headingByPath.clear();
			headingByPath.set(path, heading);
		}, 10000, true);

		function loadFile (file:TFile) {
			if (!file) {
				return;
			}
			const { path } = file;
			const heading = getHeading(file);
			headingByPath.set(path, heading);
			clearHeadings(path);
		}

		workspace.onLayoutReady(() => {
			const activeFile = workspace.getActiveFile();
			loadFile(activeFile);
		});

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
			const heading = getHeading(file);
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
						.filter((rc:ReferenceCache) => metadataCache.getFirstLinkpathDest(rc.link, '')?.path === path)
						// Make pairs of links to be found and replaced.
						// Some of these pairs may be redundant or result in no matches
						// for any given path, but that's okay.
						// The `rc.original` and `rc.displayText` values are not used,
						// because it could be inaccurate if the heading includes brackets `[]`.
						// The Obsidian algorithm for detecting links is correct,
						// but this extra work is needed to match to the user intent.
						.map((rc:ReferenceCache) => {
							const { original } = rc;

							const mdLinkRE = /^\[(.*)\]\((?<link>.*)\)$/;
							const mdLink = original.match(mdLinkRE)?.groups?.link;
							if (mdLink) {
								return [
									`[${escapeMDLinkName(prevHeading)}](${mdLink})`,
									`[${escapeMDLinkName(heading)}](${mdLink})`
								];
							}

							const wikiLinkRE = /^\[\[(?<link>.*?)\|.*\]\]$/;
							const wikiLink = original.match(wikiLinkRE)?.groups?.link;
							if (wikiLink) {
								return [
									`[[${wikiLink}|${escapeWikiLinkName(prevHeading)}]]`,
									`[[${wikiLink}|${escapeWikiLinkName(heading)}]]`,
								];
							}
						})
						.filter((i) => i);
					return [p, linksToReplace];
				})
				.filter(([, linksToReplace]:[string, []]) => linksToReplace.length)
				.map(async ([p, linksToReplace]:[string, []]) => {
					const f = <TFile>vault.getAbstractFileByPath(p);
					let matches = 0;
					await vault.process(f, (data) =>
						linksToReplace.reduce(
							(source, [find, replace]:string[]) => {
								// The heading must be a regular expression and not a string.
								// This solves two problems with the use of `String.replace()`.
								// 1. This allows replacement patterns (`$$, `$&`, etc.)
								//    to be included in the heading without causing mismatches,
								//    similar to the aforementioned `]` problem.
								// 2. This allows the second parameter to be a function,
								//    so the number of matches can be counted as a side effect.
								const re = new RegExp(escapeRegExp(find), 'g');
								return source.replace(re, () => {
									matches++;
									return replace;
								});
							},
							data
						)
					);
					return matches;
				});

			const linkMatches = (await Promise.all(modifiedFiles))
				.filter((m) => m);
			const fileCount = linkMatches.length;
			const linkCount = <number>linkMatches
				.reduce((sum:number, value:number) => sum + value, 0);

			if (!fileCount || !linkCount) {
				return;
			}

			new Notice(`Updated ${linkCount} ${pluralize(linkCount, 'link')} in ${fileCount} ${pluralize(fileCount, 'file')}.`);
		}));

		// Extend the `getCache` method to include aliases
		// derived from headings.
		this.removeMetadataCachePatch = patch(metadataCache, {
			getCache (originalMethod: (path:string) => CachedMetadata|null) {
				return function (path:string) {
					const cache = originalMethod(path);
					const { headings = [] } = cache;

					if (!Array.isArray(headings) || !headings.length) {
						return cache;
					}

					const { frontmatter = {} } = cache;
					const { aliases: _aliases = [] } = frontmatter;
					const aliasesArray = Array.isArray(_aliases) ? _aliases : [_aliases];
					const { heading } = headings[0];

					if (aliasesArray.includes(heading)) {
						return cache;
					}

					const aliases = aliasesArray.length ? [heading, ...aliasesArray] : heading;

					return {
						...cache,
						frontmatter: {
							...frontmatter,
							aliases
						}
					};
				}
			}
		});
	}

	onunload () {
		this.removeMetadataCachePatch();
	}
}

// Escape all brackets (`[]`).
function escapeMDLinkName (source:string):string {
	return source.replace(/[\[\]]/g, '\\$&');
}

// Escape all sets of brackets (`[[` or `]]`).
function escapeWikiLinkName (source:string):string {
	return source.replace(
		/(\[{2,}|\]{2,})/g,
		(match) => match.split('').map((m) => `\\${m}`).join('')
	)
}

function escapeRegExp (source:string):string {
	return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Inspired by:
// https://github.com/pjeby/monkey-around
function patch (source:any, methods:any) {
	const removals = Object.entries(methods).map(([key, createMethod]) => {
		const hadOwn = source.hasOwnProperty(key);
		const method = source[key];
		// @ts-ignore
		source[key] = createMethod(method.bind(source));

		return function remove () {
			if (hadOwn) {
				source[key] = method;
			} else {
				delete source[key];
			}
		}
	})
	return () => removals.forEach((r) => r())
}

function pluralize (count:number, singular:string, plural:string = `${singular}s`):string {
	return count === 1 ? singular : plural;
}

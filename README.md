# Alias from heading

[Aliases](https://help.obsidian.md/How+to/Add+aliases+to+note) in [Obsidian](https://obsidian.md) make it convenient to provide display names to document links. However, there are a few pain points:

- Aliases are managed in YAML, which may feel clumsy to use.
- Display names of links do not stay in sync with changes to aliases.

This plugin resolves these problems in the following ways:

- An alias is implicitly added to a document, matching the first heading in that document, regardless of heading level.
- This alias is a suggestion when [typing `[[` to add a link](https://help.obsidian.md/How+to/Internal+link) or when opening a document with the [Quick Switcher](https://help.obsidian.md/Plugins/Quick+switcher).
- This alias is not explicitly defined in YAML. Any aliases defined in YAML continue to behave in their standard way.
- Updating the first heading in a document will only update links to that document with a display name matching the heading. This makes it so the link display name can be customized for a particular context, but by default, the link display name will stay in sync with the heading.

## Developer instructions

Read the [Obsidian Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin) readme and [Obsidian Plugin Developer Docs](https://marcus.se.net/obsidian-plugin-docs/) to learn about how to develop, install, test, and publish this plugin.

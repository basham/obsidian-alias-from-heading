# Alias from heading

[Aliases](https://help.obsidian.md/How+to/Add+aliases+to+note) in [Obsidian](https://obsidian.md) make it convenient to provide display names to document links. However, there are a few pain points:

- Aliases are managed in YAML, which may feel clumsy to use.
- Display names of links do not stay in sync with changes to aliases.

This plugin resolves these problems in the following ways:

- An alias is implicitly added to a document, matching the first heading in that document, regardless of heading level.
- This alias is a suggestion when [typing `[[` to add a link](https://help.obsidian.md/How+to/Internal+link) or when opening a document with the [Quick Switcher](https://help.obsidian.md/Plugins/Quick+switcher).
- This alias is not explicitly defined in YAML. Any aliases defined in YAML continue to behave in their standard way.
- Updating the first heading in a document will only update links to that document with a display name matching the heading. This makes it so the link display name can be customized for a particular context, but by default, the link display name will stay in sync with the heading.

## Example

Without this plugin, an alias would need to be explicitly defined in YAML. It is a manual process to keep the alias in sync with the first heading in the document.

```md
<!-- 2022-06-08-1030.md -->

---
alias: "🍅 Build a garden"
---

# 🍅 Build a garden

- Survey the yard
- Choose a design
- Purchase materials
- Build the frame
- Prepare the ground
- Fill the bed
```

With this plugin, the alias front matter is no longer needed.

```md
<!-- 2022-06-08-1030.md -->

# 🍅 Build a garden

- Survey the yard
- Choose a design
- Purchase materials
- Build the frame
- Prepare the ground
- Fill the bed
```

This second document links to the first document with only the file name.

```md
<!-- 2022-02-02-1445.md -->

# 🥬 Gardening projects

- [[2022-06-08-1030]]
- Germinate seeds
- ...
```

However, it is often more readable to link to the document with a friendly display name. Type `[[`, search for the document by its heading, and select it to insert it.

```md
<!-- 2022-02-02-1445.md -->

# 🥬 Gardening projects

- [[2022-06-08-1030|🍅 Build a garden]]
- Germinate seeds
- ...
```

Now that the display name matches the first heading of the document it links to, they stay in sync. Update the heading in the first document from `🍅 Build a garden` to `🥕 Build a raised garden bed`. Obsidian notifies you with "Updated links in 1 file." Now the second document displays:

```md
<!-- 2022-02-02-1445.md -->

# 🥬 Gardening projects

- [[2022-06-08-1030|🥕 Build a raised garden bed]]
- Germinate seeds
- ...
```

If all headings are removed from the first document, any links that were kept in sync are updated so that their display name matches the file name. This behavior makes it easy to later insert a new heading while keeping any link display names in sync. It also makes the preview of the link still meaningful, in the meantime.

```md
<!-- 2022-02-02-1445.md -->

# 🥬 Gardening projects

- [[2022-06-08-1030|2022-06-08-1030]]
- Germinate seeds
- ...
```

If a custom display name is wanted or none at all, just manually change it inline. It will not be kept in sync with the heading, unless it is manually changed back to match the heading.

```md
<!-- 2022-02-02-1445.md -->

# 🥬 Gardening projects

- [[2022-06-08-1030|🌽 Garden bed]]
- Germinate seeds
- ...
```

## Developer instructions

Read the [Obsidian Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin) readme and [Obsidian Plugin Developer Docs](https://marcus.se.net/obsidian-plugin-docs/) to learn about how to develop, install, test, and publish this plugin.

# Alias from heading

Aliases in [Obsidian](https://obsidian.md) make it convenient to provide display names to note links. However, there are a few pain points:

- [Aliases are managed in YAML](https://help.obsidian.md/Linking+notes+and+files/Aliases), which may feel clumsy to use.
- Display names of links do not stay in sync with changes to aliases.

This plugin resolves these problems in the following ways:

- An alias is implicitly added to a note, matching the first heading in that note, regardless of heading level.
- This heading alias is used wherever YAML aliases are used, such as when [linking to a note using an alias](https://help.obsidian.md/Linking+notes+and+files/Internal+links#Link+to+a+file) or [finding unlinked mentions for an alias](https://help.obsidian.md/Linking+notes+and+files/Aliases#Find+unlinked+mentions+for+an+alias).
- Updating the first heading in a note will only update links to that note with a display name matching the heading. This makes it so the link display name can be customized for a particular context, but by default, the link display name will stay in sync with the heading.
- Both the [Wikilink and Markdown formats](https://help.obsidian.md/Linking+notes+and+files/Internal+links#Supported+formats+for+internal+links) are supported.
- Any aliases defined in YAML continue to behave in their standard way and do not affect the behavior of this plugin. Unlike the heading alias, updating aliases in YAML will not update the display name of any of their associated links.

## Example

Without this plugin, an alias would need to be explicitly defined in YAML. It is a manual process to keep the alias in sync with the first heading in the note.

```md
<!-- 2022-06-08-1030.md -->

---
aliases: "🍅 Build a garden"
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

This second note links to the first note with only the file name.

```md
<!-- 2022-02-02-1445.md -->

# 🥬 Gardening projects

- [[2022-06-08-1030]]
- Germinate seeds
- ...
```

However, it is often more readable to link to the note with a friendly display name. Type `[[`, search for the note by its heading, and select it to insert it.

```md
<!-- 2022-02-02-1445.md -->

# 🥬 Gardening projects

- [[2022-06-08-1030|🍅 Build a garden]]
- Germinate seeds
- ...
```

Now that the display name matches the first heading of the note it links to, they stay in sync. Update the heading in the first note from `🍅 Build a garden` to `🥕 Build a raised garden bed`. Now the second note displays the change.

```md
<!-- 2022-02-02-1445.md -->

# 🥬 Gardening projects

- [[2022-06-08-1030|🥕 Build a raised garden bed]]
- Germinate seeds
- ...
```

If all headings are removed from the first note, any links that were kept in sync are updated so that their display name matches the file name. This behavior makes it easy to later insert a new heading while keeping any link display names in sync. It also makes the preview of the link still meaningful, in the meantime.

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

Read the [Obsidian Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin) readme and [Obsidian Plugin Developer Docs](https://docs.obsidian.md) to learn about how to develop, install, test, and publish this plugin.

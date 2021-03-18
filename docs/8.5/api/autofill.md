---
title: Autofill
permalink: /8.5/api/autofill
canonicalUrl: /api/autofill
---

# {{ $frontmatter.title }}

[[toc]]

## Description


This plugin provides "drag-down" and "copy-down" functionalities, both operated using the small square in the right
bottom of the cell selection.

"Drag-down" expands the value of the selected cells to the neighbouring cells when you drag the small
square in the corner.

"Copy-down" copies the value of the selection to all empty cells below when you double click the small square.


## Members:

### autoInsertRow
`autofill.autoInsertRow : boolean`

Specifies if can insert new rows if needed.


## Functions:

### destroy
`autofill.destroy()`

Destroys the plugin instance.



### disablePlugin
`autofill.disablePlugin()`

Disables the plugin functionality for this Handsontable instance.



### enablePlugin
`autofill.enablePlugin()`

Enables the plugin functionality for this Handsontable instance.



### isEnabled
`autofill.isEnabled() ⇒ boolean`

Checks if the plugin is enabled in the Handsontable settings.



### updatePlugin
`autofill.updatePlugin()`

Updates the plugin state. This method is executed when [Core#updateSettings](./Core/#updateSettings) is invoked.


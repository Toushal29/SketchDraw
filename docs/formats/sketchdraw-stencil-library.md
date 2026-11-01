# SketchDraw portable component library

SketchDraw portable component libraries use JSON so stencils and document component masters can be moved between installations. The default extension is `.sdlibrary.json`.

## Root object

| Field | Type | Meaning |
| --- | --- | --- |
| `format` | string | Must be `SketchDrawStencilLibrary`. |
| `version` | integer | `1` is accepted for legacy stencil-only libraries; `2` is the current export version. |
| `stencils` | array | Up to 40 reusable groups of editable SketchDraw elements. |
| `masters` | array | Optional in version 2; up to 100 document component masters. |

Each stencil contains `id`, `name`, and a non-empty `elements` array. Optional fields are `tags` (up to 12 unique tags), `preview` (short display text), `folder` (category path), and `parameters` (up to 12 named text substitutions). Stencil IDs are reassigned when a library is imported into a document. The serialized element objects use the same SketchDraw element model as `.sketch` documents, so groups, shapes, connectors, labels, images, and other supported element types remain editable.

Each version 2 master contains `id`, `name`, `template`, and positive `bounds` (`x`, `y`, `w`, `h`). Optional fields include named `variants` (up to 24), the active `variantKey`, interaction `states` (`hover`, `pressed`, `selected`, or `disabled` mapped to variant keys), up to 32 `connectionPoints`, and `createdAt`. A master template and each stencil are limited to 500,000 serialized characters. The complete library is limited to 20,000,000 serialized characters.

The importer rejects invalid JSON, unsupported versions, empty components, invalid bounds, oversized entries, and broken element references. Version 1 remains readable; exports use version 2. Unknown fields are ignored when read and are not guaranteed to survive a SketchDraw import/export cycle.

## Example

```json
{
  "format": "SketchDrawStencilLibrary",
  "version": 2,
  "stencils": [
    {
      "id": "service-card",
      "name": "Service card",
      "tags": ["architecture", "service"],
      "preview": "Orders API · HTTP",
      "folder": "Architecture / Services",
      "parameters": ["service", "protocol"],
      "elements": [
        {
          "type": "rectangle",
          "id": "service-box",
          "x": 0,
          "y": 0,
          "w": 180,
          "h": 90,
          "color": "#344054",
          "thickness": 2,
          "label": { "text": "{{service}}\n{{protocol}}" }
        }
      ]
    }
  ],
  "masters": []
}
```

The element example is abbreviated for readability; files exported by SketchDraw include all fields needed to recreate the selected elements.

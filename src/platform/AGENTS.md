# Platform-specific changes

- This codebase targets Windows desktop only. Mobile/Android support has been removed.
- Put Windows-specific components and styles in `windows/`.
- The app shell exposes the `platform-windows` class for scoped CSS.
- Keep Windows-only styles in `windows/windows.css` or a stylesheet in `windows/`.

# CSS Shapes Editor for Brackets

Extension for [Brackets](https://github.com/adobe/brackets/) and [Adobe Edge Code](http://html.adobe.com/edge/code/).

Adds an on-screen interactive editor for CSS Shapes values when in Live Preview mode.

## How to Install

### Simple:
- Open Brackets, and go to _File_ >  _Extension Manager_
- Search for "CSS Shapes Editor for Brackets"
- Click _Install_

### From source

1. Open Brackets, and go to _File_ >  _Extension Manager_
2. Click _Install from URL..._
3. Enter this URL:

```
https://github.com/adobe-webplatform/brackets-css-shapes-editor
```
4. Click _Install_
5. Reload Brackets.

## How to enable CSS Shapes

**UPDATE September 2014:** CSS Shapes are [enabled since Google Chrome 37](https://blogs.adobe.com/webplatform/2014/08/28/css-shapes-now-in-chrome-37/). If you're using Chrome 37+, this section is no longer relevant.

If you're using an older version of Chrome, here's how to enable the feature manually:

Before you use the shapes editor, you need to enable support for CSS Shapes in the LivePreview browser window. You need to do this even if you have already enabled CSS Shapes in another Google Chrome browser on your system.

To enable CSS Shapes:

1. Turn on LivePreview
2. Navigate to `chrome://flags`
3. Find the _Enable experimental Web Platform features_ flag
4. Click _Enable_
5. Reload LivePreview.

## Changelog

### v1.1.0
- sync with [shapes editor library v0.8.0](https://github.com/adobe-webplatform/css-shapes-editor/releases/tag/v0.8.0)
  - fixes various bugs related to reference boxes and percentage-based coordinates;
  - adds on-screen controls for polygon edit / transform modes;
  - uses minified version of library;
- removes keyboard shortcut (T key) to toggle polygon transform mode.
- removes handling & feature detection of `shape-inside` (obsolete from CSS Shapes Level 1)

## License

MIT-licensed -- see `main.js` for details.

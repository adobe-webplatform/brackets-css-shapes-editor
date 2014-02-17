/*
 * Copyright (c) 2013 Adobe Systems Incorporated.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets */

define(function (require, exports, module) {
    "use strict";

    var EditorManager       = brackets.getModule("editor/EditorManager"),
        CSSUtils            = brackets.getModule("language/CSSUtils"),
        LiveDevelopment     = brackets.getModule("LiveDevelopment/LiveDevelopment"),
        ProjectManager      = brackets.getModule("project/ProjectManager"),
        Model               = require("Model"),
        LiveEditorDriver    = require("LiveEditorLocalDriver");

    // Update if you add editors for new properties
    var SUPPORTED_PROPS = ["shape-inside", "shape-outside", "clip-path"];

    // string source of editor and provider
    var CSSShapesEditor         = require("text!lib/CSSShapesEditor.js"),
        CSSShapesEditorProvider = require("text!lib/CSSShapesEditorProvider.js");

    // dependencies to be injected in the HTML page in LivePreview
    var _remoteEditors = [CSSShapesEditor, CSSShapesEditorProvider];

    // stylesheet URLs that are used by the active HTML page in LivePreview;
    var _relatedStylesheets = [];

    var _currentEditor = EditorManager.getActiveEditor();

    // Stores state to sync between code editor and in-browser editor
    var model = new Model({
        property: null,
        value:    null,
        selector: null
    });

    /*
        Returns the range that wraps the CSS value at the given pos.
        Assumes pos is within or adjacent to a CSS value (between : and ; or })

        @param {!{line:number, ch:number}} pos
        @param {?boolean} trimWhitespace Ignore whitepace surrounding css value; optional
        @return {!start: {line:number, ch:number}, end: {line:number, ch:number}}
    */
    function _getRangeForCSSValueAt(pos, trimWhitespace) {
        // TODO support multi-line values
        var line    = _currentEditor.document.getLine(pos.line),
            start   = pos.ch,
            end     = pos.ch,
            value;

        // css values start after a colon (:)
        start = line.lastIndexOf(":", pos.ch) + 1;

        // css values end before a semicolon (;) or closing bracket (})
        // TODO support closing bracket and multi-line. Bracket may be lower.
        end = line.indexOf(";", pos.ch);

        if (trimWhitespace) {
            value = line.substring(start, end);
            start = start + value.match(/^\s*/)[0].length;
            end = end - value.match(/\s*$/)[0].length;
        }

        return {
            // TODO: support multi-line values
            "start": { line: pos.line, ch: start },
            "end": { line: pos.line, ch: end }
        };
    }

    /*
        Constructs the global model with data if the cursor is on a CSS rule
        with a property from SUPPORTED_PROPS.

        Adds attributes to the model:
        {
            value: {String},    // the CSS value
            property: {String}, // the CSS property
            selector: {String}, // the selector associated with the CSS block
            range: {Object}     // the range in the code editor for the CSS value
        }

        Resets the existing model if:
            - the cursor is not on a CSS value;
            - the css property is not supported; @see SUPPORTED_PROPS
            - a selector cannot be extracted for the CSS block;

        Model triggers 'change' event if any attribute value has changed since last stored.
        Does not trigger 'change' event if cursor is just moving inside CSS value.

        @param {Event} e 'change' or 'cursorActivity' event dispatched by editor
    */
    function _constructModel(e) {
        var editor      = e.target,
            doc         = editor.document,
            selection   = editor.getSelection(),
            info,
            selector,
            range;

        // Get the CSS rule info at the selection start position
        info = CSSUtils.getInfoAtPos(editor, selection.start);

        if (info.context !== CSSUtils.PROP_VALUE || (SUPPORTED_PROPS.indexOf(info.name) < 0)) {
            model.reset();
            return;
        }

        selector = CSSUtils.findSelectorAtDocumentPos(editor, selection.start);

        if (!selector || typeof selector !== "string") {
            model.reset();
            return;
        }

        range = _getRangeForCSSValueAt(selection.start, true);

        model.set({
            selector: selector,
            property: info.name,
            range: range,
            /*
                Setting value as exact text range;

                Not using info.values.join('') because it may drop some whitespace
                from comma-separated values sending _updateCodeEditor() into an
                endless loop because model.value and document.getRange(model.range)
                will not be equal
            */
            value: editor.document.getRange(range.start, range.end)
        });
    }

    /*
        Extracts relative the URLs of all stylesheets
        used by the page in Live Preview mode.
    */
    function _collectRelatedStylesheets() {
        if (LiveDevelopment.status < LiveDevelopment.STATUS_ACTIVE) {
            return;
        }

        // FIXME: replace with LiveDevelopment.getServerBaseUrl()
        var baseUrl = LiveDevelopment._getServer().getBaseUrl(),
            stylesheetUrls = LiveDevelopment.agents.css.getStylesheetURLs(),
            results = [];


        if (stylesheetUrls.length) {

            stylesheetUrls.forEach(function (url) {
                results.push(url.replace(baseUrl, ""));
            });
        }

        return results;
    }

    /*
        Check if the current editor is attached to a stylesheet
        used by the page in Live Preview mode.

        @return {Boolean}
    */
    function _isEditingRelatedStylesheet() {
        var fullPath = _currentEditor.document.file.fullPath,
            projectPath = ProjectManager.getProjectRoot().fullPath,
            relativePath = fullPath.replace(projectPath, "");

        return (_relatedStylesheets.indexOf(relativePath) > -1);
    }

    // use the model to update the Brackets text editor property value
    function _updateCodeEditor() {
        var range = model.get("range"),
            value = model.get("value"),
            rangeText;

        if (!range) {
            return;
        }

        rangeText = _currentEditor.document.getRange(range.start, range.end);

        if (rangeText === value) {
            return;
        }

        _currentEditor.document.replaceRange(value, range.start, range.end, "+");
    }

    // use the model to update the in-browser editor
    function _updateLiveEditor() {
        if (!LiveDevelopment.status || LiveDevelopment.status < LiveDevelopment.STATUS_ACTIVE) {
            return;
        }

        /*
            Emit commands to the live editor only if:
            - the code editor is focused (hence data comes from input in Brackets)
            - the code editor is invoked on a stylesheet linked to the page in LivePreview

            Checking for this avoids echoing back data received from the live editor.
            The echoed data might be stale data if live editor is being actively used.
        */
        if (EditorManager.getFocusedEditor() && _isEditingRelatedStylesheet()) {
            if (model.get("property")) {
                LiveEditorDriver.update(model);
            } else {
                LiveEditorDriver.remove();
            }
        }
    }

    function _onActiveEditorChange() {
        if (_currentEditor) {
            $(_currentEditor).off("cursorActivity change", _constructModel);
            LiveEditorDriver.remove();
            model.reset();
        }

        _currentEditor = EditorManager.getActiveEditor();

        if (_currentEditor) {
            $(_currentEditor).on("cursorActivity change", _constructModel);
        }
    }

    function _setup() {
        $(model).on("change", function (e) {
            _updateCodeEditor();
            _updateLiveEditor();
        });

        $(EditorManager).on("activeEditorChange", _onActiveEditorChange);
        $(EditorManager).triggerHandler("activeEditorChange");

        // TODO: run this on document edit,
        // because user may link or add stylesheets while in LiveDevelopment is on
        _relatedStylesheets = _collectRelatedStylesheets();

        LiveEditorDriver.init(_remoteEditors);
    }

    function _teardown() {
        $(model).off('change');
        $(EditorManager).off("activeEditorChange");

        _relatedStylesheets.length = 0;

        LiveEditorDriver.remove();
    }

    function _onLiveDevelopmentStatusChange(event, status) {

        switch (status) {

        case LiveDevelopment.STATUS_ACTIVE:
            _setup();
            break;

        case LiveDevelopment.STATUS_INACTIVE:
            _teardown();
            break;
        }
    }

    $(LiveEditorDriver).on("update.model", function (e, data, force) {

        /*
            If the user is still typing in the code editor, refuse to update the model
            (and then the code editor) as a result of the live editor's state change.

            If the code editor is focused, the live editor in live preview cannot also be focused;
            state updates coming from there are just recent updates from the code editor.

            Avoids weird state bugs as a result of the frequency of sync loop in LiveEditorDriver.

            ---

            If there is a request to force a model update, circumvent this.
        */
        if (EditorManager.getFocusedEditor() && !force) {
            return;
        }

        model.set(data);
    });

    $(LiveDevelopment).on("statusChange", _onLiveDevelopmentStatusChange);

    // for testing only
    exports.model = model;
    exports._constructModel = _constructModel;
    exports._getRangeForCSSValueAt = _getRangeForCSSValueAt;
});

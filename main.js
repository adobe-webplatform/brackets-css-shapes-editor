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

    var DocumentManager     = brackets.getModule("document/DocumentManager"),
        EditorManager       = brackets.getModule("editor/EditorManager"),
        CSSUtils            = brackets.getModule("language/CSSUtils"),
        LiveDevelopment     = brackets.getModule("LiveDevelopment/LiveDevelopment"),
        Inspector           = brackets.getModule("LiveDevelopment/Inspector/Inspector"),
        Model               = require("Model"),
        LiveEditorDriver    = require("LiveEditorLocalDriver");
        
    var CSSShapesEditor         = require('text!lib/CSSShapesEditor.js'),
        CSSShapesEditorProvider = require('text!lib/CSSShapesEditorProvider.js');
        
    // Update this if you add editor providers for new properties
    var SUPPORTED_PROPS = ['shape-inside', 'shape-outside', 'clip-path'];
    
    var currentEditor = EditorManager.getActiveEditor();
    
    // Stores state to sync between code editor and in-browser editor
    var model = new Model({
        'property': null,
        'value': null,
        'selector': null
    });
    
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
    function _constructModel(e){
        var editor = e.target,
            doc = editor.document,
            selection = editor.getSelection(),
            info, selector, range;
        
        // Get the CSS rule info at the selection start position
        info = CSSUtils.getInfoAtPos(editor, selection.start);
        
        if (info.context !== CSSUtils.PROP_VALUE || (SUPPORTED_PROPS.indexOf(info.name) < 0)){
            model.reset();
            return;
        }
        
        // TODO: fix CSSUtils.findSelectorAtDocumentPos() because
        // it matches selectors outside <style> when run on single declaration block in <style> element
        selector = CSSUtils.findSelectorAtDocumentPos(editor, selection.start);
        
        if (!selector || typeof selector !== 'string'){
            // _removeLiveEditor();
            model.reset();
            return;
        }
        
        range = _getCSSValueRangeAt(selection.start, true);
        
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
            value: editor.document.getRange(range.start, range.end),
        });
    }
    
    /*
        Returns the range that wraps the CSS value at the given pos.
        Assumes pos is within or adjacent to a CSS value (between : and ; or })
        
        @param {!{line:number, ch:number}} pos
        @param {?boolean} trimWhitespace Ignore whitepace surrounding css value; optional
        @return {!start: {line:number, ch:number}, end: {line:number, ch:number}}
    */
    function _getCSSValueRangeAt(pos, trimWhitespace){
        // TODO support multi-line values
        var line = currentEditor.document.getLine(pos.line),
            start = pos.ch,
            end = pos.ch;
            
        // css values start after a colon (:)
        function isStartBoundaryChar(ch){
            return (/:/.test(ch));
        }
        
        // css values end before a semicolon (;) or closing bracket (})
        function isEndBoundaryChar(ch){
            return (/[;}]/.test(ch));
        }
        
        function isWhitespaceChar(ch){
            return (/\s/.test(ch));
        }
        
        while (start > 0 && !isStartBoundaryChar(line.charAt(start - 1))) {
            --start;
        }

        while (end < line.length && !isEndBoundaryChar(line.charAt(end))) {
            ++end;
        }
        
        // run a second pass to trim leading and trailing whitespace
        if (trimWhitespace){
            while (start < end && isWhitespaceChar(line.charAt(start))) {
                ++start;
            }

            while (end > start && isWhitespaceChar(line.charAt(end - 1))) {
                --end;
            }
        }
        
        return {
            // TODO: support multi-line values
            'start': { line: pos.line, ch: start },
            'end': { line: pos.line, ch: end }
        }
    }
    
    
    // use the model to update the Brackets text editor property value
    function _updateCodeEditor(){
        var range = model.get('range'),
            value = model.get('value'),
            rangeText;
        
        if (!range){
            // console.warn('no range')
            return;
        }
        
        rangeText = currentEditor.document.getRange(range.start, range.end);
        
        if (rangeText == value){
            // console.log('current range is current')
            return;
        }
        
        // console.log("replacing range");
        // replace value in editor; new value in model likey comes from in-browser editor
        currentEditor.document.replaceRange(value, range.start, range.end, "+");
    }
    
    function _onActiveEditorChange(){
        
        if (currentEditor){
            $(currentEditor).off("cursorActivity change", _constructModel)
        }
        
        currentEditor = EditorManager.getActiveEditor();
        
        if (currentEditor){ 
            $(currentEditor).on("cursorActivity change", _constructModel)
        }
    }
    
    // TODO: delay inject editor until a supported property is first focused
    function _onLiveDevelopmentStatusChange(event, status) {
        if (status >= LiveDevelopment.STATUS_ACTIVE) {
            var providers = [CSSShapesEditor, CSSShapesEditorProvider];
            LiveEditorDriver.init(providers);
        }
    }
    
    model.on('change', function(e){
        
        _updateCodeEditor();
        
        if (!model.get('property')){
            LiveEditorDriver.remove();
        }
        else{
            LiveEditorDriver.update(model);
        }
    });
    
    $(LiveEditorDriver).on('modelChange', function(e, data){
        console.log('I have a remote model change!', e, data)
    })
    
    $(LiveDevelopment).on("statusChange", _onLiveDevelopmentStatusChange);
    $(EditorManager).on("activeEditorChange", _onActiveEditorChange);
});

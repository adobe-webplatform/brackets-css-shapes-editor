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

/*global window */
 
/*
    Register CSSShapesEditor as a provider for editing shape properties.
    A provider is just a wrapper over custom editors to provide a common interface.
    
    All providers MUST implement at a minimum this interface:
    {   
        // turns on editor on specified target HTMLElement. 
        // picks-up necessary setup args from model
        setup: function(target, model){},
    
        // update the editor state given the provided model
        update: function(model){},
    
        // turn off the editor and remove any scaffolding
        remove: function(){},
        
        // sets a callback to be called with the new value
        onValueChange: function(callback){}
    }
*/
(function() {

    if (!window._LD_CSS_EDITOR || typeof window._LD_CSS_EDITOR.registerProvider !== 'function'){
        console.error('Missing LiveEditor driver');
        return;
    }
    
    if (!window.CSSShapesEditor){
        console.error('Missing CSSShapesEditor');
        return;
    }
    
    function Provider(){}
    
    Provider.prototype.setup = function(target, model){
        var scope = this;
        
        scope.inst = CSSShapesEditor(target, model.value);
        scope.inst.on('shapechange', function(){
            if (scope.callback){
                scope.callback.call(scope.inst, scope.inst.getCSSValue())
            }
        })
    };
    
    Provider.prototype.update = function(model){
        this.inst.updateValue(model.value);
    };
    
    Provider.prototype.onValueChange = function(fn){
        // TODO: check function
        this.callback = fn;
    };
    
    Provider.prototype.remove = function(){
        this.inst.remove();
        delete this.inst;
        delete this.callback;
    };
    
    window._LD_CSS_EDITOR.registerProvider('shape-inside', new Provider);
    window._LD_CSS_EDITOR.registerProvider('shape-outside', new Provider);
    window._LD_CSS_EDITOR.registerProvider('clip-path', new Provider);
})();

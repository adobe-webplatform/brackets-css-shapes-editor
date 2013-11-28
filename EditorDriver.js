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

(function() {
    
    var _providers = {},
        _activeEditor = null,
        _target = null,
        _model = null;
    
    function _onValueChange(value){
        if (!_target || !value){
            return
        }
        
        // update the selector target's style
        _target.style[_model.property] = value;
        
        // update the model. will be requested by Brackets to sync code editor
        _model.value = value;
    }
    
    // var cssLiveDev = window._LD_CSS_EDITOR = {
    window._LD_CSS_EDITOR = {
        setup: function(model){
            console.log(model.selector, model.property, model.value, model.x);
            console.log('Habemus model')
            
            // if (!_providers[model.property]){
            //     console.warn('no editor provided for property: ' + model.property)
            //     return
            // }
            // 
            // // find the first matching element from the given selector
            // // TODO: implement querySelectorAll() navigation through multiple results
            // _target = document.querySelector(model.selector);
            // 
            // if (!_target){
            //     console.warn('no element matching selector: ' + model.selector)
            //     return;
            // }
            // 
            // _activeEditor = new _providers[model.property].call(_target, model);
        },
        
        remove: function(){
            _activeEditor.remove()
            _activeEditor = null;
            _model = null;
        },
        
        update: function(model){
            _activeEditor.update(model)
        },
        /*
            Register an editor for the given CSS property.
            When the given property is passed in the model to .setup(),
            the specified editor should be invoked.
            
            Editors need to implement the `iLiveEditor` interface:
            {   
                // turns on editor on specified target HTMLElement. Picks-up necessary args from model
                setup: function(target, model){},
                
                // update the editor state given the provided model
                update: function(model){},
                
                // turn off the editor and remove any scaffolding
                remove: function(){},
                
                // must call .onValueChange(val) with the new value
            }
        */
        registerProvider: function(property, editor){
            _providers[property] = editor;
        }
    };
    
    console.log('Driver was injected!')
    
    // bind all functions to the instance, to allow direct use as callbacks
    // Object.keys(cssLiveDev).forEach(function(k) {
    //     if(typeof(cssLiveDev[k]) == "function") {
    //         cssLiveDev[k] = cssLiveDev[k].bind(cssLiveDev);
    //     }
    // })
    
})();

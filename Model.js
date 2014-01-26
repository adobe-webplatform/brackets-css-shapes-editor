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

define(function (require, exports, module){
    "use strict";
    
    var _ = brackets.getModule("thirdparty/lodash");

    function Model(properties){

        if (!(this instanceof Model)){
            return new Model(properties);
        }
        
        var _initial = properties || {},
            _props = {},
            _events = {};
            
        function _trigger(eventName, details){
            var callbacks = _events[eventName];
            if (callbacks.length){
                callbacks.forEach(function(cb){
                    cb.call(this, details);
                });
            }
        }
        
        function _set(key, value, silent){
            var hasChanged = false;
            
            // 2-arguments notation: hash with attributes and optional boolean
            if (typeof key === 'object' && arguments.length < 3){

                for (var k in key){
                    if (!_.isEqual(_props[k], key[k])){
                        _props[k] = key[k];
                        hasChanged = true;
                    }
                }
                silent = arguments[1] || false;
            }
            // 3-arguments notation: key, value and optional boolean
            else{
                
                if (!_.isEqual(_props[key], value)){
                    _props[key] = value;
                    hasChanged = true;
                }
            }
            
            if (silent !== true && hasChanged){
                _trigger('change', _props);
            }
        }
        
        if (typeof properties === 'object'){ 
            _set(properties, true);
        }
        
        return {
            set: _set,
            
            get: function(key){
                return _props[key];
            },
            
            on: function(eventName, fn){
                _events[eventName] = _events[eventName] || [];
                _events[eventName].push(fn);
            },
            
            reset: function(silent){
                
                // assign a clone of the initial properties
                _props = JSON.parse(JSON.stringify(_initial));
                
                if (!silent){
                    _trigger('change', _props);
                }
            }
        };
    }
    
    return Model;
});

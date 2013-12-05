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
    
    var LiveDevelopment     = brackets.getModule("LiveDevelopment/LiveDevelopment"),
        Inspector           = brackets.getModule("LiveDevelopment/Inspector/Inspector"),
        _                   = brackets.getModule("thirdparty/lodash");
        
    var LiveEditorRemoteDriver = require('text!LiveEditorRemoteDriver.js'),
        _namespace = 'window._LD_CSS_EDITOR',
        _model = {},
        _hasEditor = false,
        _syncFrequency = 500,
        _syncInterval;
        
    function _call(expression){
        var deferred = $.Deferred();
        
        if (!expression || typeof expression !== 'string'){
            throw new TypeError('Invalid _call() input. Expected string, got: ' + typeof expression);
        }
        
        if (!Inspector.connected()){
            console.warn('inspector not connected')
            return deferred.reject();
        }
        
        Inspector.Runtime.evaluate(expression, function(resp){
            if (!resp || resp.wasThrown){
                console.error(resp);
                deferred.reject();
            }
            else{
                deferred.resolve(resp)
            }
        })
        
        return deferred.promise(); 
    }
    
    function _setup(model){
        var attr = model.attributes;
        
        if (_hasEditor){
            // are we being asked to re-setup the same editor? update the existing one;
            if (attr.selector == _model.selector && attr.property == _model.property){
                return _update(model);
            }
        }
        
        console.log('SETUP', model.attributes.selector);
        var expr = _namespace + '.setup('+ JSON.stringify(model.attributes) +')';
        
        return _call(expr)
            .then(_startSyncLoop)
            .then( function(){ _hasEditor = true} );
    }
    
    function _update(model){
        if (!model || !model.attributes){
            throw new TypeError('Invalid _update() input. Expected {Model} instance, got: ' + model);
        }
        
        if (!_hasEditor){
            return _setup(model);
        }
        
        var attr = model.attributes;
        
        // are we updating the editor for the element & property we know?
        if (attr.selector !== _model.selector || attr.property !== _model.property){
            console.warn('Updating for a different editor');
            return _remove().then( function(){ return _setup(model) } );
        }
        
        console.log('UPDATE', model.attributes.selector);
        var expr = _namespace + '.update('+ JSON.stringify(model.attributes) +')';
        return _call(expr);
    }
    
    function _remove(){
        var expr = _namespace + '.remove()';
        
        console.log('REMOVE');
        return _call(expr).then(_stopSyncLoop).then(_reset);
    }
    
    function _reset(){
        var deferred = $.Deferred();
        
        _hasEditor = false;
        _model = {};
        
        // allow promise chaining
        return deferred.resolve();
    }
    
    function _startSyncLoop(){
        var deferred = $.Deferred();
        console.log('START SYNC');
        _syncInterval = setInterval(_onSync, _syncFrequency);
        
        // allow promise chaining
        return deferred.resolve();
    }
    
    function _stopSyncLoop(){
        var deferred = $.Deferred();
        console.log('STOP SYNC');
        clearInterval(_syncInterval);
        
        return deferred.resolve();
    }
    
    function _onSync(){
        console.log('SYNC');
        var expr = _namespace + '.getModel()';
        _call(expr).then(_updateModel)
    }
    
    function _updateModel(model){
        // TODO: compare local model with remote model and trigger change if they differ
        $(exports).triggerHandler('modelChange', model)
        console.log('trigger model change')
    }
    
    /*
        Inject remote live editor driver and any specified editor providers.
        @param {?Array} providers String sources of editors to be available in the browser; optional
    */
    function _init(providers){
        var scripts = [].concat(LiveEditorRemoteDriver, providers || []);
        $(exports).triggerHandler('init');
        
        return _call(scripts.join(';'));
    }
    
    exports.init = _init;
    exports.setup = _setup;
    exports.update = _update;
    exports.remove = _remove;
});

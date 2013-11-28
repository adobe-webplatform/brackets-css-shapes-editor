(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        //Allow using this built library as an AMD module
        //in another project. That other project will only
        //see this AMD call, not the internal modules in
        //the closure below.
        define(factory);
    } else {
        //Browser globals case. Just assign the
        //result to a property on the global.
        root.libGlobalName = factory();
    }
}(this, function () {
    //almond, and your modules will be inlined here
/**
 * almond 0.2.6 Copyright (c) 2011-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);

                name = baseParts.concat(name.split("/"));

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (typeof callback === 'function') {

            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback.apply(defined[name], args);

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        config = cfg;
        if (config.deps) {
            req(config.deps, config.callback);
        }
        return req;
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("third-party/almond/almond", function(){});

// Copyright (c) 2013 Adobe Systems Incorporated. All rights reserved.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
// http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// ┌────────────────────────────────────────────────────────────┐ \\
// │ Eve 0.4.2 - JavaScript Events Library                      │ \\
// ├────────────────────────────────────────────────────────────┤ \\
// │ Author Dmitry Baranovskiy (http://dmitry.baranovskiy.com/) │ \\
// └────────────────────────────────────────────────────────────┘ \\

(function (glob) {
    var version = "0.4.2",
        has = "hasOwnProperty",
        separator = /[\.\/]/,
        wildcard = "*",
        fun = function () {},
        numsort = function (a, b) {
            return a - b;
        },
        current_event,
        stop,
        events = {n: {}},
    /*\
     * eve
     [ method ]

     * Fires event with given `name`, given scope and other parameters.

     > Arguments

     - name (string) name of the *event*, dot (`.`) or slash (`/`) separated
     - scope (object) context for the event handlers
     - varargs (...) the rest of arguments will be sent to event handlers

     = (object) array of returned values from the listeners
    \*/
        eve = function (name, scope) {
			name = String(name);
            var e = events,
                oldstop = stop,
                args = Array.prototype.slice.call(arguments, 2),
                listeners = eve.listeners(name),
                z = 0,
                f = false,
                l,
                indexed = [],
                queue = {},
                out = [],
                ce = current_event,
                errors = [];
            current_event = name;
            stop = 0;
            for (var i = 0, ii = listeners.length; i < ii; i++) if ("zIndex" in listeners[i]) {
                indexed.push(listeners[i].zIndex);
                if (listeners[i].zIndex < 0) {
                    queue[listeners[i].zIndex] = listeners[i];
                }
            }
            indexed.sort(numsort);
            while (indexed[z] < 0) {
                l = queue[indexed[z++]];
                out.push(l.apply(scope, args));
                if (stop) {
                    stop = oldstop;
                    return out;
                }
            }
            for (i = 0; i < ii; i++) {
                l = listeners[i];
                if ("zIndex" in l) {
                    if (l.zIndex == indexed[z]) {
                        out.push(l.apply(scope, args));
                        if (stop) {
                            break;
                        }
                        do {
                            z++;
                            l = queue[indexed[z]];
                            l && out.push(l.apply(scope, args));
                            if (stop) {
                                break;
                            }
                        } while (l)
                    } else {
                        queue[l.zIndex] = l;
                    }
                } else {
                    out.push(l.apply(scope, args));
                    if (stop) {
                        break;
                    }
                }
            }
            stop = oldstop;
            current_event = ce;
            return out.length ? out : null;
        };
		// Undocumented. Debug only.
		eve._events = events;
    /*\
     * eve.listeners
     [ method ]

     * Internal method which gives you array of all event handlers that will be triggered by the given `name`.

     > Arguments

     - name (string) name of the event, dot (`.`) or slash (`/`) separated

     = (array) array of event handlers
    \*/
    eve.listeners = function (name) {
        var names = name.split(separator),
            e = events,
            item,
            items,
            k,
            i,
            ii,
            j,
            jj,
            nes,
            es = [e],
            out = [];
        for (i = 0, ii = names.length; i < ii; i++) {
            nes = [];
            for (j = 0, jj = es.length; j < jj; j++) {
                e = es[j].n;
                items = [e[names[i]], e[wildcard]];
                k = 2;
                while (k--) {
                    item = items[k];
                    if (item) {
                        nes.push(item);
                        out = out.concat(item.f || []);
                    }
                }
            }
            es = nes;
        }
        return out;
    };
    
    /*\
     * eve.on
     [ method ]
     **
     * Binds given event handler with a given name. You can use wildcards “`*`” for the names:
     | eve.on("*.under.*", f);
     | eve("mouse.under.floor"); // triggers f
     * Use @eve to trigger the listener.
     **
     > Arguments
     **
     - name (string) name of the event, dot (`.`) or slash (`/`) separated, with optional wildcards
     - f (function) event handler function
     **
     = (function) returned function accepts a single numeric parameter that represents z-index of the handler. It is an optional feature and only used when you need to ensure that some subset of handlers will be invoked in a given order, despite of the order of assignment. 
     > Example:
     | eve.on("mouse", eatIt)(2);
     | eve.on("mouse", scream);
     | eve.on("mouse", catchIt)(1);
     * This will ensure that `catchIt()` function will be called before `eatIt()`.
	 *
     * If you want to put your handler before non-indexed handlers, specify a negative value.
     * Note: I assume most of the time you don’t need to worry about z-index, but it’s nice to have this feature “just in case”.
    \*/
    eve.on = function (name, f) {
		name = String(name);
		if (typeof f != "function") {
			return function () {};
		}
        var names = name.split(separator),
            e = events;
        for (var i = 0, ii = names.length; i < ii; i++) {
            e = e.n;
            e = e.hasOwnProperty(names[i]) && e[names[i]] || (e[names[i]] = {n: {}});
        }
        e.f = e.f || [];
        for (i = 0, ii = e.f.length; i < ii; i++) if (e.f[i] == f) {
            return fun;
        }
        e.f.push(f);
        return function (zIndex) {
            if (+zIndex == +zIndex) {
                f.zIndex = +zIndex;
            }
        };
    };
    /*\
     * eve.f
     [ method ]
     **
     * Returns function that will fire given event with optional arguments.
	 * Arguments that will be passed to the result function will be also
	 * concated to the list of final arguments.
 	 | el.onclick = eve.f("click", 1, 2);
 	 | eve.on("click", function (a, b, c) {
 	 |     console.log(a, b, c); // 1, 2, [event object]
 	 | });
     > Arguments
	 - event (string) event name
	 - varargs (…) and any other arguments
	 = (function) possible event handler function
    \*/
	eve.f = function (event) {
		var attrs = [].slice.call(arguments, 1);
		return function () {
			eve.apply(null, [event, null].concat(attrs).concat([].slice.call(arguments, 0)));
		};
	};
    /*\
     * eve.stop
     [ method ]
     **
     * Is used inside an event handler to stop the event, preventing any subsequent listeners from firing.
    \*/
    eve.stop = function () {
        stop = 1;
    };
    /*\
     * eve.nt
     [ method ]
     **
     * Could be used inside event handler to figure out actual name of the event.
     **
     > Arguments
     **
     - subname (string) #optional subname of the event
     **
     = (string) name of the event, if `subname` is not specified
     * or
     = (boolean) `true`, if current event’s name contains `subname`
    \*/
    eve.nt = function (subname) {
        if (subname) {
            return new RegExp("(?:\\.|\\/|^)" + subname + "(?:\\.|\\/|$)").test(current_event);
        }
        return current_event;
    };
    /*\
     * eve.nts
     [ method ]
     **
     * Could be used inside event handler to figure out actual name of the event.
     **
     **
     = (array) names of the event
    \*/
    eve.nts = function () {
        return current_event.split(separator);
    };
    /*\
     * eve.off
     [ method ]
     **
     * Removes given function from the list of event listeners assigned to given name.
	 * If no arguments specified all the events will be cleared.
     **
     > Arguments
     **
     - name (string) name of the event, dot (`.`) or slash (`/`) separated, with optional wildcards
     - f (function) event handler function
    \*/
    /*\
     * eve.unbind
     [ method ]
     **
     * See @eve.off
    \*/
    eve.off = eve.unbind = function (name, f) {
		if (!name) {
		    eve._events = events = {n: {}};
			return;
		}
        var names = name.split(separator),
            e,
            key,
            splice,
            i, ii, j, jj,
            cur = [events];
        for (i = 0, ii = names.length; i < ii; i++) {
            for (j = 0; j < cur.length; j += splice.length - 2) {
                splice = [j, 1];
                e = cur[j].n;
                if (names[i] != wildcard) {
                    if (e[names[i]]) {
                        splice.push(e[names[i]]);
                    }
                } else {
                    for (key in e) if (e[has](key)) {
                        splice.push(e[key]);
                    }
                }
                cur.splice.apply(cur, splice);
            }
        }
        for (i = 0, ii = cur.length; i < ii; i++) {
            e = cur[i];
            while (e.n) {
                if (f) {
                    if (e.f) {
                        for (j = 0, jj = e.f.length; j < jj; j++) if (e.f[j] == f) {
                            e.f.splice(j, 1);
                            break;
                        }
                        !e.f.length && delete e.f;
                    }
                    for (key in e.n) if (e.n[has](key) && e.n[key].f) {
                        var funcs = e.n[key].f;
                        for (j = 0, jj = funcs.length; j < jj; j++) if (funcs[j] == f) {
                            funcs.splice(j, 1);
                            break;
                        }
                        !funcs.length && delete e.n[key].f;
                    }
                } else {
                    delete e.f;
                    for (key in e.n) if (e.n[has](key) && e.n[key].f) {
                        delete e.n[key].f;
                    }
                }
                e = e.n;
            }
        }
    };
    /*\
     * eve.once
     [ method ]
     **
     * Binds given event handler with a given name to only run once then unbind itself.
     | eve.once("login", f);
     | eve("login"); // triggers f
     | eve("login"); // no listeners
     * Use @eve to trigger the listener.
     **
     > Arguments
     **
     - name (string) name of the event, dot (`.`) or slash (`/`) separated, with optional wildcards
     - f (function) event handler function
     **
     = (function) same return function as @eve.on
    \*/
    eve.once = function (name, f) {
        var f2 = function () {
            eve.unbind(name, f2);
            return f.apply(this, arguments);
        };
        return eve.on(name, f2);
    };
    /*\
     * eve.version
     [ property (string) ]
     **
     * Current version of the library.
    \*/
    eve.version = version;
    eve.toString = function () {
        return "You are running Eve " + version;
    };
    (typeof module != "undefined" && module.exports) ? (module.exports = eve) : (typeof define != "undefined" ? (define("eve", [], function() { return eve; })) : (glob.eve = eve));
})(this);

/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define */

define('CSSUtils',[],function(){
    
    
    var unitConverters = {
        'px' : function(x) { return x; },
        'in' : function(x) { return x * 96; },
        'cm' : function(x) { return x / 0.02645833333; },
        'mm' : function(x) { return x / 0.26458333333; },
        'pt' : function(x) { return x / 0.75; },
        'pc' : function(x) { return x / 0.0625; },
        'em' : function(x,e) { return x*parseFloat(getComputedStyle(e).fontSize); },
        'rem': function(x,e) { return x*parseFloat(getComputedStyle(e.ownerDocument.documentElement).fontSize); },
        'vw' : function(x,e) { return x/100*window.innerWidth; },
        'vh' : function(x,e) { return x/100*window.innerHeight; },
        '%'  : function(x,e,h) {
            
            var box = e ? getContentBoxOf(e) : {
                top: 0,
                left: 0,
                width: 0,
                height: 0
            };
            
            if(h) { return x/100*box.height; }
            else  { return x/100*box.width;  }
            
        }
    };
    
    var unitBackConverters = {
        'px' : function(x) { return x; },
        'in' : function(x) { return x / 96; },
        'cm' : function(x) { return x * 0.02645833333; },
        'mm' : function(x) { return x * 0.26458333333; },
        'pt' : function(x) { return x * 0.75; },
        'pc' : function(x) { return x * 0.0625; },
        'em' : function(x,e) { return x/parseFloat(getComputedStyle(e).fontSize); },
        'rem': function(x,e) { return x/parseFloat(getComputedStyle(e.ownerDocument.documentElement).fontSize); },
        'vw' : function(x,e) { return x*100/window.innerWidth; },
        'vh' : function(x,e) { return x*100/window.innerHeight; },
        '%'  : function(x,e,h) {
            
            // get the box from which to compute the percentages
            var box = e ? getContentBoxOf(e) : {
                top: 0,
                left: 0,
                width: 0,
                height: 0
            };
            
            // special case of a circle radius:
            if(h===2) { return x*100/Math.sqrt(box.height*box.height+box.width*box.width); }
            
            // otherwise, we use the width or height
            if(h) { return x*100/box.height; }
            else  { return x*100/box.width;  }
            
        }
    };

    function convertToPixels(cssLength, element, heightRelative) {

        var match = cssLength.match(/^\s*(-?\d+(?:\.\d+)?)(\S*)\s*$/),
            currentLength = match ? parseFloat(match[1]) : 0.0,
            currentUnit = match ? match[2] : '',
            converter = unitConverters[currentUnit];

        if (match && converter) {

            return {
                value: Math.round(20*converter.call(null, currentLength, element, heightRelative))/20,
                unit: currentUnit
            };

        } else {

            return {
                value: currentLength ? currentLength : 0.0,
                unit: currentUnit ? currentUnit : 'px'
            };

        }
    }

    function convertFromPixels(pixelLength, destinUnit, element, heightRelative) {
        
        var converter = unitBackConverters[destinUnit];
        
        if(converter) {
            return '' + (Math.round(20*converter.call(null, pixelLength, element, heightRelative))/20) + '' + destinUnit;
        } else {
            return '' + pixelLength + 'px';
        }
    }
    
    /*
      Returns the content box layout (relative to the border box)
    */
    function getContentBoxOf(element) {

        var width = element.offsetWidth;
        var height = element.offsetHeight;

        var style = getComputedStyle(element);

        var leftBorder = parseFloat(style.borderLeftWidth);
        var rightBorder = parseFloat(style.borderRightWidth);
        var topBorder = parseFloat(style.borderTopWidth);
        var bottomBorder = parseFloat(style.borderBottomWidth);

        var leftPadding = parseFloat(style.paddingLeft);
        var rightPadding = parseFloat(style.paddingRight);
        var topPadding = parseFloat(style.paddingTop);
        var bottomPadding = parseFloat(style.paddingBottom);

        // TODO: what happens if box-sizing is not content-box? 
        // seems like at least shape-outside vary...
        return {

            top: topBorder + topPadding,
            left: leftBorder + leftPadding,
            width: width - leftBorder - leftPadding - rightPadding - rightBorder,
            height: height - topBorder - topPadding - bottomPadding - topBorder

        };

    }
    
    function Utils(){
        
        if (!(this instanceof Utils)){
            return new Utils();
        }
        
        return {
            'convertToPixels': convertToPixels,
            'convertFromPixels': convertFromPixels,
            'getContentBoxOf': getContentBoxOf
        };
    }
    
    return new Utils();
});

// Snap.svg 0.1.1
// 
// Copyright (c) 2013 Adobe Systems Incorporated. All rights reserved.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
// http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// 
// build: 2013-11-26
!function(a){var b,c,d="0.4.2",e="hasOwnProperty",f=/[\.\/]/,g="*",h=function(){},i=function(a,b){return a-b},j={n:{}},k=function(a,d){a=String(a);var e,f=c,g=Array.prototype.slice.call(arguments,2),h=k.listeners(a),j=0,l=[],m={},n=[],o=b;b=a,c=0;for(var p=0,q=h.length;q>p;p++)"zIndex"in h[p]&&(l.push(h[p].zIndex),h[p].zIndex<0&&(m[h[p].zIndex]=h[p]));for(l.sort(i);l[j]<0;)if(e=m[l[j++]],n.push(e.apply(d,g)),c)return c=f,n;for(p=0;q>p;p++)if(e=h[p],"zIndex"in e)if(e.zIndex==l[j]){if(n.push(e.apply(d,g)),c)break;do if(j++,e=m[l[j]],e&&n.push(e.apply(d,g)),c)break;while(e)}else m[e.zIndex]=e;else if(n.push(e.apply(d,g)),c)break;return c=f,b=o,n.length?n:null};k._events=j,k.listeners=function(a){var b,c,d,e,h,i,k,l,m=a.split(f),n=j,o=[n],p=[];for(e=0,h=m.length;h>e;e++){for(l=[],i=0,k=o.length;k>i;i++)for(n=o[i].n,c=[n[m[e]],n[g]],d=2;d--;)b=c[d],b&&(l.push(b),p=p.concat(b.f||[]));o=l}return p},k.on=function(a,b){if(a=String(a),"function"!=typeof b)return function(){};for(var c=a.split(f),d=j,e=0,g=c.length;g>e;e++)d=d.n,d=d.hasOwnProperty(c[e])&&d[c[e]]||(d[c[e]]={n:{}});for(d.f=d.f||[],e=0,g=d.f.length;g>e;e++)if(d.f[e]==b)return h;return d.f.push(b),function(a){+a==+a&&(b.zIndex=+a)}},k.f=function(a){var b=[].slice.call(arguments,1);return function(){k.apply(null,[a,null].concat(b).concat([].slice.call(arguments,0)))}},k.stop=function(){c=1},k.nt=function(a){return a?new RegExp("(?:\\.|\\/|^)"+a+"(?:\\.|\\/|$)").test(b):b},k.nts=function(){return b.split(f)},k.off=k.unbind=function(a,b){if(!a)return k._events=j={n:{}},void 0;var c,d,h,i,l,m,n,o=a.split(f),p=[j];for(i=0,l=o.length;l>i;i++)for(m=0;m<p.length;m+=h.length-2){if(h=[m,1],c=p[m].n,o[i]!=g)c[o[i]]&&h.push(c[o[i]]);else for(d in c)c[e](d)&&h.push(c[d]);p.splice.apply(p,h)}for(i=0,l=p.length;l>i;i++)for(c=p[i];c.n;){if(b){if(c.f){for(m=0,n=c.f.length;n>m;m++)if(c.f[m]==b){c.f.splice(m,1);break}!c.f.length&&delete c.f}for(d in c.n)if(c.n[e](d)&&c.n[d].f){var q=c.n[d].f;for(m=0,n=q.length;n>m;m++)if(q[m]==b){q.splice(m,1);break}!q.length&&delete c.n[d].f}}else{delete c.f;for(d in c.n)c.n[e](d)&&c.n[d].f&&delete c.n[d].f}c=c.n}},k.once=function(a,b){var c=function(){return k.unbind(a,c),b.apply(this,arguments)};return k.on(a,c)},k.version=d,k.toString=function(){return"You are running Eve "+d},"undefined"!=typeof module&&module.exports?module.exports=k:"undefined"!=typeof define?define("eve",[],function(){return k}):a.eve=k}(this),function(a,b){"function"==typeof define&&define.amd?define('snap',["eve"],function(c){return b(a,c)}):b(a,a.eve)}(this,function(a,b){var c=function(b){var c={},d=a.requestAnimationFrame||a.webkitRequestAnimationFrame||a.mozRequestAnimationFrame||a.oRequestAnimationFrame||a.msRequestAnimationFrame||function(a){setTimeout(a,16)},e=Array.isArray||function(a){return a instanceof Array||"[object Array]"==Object.prototype.toString.call(a)},f=0,g="M"+(+new Date).toString(36),h=function(){return g+(f++).toString(36)},i=Date.now||function(){return+new Date},j=function(a){var b=this;if(null==a)return b.s;var c=b.s-a;b.b+=b.dur*c,b.B+=b.dur*c,b.s=a},k=function(a){var b=this;return null==a?b.spd:(b.spd=a,void 0)},l=function(a){var b=this;return null==a?b.dur:(b.s=b.s*a/b.dur,b.dur=a,void 0)},m=function(){var a=this;delete c[a.id],b("mina.stop."+a.id,a)},n=function(){var a=this;a.pdif||(delete c[a.id],a.pdif=a.get()-a.b)},o=function(){var a=this;a.pdif&&(a.b=a.get()-a.pdif,delete a.pdif,c[a.id]=a)},p=function(){var a=0;for(var f in c)if(c.hasOwnProperty(f)){var g,h=c[f],i=h.get();if(a++,h.s=(i-h.b)/(h.dur/h.spd),h.s>=1&&(delete c[f],h.s=1,a--,function(a){setTimeout(function(){b("mina.finish."+a.id,a)})}(h)),e(h.start)){g=[];for(var j=0,k=h.start.length;k>j;j++)g[j]=+h.start[j]+(h.end[j]-h.start[j])*h.easing(h.s)}else g=+h.start+(h.end-h.start)*h.easing(h.s);h.set(g)}a&&d(p)},q=function(a,b,e,f,g,i,r){var s={id:h(),start:a,end:b,b:e,s:0,dur:f-e,spd:1,get:g,set:i,easing:r||q.linear,status:j,speed:k,duration:l,stop:m,pause:n,resume:o};c[s.id]=s;var t,u=0;for(t in c)if(c.hasOwnProperty(t)&&(u++,2==u))break;return 1==u&&d(p),s};return q.time=i,q.getById=function(a){return c[a]||null},q.linear=function(a){return a},q.easeout=function(a){return Math.pow(a,1.7)},q.easein=function(a){return Math.pow(a,.48)},q.easeinout=function(a){if(1==a)return 1;if(0==a)return 0;var b=.48-a/1.04,c=Math.sqrt(.1734+b*b),d=c-b,e=Math.pow(Math.abs(d),1/3)*(0>d?-1:1),f=-c-b,g=Math.pow(Math.abs(f),1/3)*(0>f?-1:1),h=e+g+.5;return 3*(1-h)*h*h+h*h*h},q.backin=function(a){if(1==a)return 1;var b=1.70158;return a*a*((b+1)*a-b)},q.backout=function(a){if(0==a)return 0;a-=1;var b=1.70158;return a*a*((b+1)*a+b)+1},q.elastic=function(a){return a==!!a?a:Math.pow(2,-10*a)*Math.sin((a-.075)*2*Math.PI/.3)+1},q.bounce=function(a){var b,c=7.5625,d=2.75;return 1/d>a?b=c*a*a:2/d>a?(a-=1.5/d,b=c*a*a+.75):2.5/d>a?(a-=2.25/d,b=c*a*a+.9375):(a-=2.625/d,b=c*a*a+.984375),b},a.mina=q,q}("undefined"==typeof b?function(){}:b),d=function(){function d(a,b){if(a){if(a.tagName)return z(a);if(a instanceof u)return a;if(null==b)return a=I.doc.querySelector(a),z(a)}return a=null==a?"100%":a,b=null==b?"100%":b,new y(a,b)}function e(a,b){if(b){if("string"==typeof a&&(a=e(a)),"string"==typeof b)return"xlink:"==b.substring(0,6)?a.getAttributeNS(fb,b.substring(6)):"xml:"==b.substring(0,4)?a.getAttributeNS(gb,b.substring(4)):a.getAttribute(b);for(var c in b)if(b[J](c)){var d=K(b[c]);d?"xlink:"==c.substring(0,6)?a.setAttributeNS(fb,c.substring(6),d):"xml:"==c.substring(0,4)?a.setAttributeNS(gb,c.substring(4),d):a.setAttribute(c,d):a.removeAttribute(c)}}else a=I.doc.createElementNS(gb,a);return a}function f(a,b){return b=K.prototype.toLowerCase.call(b),"finite"==b?isFinite(a):"array"==b&&(a instanceof Array||Array.isArray&&Array.isArray(a))?!0:"null"==b&&null===a||b==typeof a&&null!==a||"object"==b&&a===Object(a)||U.call(a).slice(8,-1).toLowerCase()==b}function h(a){if("function"==typeof a||Object(a)!==a)return a;var b=new a.constructor;for(var c in a)a[J](c)&&(b[c]=h(a[c]));return b}function i(a,b){for(var c=0,d=a.length;d>c;c++)if(a[c]===b)return a.push(a.splice(c,1)[0])}function j(a,b,c){function d(){var e=Array.prototype.slice.call(arguments,0),f=e.join("␀"),g=d.cache=d.cache||{},h=d.count=d.count||[];return g[J](f)?(i(h,f),c?c(g[f]):g[f]):(h.length>=1e3&&delete g[h.shift()],h.push(f),g[f]=a.apply(b,e),c?c(g[f]):g[f])}return d}function k(a,b,c,d,e,f){if(null==e){var g=a-c,h=b-d;return g||h?(180+180*N.atan2(-h,-g)/R+360)%360:0}return k(a,b,e,f)-k(c,d,e,f)}function l(a){return a%360*R/180}function m(a){return 180*a/R%360}function n(a,b,c,d,e,f){return null==b&&"[object SVGMatrix]"==U.call(a)?(this.a=a.a,this.b=a.b,this.c=a.c,this.d=a.d,this.e=a.e,this.f=a.f,void 0):(null!=a?(this.a=+a,this.b=+b,this.c=+c,this.d=+d,this.e=+e,this.f=+f):(this.a=1,this.b=0,this.c=0,this.d=1,this.e=0,this.f=0),void 0)}function o(a){var b=[];return a=a.replace(/(?:^|\s)(\w+)\(([^)]+)\)/g,function(a,c,d){return d=d.split(/\s*,\s*/),"rotate"==c&&1==d.length&&d.push(0,0),"scale"==c&&(2==d.length&&d.push(0,0),1==d.length&&d.push(d[0],0,0)),"skewX"==c?b.push(["m",1,0,N.tan(l(d[0])),1,0,0]):"skewY"==c?b.push(["m",1,N.tan(l(d[0])),0,1,0,0]):b.push([c.charAt(0)].concat(d)),a}),b}function p(a,b){var c=pb(a),d=new n;if(c)for(var e=0,f=c.length;f>e;e++){var g,h,i,j,k,l=c[e],m=l.length,o=K(l[0]).toLowerCase(),p=l[0]!=o,q=p?d.invert():0;"t"==o&&3==m?p?(g=q.x(0,0),h=q.y(0,0),i=q.x(l[1],l[2]),j=q.y(l[1],l[2]),d.translate(i-g,j-h)):d.translate(l[1],l[2]):"r"==o?2==m?(k=k||b,d.rotate(l[1],k.x+k.width/2,k.y+k.height/2)):4==m&&(p?(i=q.x(l[2],l[3]),j=q.y(l[2],l[3]),d.rotate(l[1],i,j)):d.rotate(l[1],l[2],l[3])):"s"==o?2==m||3==m?(k=k||b,d.scale(l[1],l[m-1],k.x+k.width/2,k.y+k.height/2)):4==m?p?(i=q.x(l[2],l[3]),j=q.y(l[2],l[3]),d.scale(l[1],l[1],i,j)):d.scale(l[1],l[1],l[2],l[3]):5==m&&(p?(i=q.x(l[3],l[4]),j=q.y(l[3],l[4]),d.scale(l[1],l[2],i,j)):d.scale(l[1],l[2],l[3],l[4])):"m"==o&&7==m&&d.add(l[1],l[2],l[3],l[4],l[5],l[6])}return d}function q(a,b){if(null==b){var c=!0;if(b="linearGradient"==a.type||"radialGradient"==a.type?a.node.getAttribute("gradientTransform"):"pattern"==a.type?a.node.getAttribute("patternTransform"):a.node.getAttribute("transform"),!b)return new n;b=o(b)}else b=d._.rgTransform.test(b)?K(b).replace(/\.{3}|\u2026/g,a._.transform||S):o(b),f(b,"array")&&(b=d.path?d.path.toString.call(b):K(b)),a._.transform=b;var e=p(b,a.getBBox(1));return c?e:(a.matrix=e,void 0)}function r(a){var b=d._.someDefs;if(b&&qb(b.ownerDocument.documentElement,b))return b;var c=a.node.ownerSVGElement&&z(a.node.ownerSVGElement)||a.node.parentNode&&z(a.node.parentNode)||d.select("svg")||d(0,0),e=c.select("defs").node;return e||(e=x("defs",c.node).node),d._.someDefs=e,e}function s(a,b,c){function d(a){return null==a?S:a==+a?a:(e(j,{width:a}),j.getBBox().width)}function f(a){return null==a?S:a==+a?a:(e(j,{height:a}),j.getBBox().height)}function g(d,e){null==b?i[d]=e(a.attr(d)):d==b&&(i=e(null==c?a.attr(d):c))}var h=r(a),i={},j=h.querySelector(".svg---mgr");switch(j||(j=e("rect"),e(j,{width:10,height:10,"class":"svg---mgr"}),h.appendChild(j)),a.type){case"rect":g("rx",d),g("ry",f);case"image":g("width",d),g("height",f);case"text":g("x",d),g("y",f);break;case"circle":g("cx",d),g("cy",f),g("r",d);break;case"ellipse":g("cx",d),g("cy",f),g("rx",d),g("ry",f);break;case"line":g("x1",d),g("x2",d),g("y1",f),g("y2",f);break;case"marker":g("refX",d),g("markerWidth",d),g("refY",f),g("markerHeight",f);break;case"radialGradient":g("fx",d),g("fy",f);break;case"tspan":g("dx",d),g("dy",f);break;default:g(b,d)}return i}function t(a){f(a,"array")||(a=Array.prototype.slice.call(arguments,0));for(var b=0,c=0,d=this.node;this[b];)delete this[b++];for(b=0;b<a.length;b++)"set"==a[b].type?a[b].forEach(function(a){d.appendChild(a.node)}):d.appendChild(a[b].node);var e=d.childNodes;for(b=0;b<e.length;b++)this[c++]=z(e[b])}function u(a){if(a.snap in hb)return hb[a.snap];var b,c=this.id=eb();try{b=a.ownerSVGElement}catch(d){}if(this.node=a,b&&(this.paper=new y(b)),this.type=a.tagName,this.anims={},this._={transform:[]},a.snap=c,hb[c]=this,"g"==this.type){this.add=t;for(var e in y.prototype)y.prototype[J](e)&&(this[e]=y.prototype[e])}}function v(a){for(var b,c=0,d=a.length;d>c;c++)if(b=b||a[c])return b}function w(a){this.node=a}function x(a,b){var c=e(a);b.appendChild(c);var d=z(c);return d.type=a,d}function y(a,b){var c,d,f,g=y.prototype;if(a&&"svg"==a.tagName){if(a.snap in hb)return hb[a.snap];c=new u(a),d=a.getElementsByTagName("desc")[0],f=a.getElementsByTagName("defs")[0],d||(d=e("desc"),d.appendChild(I.doc.createTextNode("Created with Snap")),c.node.appendChild(d)),f||(f=e("defs"),c.node.appendChild(f)),c.defs=f;for(var h in g)g[J](h)&&(c[h]=g[h]);c.paper=c.root=c}else c=x("svg",I.doc.body),e(c.node,{height:b,version:1.1,width:a,xmlns:gb});return c}function z(a){return a?a instanceof u||a instanceof w?a:"svg"==a.tagName?new y(a):new u(a):a}function A(){return this.selectAll("stop")}function B(a,b){var c=e("stop"),f={offset:+b+"%"};return a=d.color(a),f["stop-color"]=a.hex,a.opacity<1&&(f["stop-opacity"]=a.opacity),e(c,f),this.node.appendChild(c),this}function C(){if("linearGradient"==this.type){var a=e(this.node,"x1")||0,b=e(this.node,"x2")||1,c=e(this.node,"y1")||0,f=e(this.node,"y2")||0;return d._.box(a,c,N.abs(b-a),N.abs(f-c))}var g=this.node.cx||.5,h=this.node.cy||.5,i=this.node.r||0;return d._.box(g-i,h-i,2*i,2*i)}function D(a,c){function d(a,b){for(var c=(b-j)/(a-k),d=k;a>d;d++)h[d].offset=+(+j+c*(d-k)).toFixed(2);k=a,j=b}var f,g=v(b("snap.util.grad.parse",null,c));if(!g)return null;g.params.unshift(a),f="l"==g.type.toLowerCase()?E.apply(0,g.params):F.apply(0,g.params),g.type!=g.type.toLowerCase()&&e(f.node,{gradientUnits:"userSpaceOnUse"});var h=g.stops,i=h.length,j=0,k=0;i--;for(var l=0;i>l;l++)"offset"in h[l]&&d(l,h[l].offset);for(h[i].offset=h[i].offset||100,d(i,h[i].offset),l=0;i>=l;l++){var m=h[l];f.addStop(m.color,m.offset)}return f}function E(a,b,c,d,f){var g=x("linearGradient",a);return g.stops=A,g.addStop=B,g.getBBox=C,null!=b&&e(g.node,{x1:b,y1:c,x2:d,y2:f}),g}function F(a,b,c,d,f,g){var h=x("radialGradient",a);return h.stops=A,h.addStop=B,h.getBBox=C,null!=b&&e(h.node,{cx:b,cy:c,r:d}),null!=f&&null!=g&&e(h.node,{fx:f,fy:g}),h}function G(a){return function(c){if(b.stop(),c instanceof w&&1==c.node.childNodes.length&&("radialGradient"==c.node.firstChild.tagName||"linearGradient"==c.node.firstChild.tagName||"pattern"==c.node.firstChild.tagName)&&(c=c.node.firstChild,r(this).appendChild(c),c=z(c)),c instanceof u)if("radialGradient"==c.type||"linearGradient"==c.type||"pattern"==c.type){c.node.id||e(c.node,{id:c.id});var f="url(#"+c.node.id+")"}else f=c.attr(a);else if(f=d.color(c),f.error){var g=D(r(this),c);g?(g.node.id||e(g.node,{id:g.id}),f="url(#"+g.node.id+")"):f=c}else f=K(f);var h={};h[a]=f,e(this.node,h),this.node.style[a]=S}}function H(a){for(var b=[],c=a.childNodes,d=0,e=c.length;e>d;d++){var f=c[d];3==f.nodeType&&b.push(f.nodeValue),"tspan"==f.tagName&&(1==f.childNodes.length&&3==f.firstChild.nodeType?b.push(f.firstChild.nodeValue):b.push(H(f)))}return b}d.version="0.1.1",d.toString=function(){return"Snap v"+this.version},d._={};var I={win:a,doc:a.document};d._.glob=I;var J="hasOwnProperty",K=String,L=parseFloat,M=parseInt,N=Math,O=N.max,P=N.min,Q=N.abs,R=(N.pow,N.PI),S=(N.round,""),T=" ",U=Object.prototype.toString,V=/^\s*((#[a-f\d]{6})|(#[a-f\d]{3})|rgba?\(\s*([\d\.]+%?\s*,\s*[\d\.]+%?\s*,\s*[\d\.]+%?(?:\s*,\s*[\d\.]+%?)?)\s*\)|hsba?\(\s*([\d\.]+(?:deg|\xb0|%)?\s*,\s*[\d\.]+%?\s*,\s*[\d\.]+(?:%?\s*,\s*[\d\.]+)?%?)\s*\)|hsla?\(\s*([\d\.]+(?:deg|\xb0|%)?\s*,\s*[\d\.]+%?\s*,\s*[\d\.]+(?:%?\s*,\s*[\d\.]+)?%?)\s*\))\s*$/i,W=/^url\(#?([^)]+)\)$/,X="	\n\f\r   ᠎             　\u2028\u2029",Y=new RegExp("[,"+X+"]+"),Z=(new RegExp("["+X+"]","g"),new RegExp("["+X+"]*,["+X+"]*")),$={hs:1,rg:1},_=new RegExp("([a-z])["+X+",]*((-?\\d*\\.?\\d*(?:e[\\-+]?\\d+)?["+X+"]*,?["+X+"]*)+)","ig"),ab=new RegExp("([rstm])["+X+",]*((-?\\d*\\.?\\d*(?:e[\\-+]?\\d+)?["+X+"]*,?["+X+"]*)+)","ig"),bb=new RegExp("(-?\\d*\\.?\\d*(?:e[\\-+]?\\d+)?)["+X+"]*,?["+X+"]*","ig"),cb=0,db="S"+(+new Date).toString(36),eb=function(){return db+(cb++).toString(36)},fb="http://www.w3.org/1999/xlink",gb="http://www.w3.org/2000/svg",hb={};d._.$=e,d._.id=eb,d.format=function(){var a=/\{([^\}]+)\}/g,b=/(?:(?:^|\.)(.+?)(?=\[|\.|$|\()|\[('|")(.+?)\2\])(\(\))?/g,c=function(a,c,d){var e=d;return c.replace(b,function(a,b,c,d,f){b=b||d,e&&(b in e&&(e=e[b]),"function"==typeof e&&f&&(e=e()))}),e=(null==e||e==d?a:e)+""};return function(b,d){return K(b).replace(a,function(a,b){return c(a,b,d)})}}();var ib=function(){function a(){this.parentNode.removeChild(this)}return function(b,c){var d=I.doc.createElement("img"),e=I.doc.body;d.style.cssText="position:absolute;left:-9999em;top:-9999em",d.onload=function(){c.call(d),d.onload=d.onerror=null,e.removeChild(d)},d.onerror=a,e.appendChild(d),d.src=b}}();d._.clone=h,d._.cacher=j,d.rad=l,d.deg=m,d.angle=k,d.is=f,d.snapTo=function(a,b,c){if(c=f(c,"finite")?c:10,f(a,"array")){for(var d=a.length;d--;)if(Q(a[d]-b)<=c)return a[d]}else{a=+a;var e=b%a;if(c>e)return b-e;if(e>a-c)return b-e+a}return b},function(a){function b(a){return a[0]*a[0]+a[1]*a[1]}function c(a){var c=N.sqrt(b(a));a[0]&&(a[0]/=c),a[1]&&(a[1]/=c)}a.add=function(a,b,c,d,e,f){var g,h,i,j,k=[[],[],[]],l=[[this.a,this.c,this.e],[this.b,this.d,this.f],[0,0,1]],m=[[a,c,e],[b,d,f],[0,0,1]];for(a&&a instanceof n&&(m=[[a.a,a.c,a.e],[a.b,a.d,a.f],[0,0,1]]),g=0;3>g;g++)for(h=0;3>h;h++){for(j=0,i=0;3>i;i++)j+=l[g][i]*m[i][h];k[g][h]=j}return this.a=k[0][0],this.b=k[1][0],this.c=k[0][1],this.d=k[1][1],this.e=k[0][2],this.f=k[1][2],this},a.invert=function(){var a=this,b=a.a*a.d-a.b*a.c;return new n(a.d/b,-a.b/b,-a.c/b,a.a/b,(a.c*a.f-a.d*a.e)/b,(a.b*a.e-a.a*a.f)/b)},a.clone=function(){return new n(this.a,this.b,this.c,this.d,this.e,this.f)},a.translate=function(a,b){return this.add(1,0,0,1,a,b)},a.scale=function(a,b,c,d){return null==b&&(b=a),(c||d)&&this.add(1,0,0,1,c,d),this.add(a,0,0,b,0,0),(c||d)&&this.add(1,0,0,1,-c,-d),this},a.rotate=function(a,b,c){a=l(a),b=b||0,c=c||0;var d=+N.cos(a).toFixed(9),e=+N.sin(a).toFixed(9);return this.add(d,e,-e,d,b,c),this.add(1,0,0,1,-b,-c)},a.x=function(a,b){return a*this.a+b*this.c+this.e},a.y=function(a,b){return a*this.b+b*this.d+this.f},a.get=function(a){return+this[K.fromCharCode(97+a)].toFixed(4)},a.toString=function(){return"matrix("+[this.get(0),this.get(1),this.get(2),this.get(3),this.get(4),this.get(5)].join()+")"},a.offset=function(){return[this.e.toFixed(4),this.f.toFixed(4)]},a.split=function(){var a={};a.dx=this.e,a.dy=this.f;var d=[[this.a,this.c],[this.b,this.d]];a.scalex=N.sqrt(b(d[0])),c(d[0]),a.shear=d[0][0]*d[1][0]+d[0][1]*d[1][1],d[1]=[d[1][0]-d[0][0]*a.shear,d[1][1]-d[0][1]*a.shear],a.scaley=N.sqrt(b(d[1])),c(d[1]),a.shear/=a.scaley;var e=-d[0][1],f=d[1][1];return 0>f?(a.rotate=m(N.acos(f)),0>e&&(a.rotate=360-a.rotate)):a.rotate=m(N.asin(e)),a.isSimple=!(+a.shear.toFixed(9)||a.scalex.toFixed(9)!=a.scaley.toFixed(9)&&a.rotate),a.isSuperSimple=!+a.shear.toFixed(9)&&a.scalex.toFixed(9)==a.scaley.toFixed(9)&&!a.rotate,a.noRotation=!+a.shear.toFixed(9)&&!a.rotate,a},a.toTransformString=function(a){var b=a||this.split();return b.isSimple?(b.scalex=+b.scalex.toFixed(4),b.scaley=+b.scaley.toFixed(4),b.rotate=+b.rotate.toFixed(4),(b.dx||b.dy?"t"+[+b.dx.toFixed(4),+b.dy.toFixed(4)]:S)+(1!=b.scalex||1!=b.scaley?"s"+[b.scalex,b.scaley,0,0]:S)+(b.rotate?"r"+[+b.rotate.toFixed(4),0,0]:S)):"m"+[this.get(0),this.get(1),this.get(2),this.get(3),this.get(4),this.get(5)]}}(n.prototype),d.Matrix=n,d.getRGB=j(function(a){if(!a||(a=K(a)).indexOf("-")+1)return{r:-1,g:-1,b:-1,hex:"none",error:1,toString:mb};if("none"==a)return{r:-1,g:-1,b:-1,hex:"none",toString:mb};if(!($[J](a.toLowerCase().substring(0,2))||"#"==a.charAt())&&(a=jb(a)),!a)return{r:-1,g:-1,b:-1,hex:"none",error:1,toString:mb};var b,c,e,g,h,i,j=a.match(V);return j?(j[2]&&(e=M(j[2].substring(5),16),c=M(j[2].substring(3,5),16),b=M(j[2].substring(1,3),16)),j[3]&&(e=M((h=j[3].charAt(3))+h,16),c=M((h=j[3].charAt(2))+h,16),b=M((h=j[3].charAt(1))+h,16)),j[4]&&(i=j[4].split(Z),b=L(i[0]),"%"==i[0].slice(-1)&&(b*=2.55),c=L(i[1]),"%"==i[1].slice(-1)&&(c*=2.55),e=L(i[2]),"%"==i[2].slice(-1)&&(e*=2.55),"rgba"==j[1].toLowerCase().slice(0,4)&&(g=L(i[3])),i[3]&&"%"==i[3].slice(-1)&&(g/=100)),j[5]?(i=j[5].split(Z),b=L(i[0]),"%"==i[0].slice(-1)&&(b/=100),c=L(i[1]),"%"==i[1].slice(-1)&&(c/=100),e=L(i[2]),"%"==i[2].slice(-1)&&(e/=100),("deg"==i[0].slice(-3)||"°"==i[0].slice(-1))&&(b/=360),"hsba"==j[1].toLowerCase().slice(0,4)&&(g=L(i[3])),i[3]&&"%"==i[3].slice(-1)&&(g/=100),d.hsb2rgb(b,c,e,g)):j[6]?(i=j[6].split(Z),b=L(i[0]),"%"==i[0].slice(-1)&&(b/=100),c=L(i[1]),"%"==i[1].slice(-1)&&(c/=100),e=L(i[2]),"%"==i[2].slice(-1)&&(e/=100),("deg"==i[0].slice(-3)||"°"==i[0].slice(-1))&&(b/=360),"hsla"==j[1].toLowerCase().slice(0,4)&&(g=L(i[3])),i[3]&&"%"==i[3].slice(-1)&&(g/=100),d.hsl2rgb(b,c,e,g)):(b=P(N.round(b),255),c=P(N.round(c),255),e=P(N.round(e),255),g=P(O(g,0),1),j={r:b,g:c,b:e,toString:mb},j.hex="#"+(16777216|e|c<<8|b<<16).toString(16).slice(1),j.opacity=f(g,"finite")?g:1,j)):{r:-1,g:-1,b:-1,hex:"none",error:1,toString:mb}},d),d.hsb=j(function(a,b,c){return d.hsb2rgb(a,b,c).hex}),d.hsl=j(function(a,b,c){return d.hsl2rgb(a,b,c).hex}),d.rgb=j(function(a,b,c,d){if(f(d,"finite")){var e=N.round;return"rgba("+[e(a),e(b),e(c),+d.toFixed(2)]+")"}return"#"+(16777216|c|b<<8|a<<16).toString(16).slice(1)});var jb=function(a){var b=I.doc.getElementsByTagName("head")[0],c="rgb(255, 0, 0)";return jb=j(function(a){if("red"==a.toLowerCase())return c;b.style.color=c,b.style.color=a;var d=I.doc.defaultView.getComputedStyle(b,S).getPropertyValue("color");return d==c?null:d}),jb(a)},kb=function(){return"hsb("+[this.h,this.s,this.b]+")"},lb=function(){return"hsl("+[this.h,this.s,this.l]+")"},mb=function(){return 1==this.opacity||null==this.opacity?this.hex:"rgba("+[this.r,this.g,this.b,this.opacity]+")"},nb=function(a,b,c){if(null==b&&f(a,"object")&&"r"in a&&"g"in a&&"b"in a&&(c=a.b,b=a.g,a=a.r),null==b&&f(a,string)){var e=d.getRGB(a);a=e.r,b=e.g,c=e.b}return(a>1||b>1||c>1)&&(a/=255,b/=255,c/=255),[a,b,c]},ob=function(a,b,c,e){a=N.round(255*a),b=N.round(255*b),c=N.round(255*c);var g={r:a,g:b,b:c,opacity:f(e,"finite")?e:1,hex:d.rgb(a,b,c),toString:mb};return f(e,"finite")&&(g.opacity=e),g};d.color=function(a){var b;return f(a,"object")&&"h"in a&&"s"in a&&"b"in a?(b=d.hsb2rgb(a),a.r=b.r,a.g=b.g,a.b=b.b,a.opacity=1,a.hex=b.hex):f(a,"object")&&"h"in a&&"s"in a&&"l"in a?(b=d.hsl2rgb(a),a.r=b.r,a.g=b.g,a.b=b.b,a.opacity=1,a.hex=b.hex):(f(a,"string")&&(a=d.getRGB(a)),f(a,"object")&&"r"in a&&"g"in a&&"b"in a&&!("error"in a)?(b=d.rgb2hsl(a),a.h=b.h,a.s=b.s,a.l=b.l,b=d.rgb2hsb(a),a.v=b.b):(a={hex:"none"},a.r=a.g=a.b=a.h=a.s=a.v=a.l=-1,a.error=1)),a.toString=mb,a},d.hsb2rgb=function(a,b,c,d){f(a,"object")&&"h"in a&&"s"in a&&"b"in a&&(c=a.b,b=a.s,a=a.h,d=a.o),a*=360;var e,g,h,i,j;return a=a%360/60,j=c*b,i=j*(1-Q(a%2-1)),e=g=h=c-j,a=~~a,e+=[j,i,0,0,i,j][a],g+=[i,j,j,i,0,0][a],h+=[0,0,i,j,j,i][a],ob(e,g,h,d)},d.hsl2rgb=function(a,b,c,d){f(a,"object")&&"h"in a&&"s"in a&&"l"in a&&(c=a.l,b=a.s,a=a.h),(a>1||b>1||c>1)&&(a/=360,b/=100,c/=100),a*=360;var e,g,h,i,j;return a=a%360/60,j=2*b*(.5>c?c:1-c),i=j*(1-Q(a%2-1)),e=g=h=c-j/2,a=~~a,e+=[j,i,0,0,i,j][a],g+=[i,j,j,i,0,0][a],h+=[0,0,i,j,j,i][a],ob(e,g,h,d)},d.rgb2hsb=function(a,b,c){c=nb(a,b,c),a=c[0],b=c[1],c=c[2];var d,e,f,g;return f=O(a,b,c),g=f-P(a,b,c),d=0==g?null:f==a?(b-c)/g:f==b?(c-a)/g+2:(a-b)/g+4,d=60*((d+360)%6)/360,e=0==g?0:g/f,{h:d,s:e,b:f,toString:kb}},d.rgb2hsl=function(a,b,c){c=nb(a,b,c),a=c[0],b=c[1],c=c[2];var d,e,f,g,h,i;return g=O(a,b,c),h=P(a,b,c),i=g-h,d=0==i?null:g==a?(b-c)/i:g==b?(c-a)/i+2:(a-b)/i+4,d=60*((d+360)%6)/360,f=(g+h)/2,e=0==i?0:.5>f?i/(2*f):i/(2-2*f),{h:d,s:e,l:f,toString:lb}},d.parsePathString=function(a){if(!a)return null;var b=d.path(a);if(b.arr)return d.path.clone(b.arr);var c={a:7,c:6,o:2,h:1,l:2,m:2,r:4,q:4,s:4,t:2,v:1,u:3,z:0},e=[];return f(a,"array")&&f(a[0],"array")&&(e=d.path.clone(a)),e.length||K(a).replace(_,function(a,b,d){var f=[],g=b.toLowerCase();if(d.replace(bb,function(a,b){b&&f.push(+b)}),"m"==g&&f.length>2&&(e.push([b].concat(f.splice(0,2))),g="l",b="m"==b?"l":"L"),"o"==g&&1==f.length&&e.push([b,f[0]]),"r"==g)e.push([b].concat(f));else for(;f.length>=c[g]&&(e.push([b].concat(f.splice(0,c[g]))),c[g]););}),e.toString=d.path.toString,b.arr=d.path.clone(e),e};var pb=d.parseTransformString=function(a){if(!a)return null;var b=[];return f(a,"array")&&f(a[0],"array")&&(b=d.path.clone(a)),b.length||K(a).replace(ab,function(a,c,d){var e=[];c.toLowerCase(),d.replace(bb,function(a,b){b&&e.push(+b)}),b.push([c].concat(e))}),b.toString=d.path.toString,b};d._.svgTransform2string=o,d._.rgTransform=new RegExp("^[a-z]["+X+"]*-?\\.?\\d","i"),d._.transform2matrix=p,d._unit2px=s;var qb=I.doc.contains||I.doc.compareDocumentPosition?function(a,b){var c=9==a.nodeType?a.documentElement:a,d=b&&b.parentNode;return a==d||!(!d||1!=d.nodeType||!(c.contains?c.contains(d):a.compareDocumentPosition&&16&a.compareDocumentPosition(d)))}:function(a,b){if(b)for(;b;)if(b=b.parentNode,b==a)return!0;return!1};d._.getSomeDefs=r,d.select=function(a){return z(I.doc.querySelector(a))},d.selectAll=function(a){for(var b=I.doc.querySelectorAll(a),c=(d.set||Array)(),e=0;e<b.length;e++)c.push(z(b[e]));return c},function(a){function g(a){function b(a,b){var c=e(a.node,b);c=c&&c.match(g),c=c&&c[2],c&&"#"==c.charAt()&&(c=c.substring(1),c&&(i[c]=(i[c]||[]).concat(function(c){var d={};d[b]="url(#"+c+")",e(a.node,d)})))}function c(a){var b=e(a.node,"xlink:href");b&&"#"==b.charAt()&&(b=b.substring(1),b&&(i[b]=(i[b]||[]).concat(function(b){a.attr("xlink:href","#"+b)})))}for(var d,f=a.selectAll("*"),g=/^\s*url\(("|'|)(.*)\1\)\s*$/,h=[],i={},j=0,k=f.length;k>j;j++){d=f[j],b(d,"fill"),b(d,"stroke"),b(d,"filter"),b(d,"mask"),b(d,"clip-path"),c(d);var l=e(d.node,"id");l&&(e(d.node,{id:d.id}),h.push({old:l,id:d.id}))}for(j=0,k=h.length;k>j;j++){var m=i[h[j].old];if(m)for(var n=0,o=m.length;o>n;n++)m[n](h[j].id)}}function h(a,b,c){return function(d){var e=d.slice(a,b);return 1==e.length&&(e=e[0]),c?c(e):e}}function i(a){return function(){var b=a?"<"+this.type:"",c=this.node.attributes,d=this.node.childNodes;if(a)for(var e=0,f=c.length;f>e;e++)b+=" "+c[e].name+'="'+c[e].value.replace(/"/g,'\\"')+'"';if(d.length){for(a&&(b+=">"),e=0,f=d.length;f>e;e++)3==d[e].nodeType?b+=d[e].nodeValue:1==d[e].nodeType&&(b+=z(d[e]).toString());a&&(b+="</"+this.type+">")}else a&&(b+="/>");return b}}a.attr=function(a,c){var d=this;if(d.node,!a)return d;if(f(a,"string")){if(!(arguments.length>1))return v(b("snap.util.getattr."+a,d));var e={};e[a]=c,a=e}for(var g in a)a[J](g)&&b("snap.util.attr."+g,d,a[g]);return d},a.getBBox=function(a){var b=this;if("use"==b.type&&(b=b.original),b.removed)return{};var c=b._;return a?(c.bboxwt=d.path.get[b.type]?d.path.getBBox(b.realPath=d.path.get[b.type](b)):d._.box(b.node.getBBox()),d._.box(c.bboxwt)):(b.realPath=(d.path.get[b.type]||d.path.get.deflt)(b),c.bbox=d.path.getBBox(d.path.map(b.realPath,b.matrix)),d._.box(c.bbox))};var j=function(){return this.string};a.transform=function(a){var b=this._;if(null==a){var c=new n(this.node.getCTM()),d=q(this),f=d.toTransformString(),g=K(d)==K(this.matrix)?b.transform:f;return{string:g,globalMatrix:c,localMatrix:d,diffMatrix:c.clone().add(d.invert()),global:c.toTransformString(),local:f,toString:j}}return a instanceof n&&(a=a.toTransformString()),q(this,a),this.node&&("linearGradient"==this.type||"radialGradient"==this.type?e(this.node,{gradientTransform:this.matrix}):"pattern"==this.type?e(this.node,{patternTransform:this.matrix}):e(this.node,{transform:this.matrix})),this},a.parent=function(){return z(this.node.parentNode)},a.append=a.add=function(a){if(a){if("set"==a.type){var b=this;return a.forEach(function(a){b.add(a)}),this}a=z(a),this.node.appendChild(a.node),a.paper=this.paper}return this},a.appendTo=function(a){return a&&(a=z(a),a.append(this)),this},a.prepend=function(a){if(a){a=z(a);var b=a.parent();this.node.insertBefore(a.node,this.node.firstChild),this.add&&this.add(),a.paper=this.paper,this.parent()&&this.parent().add(),b&&b.add()}return this},a.prependTo=function(a){return a=z(a),a.prepend(this),this},a.before=function(a){if("set"==a.type){var b=this;return a.forEach(function(a){var c=a.parent();b.node.parentNode.insertBefore(a.node,b.node),c&&c.add()}),this.parent().add(),this}a=z(a);var c=a.parent();return this.node.parentNode.insertBefore(a.node,this.node),this.parent()&&this.parent().add(),c&&c.add(),a.paper=this.paper,this},a.after=function(a){a=z(a);var b=a.parent();return this.node.nextSibling?this.node.parentNode.insertBefore(a.node,this.node.nextSibling):this.node.parentNode.appendChild(a.node),this.parent()&&this.parent().add(),b&&b.add(),a.paper=this.paper,this},a.insertBefore=function(a){a=z(a);var b=this.parent();return a.node.parentNode.insertBefore(this.node,a.node),this.paper=a.paper,b&&b.add(),a.parent()&&a.parent().add(),this},a.insertAfter=function(a){a=z(a);var b=this.parent();return a.node.parentNode.insertBefore(this.node,a.node.nextSibling),this.paper=a.paper,b&&b.add(),a.parent()&&a.parent().add(),this},a.remove=function(){var a=this.parent();return this.node.parentNode&&this.node.parentNode.removeChild(this.node),delete this.paper,this.removed=!0,a&&a.add(),this},a.select=function(a){return z(this.node.querySelector(a))},a.selectAll=function(a){for(var b=this.node.querySelectorAll(a),c=(d.set||Array)(),e=0;e<b.length;e++)c.push(z(b[e]));return c},a.asPX=function(a,b){return null==b&&(b=this.attr(a)),+s(this,a,b)},a.use=function(){var a,b=this.node.id;return b||(b=this.id,e(this.node,{id:b})),a="linearGradient"==this.type||"radialGradient"==this.type||"pattern"==this.type?x(this.type,this.node.parentNode):x("use",this.node.parentNode),e(a.node,{"xlink:href":"#"+b}),a.original=this,a},a.clone=function(){var a=z(this.node.cloneNode(!0));return e(a.node,"id")&&e(a.node,{id:a.id}),g(a),a.insertAfter(this),a},a.toDefs=function(){var a=r(this);return a.appendChild(this.node),this},a.pattern=function(a,b,c,d){var f=x("pattern",r(this));return null==a&&(a=this.getBBox()),a&&"x"in a&&(b=a.y,c=a.width,d=a.height,a=a.x),e(f.node,{x:a,y:b,width:c,height:d,patternUnits:"userSpaceOnUse",id:f.id,viewBox:[a,b,c,d].join(" ")}),f.node.appendChild(this.node),f},a.marker=function(a,b,c,d,f,g){var h=x("marker",r(this));return null==a&&(a=this.getBBox()),a&&"x"in a&&(b=a.y,c=a.width,d=a.height,f=a.refX||a.cx,g=a.refY||a.cy,a=a.x),e(h.node,{viewBox:[a,b,c,d].join(T),markerWidth:c,markerHeight:d,orient:"auto",refX:f||0,refY:g||0,id:h.id}),h.node.appendChild(this.node),h};var k=function(a,b,d,e){"function"!=typeof d||d.length||(e=d,d=c.linear),this.attr=a,this.dur=b,d&&(this.easing=d),e&&(this.callback=e)};d.animation=function(a,b,c,d){return new k(a,b,c,d)},a.inAnim=function(){var a=this,b=[];for(var c in a.anims)a.anims[J](c)&&!function(a){b.push({anim:new k(a._attrs,a.dur,a.easing,a._callback),curStatus:a.status(),status:function(b){return a.status(b)},stop:function(){a.stop()}})}(a.anims[c]);return b},d.animate=function(a,d,e,f,g,h){"function"!=typeof g||g.length||(h=g,g=c.linear);var i=c.time(),j=c(a,d,i,i+f,c.time,e,g);return h&&b.once("mina.finish."+j.id,h),j},a.stop=function(){for(var a=this.inAnim(),b=0,c=a.length;c>b;b++)a[b].stop();return this},a.animate=function(a,d,e,g){"function"!=typeof e||e.length||(g=e,e=c.linear),a instanceof k&&(g=a.callback,e=a.easing,d=e.dur,a=a.attr);var i,j,l,m,n=[],o=[],p={},q=this;for(var r in a)if(a[J](r)){q.equal?(m=q.equal(r,K(a[r])),i=m.from,j=m.to,l=m.f):(i=+q.attr(r),j=+a[r]);var s=f(i,"array")?i.length:1;p[r]=h(n.length,n.length+s,l),n=n.concat(i),o=o.concat(j)}var t=c.time(),u=c(n,o,t,t+d,c.time,function(a){var b={};for(var c in p)p[J](c)&&(b[c]=p[c](a));q.attr(b)},e);return q.anims[u.id]=u,u._attrs=a,u._callback=g,b.once("mina.finish."+u.id,function(){delete q.anims[u.id],g&&g.call(q)}),b.once("mina.stop."+u.id,function(){delete q.anims[u.id]}),q};var l={};a.data=function(a,c){var e=l[this.id]=l[this.id]||{};if(1==arguments.length){if(d.is(a,"object")){for(var f in a)a[J](f)&&this.data(f,a[f]);return this}return b("snap.data.get."+this.id,this,e[a],a),e[a]}return e[a]=c,b("snap.data.set."+this.id,this,c,a),this},a.removeData=function(a){return null==a?l[this.id]={}:l[this.id]&&delete l[this.id][a],this},a.outerSVG=a.toString=i(1),a.innerSVG=i()}(u.prototype),d.parse=function(a){var b=I.doc.createDocumentFragment(),c=!0,d=I.doc.createElement("div");if(a=K(a),a.match(/^\s*<\s*svg(?:\s|>)/)||(a="<svg>"+a+"</svg>",c=!1),d.innerHTML=a,a=d.getElementsByTagName("svg")[0])if(c)b=a;else for(;a.firstChild;)b.appendChild(a.firstChild);return d.innerHTML=S,new w(b)},w.prototype.select=u.prototype.select,w.prototype.selectAll=u.prototype.selectAll,d.fragment=function(){for(var a=Array.prototype.slice.call(arguments,0),b=I.doc.createDocumentFragment(),c=0,e=a.length;e>c;c++){var f=a[c];f.node&&f.node.nodeType&&b.appendChild(f.node),f.nodeType&&b.appendChild(f),"string"==typeof f&&b.appendChild(d.parse(f).node)}return new w(b)},function(a){a.el=function(a,b){return x(a,this.node).attr(b)},a.rect=function(a,b,c,d,e,g){var h;return null==g&&(g=e),f(a,"object")&&"x"in a?h=a:null!=a&&(h={x:a,y:b,width:c,height:d},null!=e&&(h.rx=e,h.ry=g)),this.el("rect",h)},a.circle=function(a,b,c){var d;return f(a,"object")&&"cx"in a?d=a:null!=a&&(d={cx:a,cy:b,r:c}),this.el("circle",d)},a.image=function(a,b,c,d,g){var h=x("image",this.node);if(f(a,"object")&&"src"in a)h.attr(a);else if(null!=a){var i={"xlink:href":a,preserveAspectRatio:"none"};null!=b&&null!=c&&(i.x=b,i.y=c),null!=d&&null!=g?(i.width=d,i.height=g):ib(a,function(){e(h.node,{width:this.offsetWidth,height:this.offsetHeight})}),e(h.node,i)}return h},a.ellipse=function(a,b,c,d){var e=x("ellipse",this.node);return f(a,"object")&&"cx"in a?e.attr(a):null!=a&&e.attr({cx:a,cy:b,rx:c,ry:d}),e},a.path=function(a){var b=x("path",this.node);return f(a,"object")&&!f(a,"array")?b.attr(a):a&&b.attr({d:a}),b
},a.group=a.g=function(b){var c=x("g",this.node);c.add=t;for(var d in a)a[J](d)&&(c[d]=a[d]);return 1==arguments.length&&b&&!b.type?c.attr(b):arguments.length&&c.add(Array.prototype.slice.call(arguments,0)),c},a.text=function(a,b,c){var d=x("text",this.node);return f(a,"object")?d.attr(a):null!=a&&d.attr({x:a,y:b,text:c||""}),d},a.line=function(a,b,c,d){var e=x("line",this.node);return f(a,"object")?e.attr(a):null!=a&&e.attr({x1:a,x2:c,y1:b,y2:d}),e},a.polyline=function(a){arguments.length>1&&(a=Array.prototype.slice.call(arguments,0));var b=x("polyline",this.node);return f(a,"object")&&!f(a,"array")?b.attr(a):null!=a&&b.attr({points:a}),b},a.polygon=function(a){arguments.length>1&&(a=Array.prototype.slice.call(arguments,0));var b=x("polygon",this.node);return f(a,"object")&&!f(a,"array")?b.attr(a):null!=a&&b.attr({points:a}),b},function(){a.gradient=function(a){return D(this.defs,a)},a.gradientLinear=function(a,b,c,d){return E(this.defs,a,b,c,d)},a.gradientRadial=function(a,b,c,d,e){return F(this.defs,a,b,c,d,e)},a.toString=function(){var a,b=I.doc.createDocumentFragment(),c=I.doc.createElement("div"),d=this.node.cloneNode(!0);return b.appendChild(c),c.appendChild(d),e(d,{xmlns:gb}),a=c.innerHTML,b.removeChild(b.firstChild),a},a.clear=function(){for(var a,b=this.node.firstChild;b;)a=b.nextSibling,"defs"!=b.tagName&&b.parentNode.removeChild(b),b=a}}()}(y.prototype),d.ajax=function(a,c,d,e){var g=new XMLHttpRequest,h=eb();if(g){if(f(c,"function"))e=d,d=c,c=null;else if(f(c,"object")){var i=[];for(var j in c)c.hasOwnProperty(j)&&i.push(encodeURIComponent(j)+"="+encodeURIComponent(c[j]));c=i.join("&")}return g.open(c?"POST":"GET",a,!0),g.setRequestHeader("X-Requested-With","XMLHttpRequest"),c&&g.setRequestHeader("Content-type","application/x-www-form-urlencoded"),d&&(b.once("snap.ajax."+h+".0",d),b.once("snap.ajax."+h+".200",d),b.once("snap.ajax."+h+".304",d)),g.onreadystatechange=function(){4==g.readyState&&b("snap.ajax."+h+"."+g.status,e,g)},4==g.readyState?g:(g.send(c),g)}},d.load=function(a,b,c){d.ajax(a,function(a){var e=d.parse(a.responseText);c?b.call(c,e):b(e)})},b.on("snap.util.attr.mask",function(a){if(a instanceof u||a instanceof w){if(b.stop(),a instanceof w&&1==a.node.childNodes.length&&(a=a.node.firstChild,r(this).appendChild(a),a=z(a)),"mask"==a.type)var c=a;else c=x("mask",r(this)),c.node.appendChild(a.node),!c.node.id&&e(c.node,{id:c.id});e(this.node,{mask:"url(#"+c.id+")"})}}),function(a){b.on("snap.util.attr.clip",a),b.on("snap.util.attr.clip-path",a),b.on("snap.util.attr.clipPath",a)}(function(a){if(a instanceof u||a instanceof w){if(b.stop(),"clipPath"==a.type)var c=a;else c=x("clipPath",r(this)),c.node.appendChild(a.node),!c.node.id&&e(c.node,{id:c.id});e(this.node,{"clip-path":"url(#"+c.id+")"})}}),b.on("snap.util.attr.fill",G("fill")),b.on("snap.util.attr.stroke",G("stroke"));var rb=/^([lr])(?:\(([^)]*)\))?(.*)$/i;b.on("snap.util.grad.parse",function(a){a=K(a);var b=a.match(rb);if(!b)return null;var c=b[1],d=b[2],e=b[3];return d=d.split(/\s*,\s*/).map(function(a){return+a==a?+a:a}),1==d.length&&0==d[0]&&(d=[]),e=e.split("-"),e=e.map(function(a){a=a.split(":");var b={color:a[0]};return a[1]&&(b.offset=a[1]),b}),{type:c,params:d,stops:e}}),b.on("snap.util.attr.d",function(a){b.stop(),f(a,"array")&&f(a[0],"array")&&(a=d.path.toString.call(a)),a=K(a),a.match(/[ruo]/i)&&(a=d.path.toAbsolute(a)),e(this.node,{d:a})})(-1),b.on("snap.util.attr.#text",function(a){b.stop(),a=K(a);for(var c=I.doc.createTextNode(a);this.node.firstChild;)this.node.removeChild(this.node.firstChild);this.node.appendChild(c)})(-1),b.on("snap.util.attr.path",function(a){b.stop(),this.attr({d:a})})(-1),b.on("snap.util.attr.viewBox",function(a){var c;c=f(a,"object")&&"x"in a?[a.x,a.y,a.width,a.height].join(" "):f(a,"array")?a.join(" "):a,e(this.node,{viewBox:c}),b.stop()})(-1),b.on("snap.util.attr.transform",function(a){this.transform(a),b.stop()})(-1),b.on("snap.util.attr.r",function(a){"rect"==this.type&&(b.stop(),e(this.node,{rx:a,ry:a}))})(-1),b.on("snap.util.attr.text",function(a){if("text"==this.type){for(var c=this.node,d=function(a){var b=e("tspan");if(f(a,"array"))for(var c=0;c<a.length;c++)b.appendChild(d(a[c]));else b.appendChild(I.doc.createTextNode(a));return b.normalize&&b.normalize(),b};c.firstChild;)c.removeChild(c.firstChild);for(var g=d(a);g.firstChild;)c.appendChild(g.firstChild)}b.stop()})(-1);var sb={"alignment-baseline":0,"baseline-shift":0,clip:0,"clip-path":0,"clip-rule":0,color:0,"color-interpolation":0,"color-interpolation-filters":0,"color-profile":0,"color-rendering":0,cursor:0,direction:0,display:0,"dominant-baseline":0,"enable-background":0,fill:0,"fill-opacity":0,"fill-rule":0,filter:0,"flood-color":0,"flood-opacity":0,font:0,"font-family":0,"font-size":0,"font-size-adjust":0,"font-stretch":0,"font-style":0,"font-variant":0,"font-weight":0,"glyph-orientation-horizontal":0,"glyph-orientation-vertical":0,"image-rendering":0,kerning:0,"letter-spacing":0,"lighting-color":0,marker:0,"marker-end":0,"marker-mid":0,"marker-start":0,mask:0,opacity:0,overflow:0,"pointer-events":0,"shape-rendering":0,"stop-color":0,"stop-opacity":0,stroke:0,"stroke-dasharray":0,"stroke-dashoffset":0,"stroke-linecap":0,"stroke-linejoin":0,"stroke-miterlimit":0,"stroke-opacity":0,"stroke-width":0,"text-anchor":0,"text-decoration":0,"text-rendering":0,"unicode-bidi":0,visibility:0,"word-spacing":0,"writing-mode":0};b.on("snap.util.attr",function(a){var c=b.nt(),d={};c=c.substring(c.lastIndexOf(".")+1),d[c]=a;var f=c.replace(/-(\w)/gi,function(a,b){return b.toUpperCase()}),g=c.replace(/[A-Z]/g,function(a){return"-"+a.toLowerCase()});sb[J](g)?this.node.style[f]=null==a?S:a:e(this.node,d)}),b.on("snap.util.getattr.transform",function(){return b.stop(),this.transform()})(-1),function(){function a(a){return function(){b.stop();var c=I.doc.defaultView.getComputedStyle(this.node,null).getPropertyValue("marker-"+a);return"none"==c?c:d(I.doc.getElementById(c.match(W)[1]))}}function c(a){return function(c){b.stop();var d="marker"+a.charAt(0).toUpperCase()+a.substring(1);if(""==c||!c)return this.node.style[d]="none",void 0;if("marker"==c.type){var f=c.node.id;return f||e(c.node,{id:c.id}),this.node.style[d]="url(#"+f+")",void 0}}}b.on("snap.util.getattr.marker-end",a("end"))(-1),b.on("snap.util.getattr.markerEnd",a("end"))(-1),b.on("snap.util.getattr.marker-start",a("start"))(-1),b.on("snap.util.getattr.markerStart",a("start"))(-1),b.on("snap.util.getattr.marker-mid",a("mid"))(-1),b.on("snap.util.getattr.markerMid",a("mid"))(-1),b.on("snap.util.attr.marker-end",c("end"))(-1),b.on("snap.util.attr.markerEnd",c("end"))(-1),b.on("snap.util.attr.marker-start",c("start"))(-1),b.on("snap.util.attr.markerStart",c("start"))(-1),b.on("snap.util.attr.marker-mid",c("mid"))(-1),b.on("snap.util.attr.markerMid",c("mid"))(-1)}(),b.on("snap.util.getattr.r",function(){return"rect"==this.type&&e(this.node,"rx")==e(this.node,"ry")?(b.stop(),e(this.node,"rx")):void 0})(-1),b.on("snap.util.getattr.text",function(){if("text"==this.type||"tspan"==this.type){b.stop();var a=H(this.node);return 1==a.length?a[0]:a}})(-1),b.on("snap.util.getattr.#text",function(){return this.node.textContent})(-1),b.on("snap.util.getattr.viewBox",function(){b.stop();var a=e(this.node,"viewBox").split(Y);return d._.box(+a[0],+a[1],+a[2],+a[3])})(-1),b.on("snap.util.getattr.points",function(){var a=e(this.node,"points");return b.stop(),a.split(Y)}),b.on("snap.util.getattr.path",function(){var a=e(this.node,"d");return b.stop(),a}),b.on("snap.util.getattr",function(){var a=b.nt();a=a.substring(a.lastIndexOf(".")+1);var c=a.replace(/[A-Z]/g,function(a){return"-"+a.toLowerCase()});return sb[J](c)?I.doc.defaultView.getComputedStyle(this.node,null).getPropertyValue(c):e(this.node,a)});var tb=function(a){var b=a.getBoundingClientRect(),c=a.ownerDocument,d=c.body,e=c.documentElement,f=e.clientTop||d.clientTop||0,h=e.clientLeft||d.clientLeft||0,i=b.top+(g.win.pageYOffset||e.scrollTop||d.scrollTop)-f,j=b.left+(g.win.pageXOffset||e.scrollLeft||d.scrollLeft)-h;return{y:i,x:j}};return d.getElementByPoint=function(a,b){var c=this,d=(c.canvas,I.doc.elementFromPoint(a,b));if(I.win.opera&&"svg"==d.tagName){var e=tb(d),f=d.createSVGRect();f.x=a-e.x,f.y=b-e.y,f.width=f.height=1;var g=d.getIntersectionList(f,null);g.length&&(d=g[g.length-1])}return d?z(d):null},d.plugin=function(a){a(d,u,y,I)},I.win.Snap=d,d}();return d.plugin(function(a,b){function c(a){var b=c.ps=c.ps||{};return b[a]?b[a].sleep=100:b[a]={sleep:100},setTimeout(function(){for(var c in b)b[L](c)&&c!=a&&(b[c].sleep--,!b[c].sleep&&delete b[c])}),b[a]}function d(a,b,c,d){return null==a&&(a=b=c=d=0),null==b&&(b=a.y,c=a.width,d=a.height,a=a.x),{x:a,y:b,width:c,w:c,height:d,h:d,x2:a+c,y2:b+d,cx:a+c/2,cy:b+d/2,r1:O.min(c,d)/2,r2:O.max(c,d)/2,r0:O.sqrt(c*c+d*d)/2,path:w(a,b,c,d),vb:[a,b,c,d].join(" ")}}function e(){return this.join(",").replace(M,"$1")}function f(a){var b=K(a);return b.toString=e,b}function g(a,b,c,d,e,f,g,h,j){return null==j?n(a,b,c,d,e,f,g,h):i(a,b,c,d,e,f,g,h,o(a,b,c,d,e,f,g,h,j))}function h(c,d){function e(a){return+(+a).toFixed(3)}return a._.cacher(function(a,f,h){a instanceof b&&(a=a.attr("d")),a=F(a);for(var j,k,l,m,n,o="",p={},q=0,r=0,s=a.length;s>r;r++){if(l=a[r],"M"==l[0])j=+l[1],k=+l[2];else{if(m=g(j,k,l[1],l[2],l[3],l[4],l[5],l[6]),q+m>f){if(d&&!p.start){if(n=g(j,k,l[1],l[2],l[3],l[4],l[5],l[6],f-q),o+=["C"+e(n.start.x),e(n.start.y),e(n.m.x),e(n.m.y),e(n.x),e(n.y)],h)return o;p.start=o,o=["M"+e(n.x),e(n.y)+"C"+e(n.n.x),e(n.n.y),e(n.end.x),e(n.end.y),e(l[5]),e(l[6])].join(),q+=m,j=+l[5],k=+l[6];continue}if(!c&&!d)return n=g(j,k,l[1],l[2],l[3],l[4],l[5],l[6],f-q)}q+=m,j=+l[5],k=+l[6]}o+=l.shift()+l}return p.end=o,n=c?q:d?p:i(j,k,l[0],l[1],l[2],l[3],l[4],l[5],1)},null,a._.clone)}function i(a,b,c,d,e,f,g,h,i){var j=1-i,k=S(j,3),l=S(j,2),m=i*i,n=m*i,o=k*a+3*l*i*c+3*j*i*i*e+n*g,p=k*b+3*l*i*d+3*j*i*i*f+n*h,q=a+2*i*(c-a)+m*(e-2*c+a),r=b+2*i*(d-b)+m*(f-2*d+b),s=c+2*i*(e-c)+m*(g-2*e+c),t=d+2*i*(f-d)+m*(h-2*f+d),u=j*a+i*c,v=j*b+i*d,w=j*e+i*g,x=j*f+i*h,y=90-180*O.atan2(q-s,r-t)/P;return{x:o,y:p,m:{x:q,y:r},n:{x:s,y:t},start:{x:u,y:v},end:{x:w,y:x},alpha:y}}function j(b,c,e,f,g,h,i,j){a.is(b,"array")||(b=[b,c,e,f,g,h,i,j]);var k=E.apply(null,b);return d(k.min.x,k.min.y,k.max.x-k.min.x,k.max.y-k.min.y)}function k(a,b,c){return b>=a.x&&b<=a.x+a.width&&c>=a.y&&c<=a.y+a.height}function l(a,b){return a=d(a),b=d(b),k(b,a.x,a.y)||k(b,a.x2,a.y)||k(b,a.x,a.y2)||k(b,a.x2,a.y2)||k(a,b.x,b.y)||k(a,b.x2,b.y)||k(a,b.x,b.y2)||k(a,b.x2,b.y2)||(a.x<b.x2&&a.x>b.x||b.x<a.x2&&b.x>a.x)&&(a.y<b.y2&&a.y>b.y||b.y<a.y2&&b.y>a.y)}function m(a,b,c,d,e){var f=-3*b+9*c-9*d+3*e,g=a*f+6*b-12*c+6*d;return a*g-3*b+3*c}function n(a,b,c,d,e,f,g,h,i){null==i&&(i=1),i=i>1?1:0>i?0:i;for(var j=i/2,k=12,l=[-.1252,.1252,-.3678,.3678,-.5873,.5873,-.7699,.7699,-.9041,.9041,-.9816,.9816],n=[.2491,.2491,.2335,.2335,.2032,.2032,.1601,.1601,.1069,.1069,.0472,.0472],o=0,p=0;k>p;p++){var q=j*l[p]+j,r=m(q,a,c,e,g),s=m(q,b,d,f,h),t=r*r+s*s;o+=n[p]*O.sqrt(t)}return j*o}function o(a,b,c,d,e,f,g,h,i){if(!(0>i||n(a,b,c,d,e,f,g,h)<i)){var j,k=1,l=k/2,m=k-l,o=.01;for(j=n(a,b,c,d,e,f,g,h,m);T(j-i)>o;)l/=2,m+=(i>j?1:-1)*l,j=n(a,b,c,d,e,f,g,h,m);return m}}function p(a,b,c,d,e,f,g,h){if(!(R(a,c)<Q(e,g)||Q(a,c)>R(e,g)||R(b,d)<Q(f,h)||Q(b,d)>R(f,h))){var i=(a*d-b*c)*(e-g)-(a-c)*(e*h-f*g),j=(a*d-b*c)*(f-h)-(b-d)*(e*h-f*g),k=(a-c)*(f-h)-(b-d)*(e-g);if(k){var l=i/k,m=j/k,n=+l.toFixed(2),o=+m.toFixed(2);if(!(n<+Q(a,c).toFixed(2)||n>+R(a,c).toFixed(2)||n<+Q(e,g).toFixed(2)||n>+R(e,g).toFixed(2)||o<+Q(b,d).toFixed(2)||o>+R(b,d).toFixed(2)||o<+Q(f,h).toFixed(2)||o>+R(f,h).toFixed(2)))return{x:l,y:m}}}}function q(a,b,c){var d=j(a),e=j(b);if(!l(d,e))return c?0:[];for(var f=n.apply(0,a),g=n.apply(0,b),h=~~(f/5),k=~~(g/5),m=[],o=[],q={},r=c?0:[],s=0;h+1>s;s++){var t=i.apply(0,a.concat(s/h));m.push({x:t.x,y:t.y,t:s/h})}for(s=0;k+1>s;s++)t=i.apply(0,b.concat(s/k)),o.push({x:t.x,y:t.y,t:s/k});for(s=0;h>s;s++)for(var u=0;k>u;u++){var v=m[s],w=m[s+1],x=o[u],y=o[u+1],z=T(w.x-v.x)<.001?"y":"x",A=T(y.x-x.x)<.001?"y":"x",B=p(v.x,v.y,w.x,w.y,x.x,x.y,y.x,y.y);if(B){if(q[B.x.toFixed(4)]==B.y.toFixed(4))continue;q[B.x.toFixed(4)]=B.y.toFixed(4);var C=v.t+T((B[z]-v[z])/(w[z]-v[z]))*(w.t-v.t),D=x.t+T((B[A]-x[A])/(y[A]-x[A]))*(y.t-x.t);C>=0&&1>=C&&D>=0&&1>=D&&(c?r++:r.push({x:B.x,y:B.y,t1:C,t2:D}))}}return r}function r(a,b){return t(a,b)}function s(a,b){return t(a,b,1)}function t(a,b,c){a=F(a),b=F(b);for(var d,e,f,g,h,i,j,k,l,m,n=c?0:[],o=0,p=a.length;p>o;o++){var r=a[o];if("M"==r[0])d=h=r[1],e=i=r[2];else{"C"==r[0]?(l=[d,e].concat(r.slice(1)),d=l[6],e=l[7]):(l=[d,e,d,e,h,i,h,i],d=h,e=i);for(var s=0,t=b.length;t>s;s++){var u=b[s];if("M"==u[0])f=j=u[1],g=k=u[2];else{"C"==u[0]?(m=[f,g].concat(u.slice(1)),f=m[6],g=m[7]):(m=[f,g,f,g,j,k,j,k],f=j,g=k);var v=q(l,m,c);if(c)n+=v;else{for(var w=0,x=v.length;x>w;w++)v[w].segment1=o,v[w].segment2=s,v[w].bez1=l,v[w].bez2=m;n=n.concat(v)}}}}}return n}function u(a,b,c){var d=v(a);return k(d,b,c)&&1==t(a,[["M",b,c],["H",d.x2+10]],1)%2}function v(a){var b=c(a);if(b.bbox)return K(b.bbox);if(!a)return d();a=F(a);for(var e,f=0,g=0,h=[],i=[],j=0,k=a.length;k>j;j++)if(e=a[j],"M"==e[0])f=e[1],g=e[2],h.push(f),i.push(g);else{var l=E(f,g,e[1],e[2],e[3],e[4],e[5],e[6]);h=h.concat(l.min.x,l.max.x),i=i.concat(l.min.y,l.max.y),f=e[5],g=e[6]}var m=Q.apply(0,h),n=Q.apply(0,i),o=R.apply(0,h),p=R.apply(0,i),q=d(m,n,o-m,p-n);return b.bbox=K(q),q}function w(a,b,c,d,f){if(f)return[["M",a+f,b],["l",c-2*f,0],["a",f,f,0,0,1,f,f],["l",0,d-2*f],["a",f,f,0,0,1,-f,f],["l",2*f-c,0],["a",f,f,0,0,1,-f,-f],["l",0,2*f-d],["a",f,f,0,0,1,f,-f],["z"]];var g=[["M",a,b],["l",c,0],["l",0,d],["l",-c,0],["z"]];return g.toString=e,g}function x(a,b,c,d,f){if(null==f&&null==d&&(d=c),null!=f)var g=Math.PI/180,h=a+c*Math.cos(-d*g),i=a+c*Math.cos(-f*g),j=b+c*Math.sin(-d*g),k=b+c*Math.sin(-f*g),l=[["M",h,j],["A",c,c,0,+(f-d>180),0,i,k]];else l=[["M",a,b],["m",0,-d],["a",c,d,0,1,1,0,2*d],["a",c,d,0,1,1,0,-2*d],["z"]];return l.toString=e,l}function y(b){var d=c(b),g=String.prototype.toLowerCase;if(d.rel)return f(d.rel);a.is(b,"array")&&a.is(b&&b[0],"array")||(b=a.parsePathString(b));var h=[],i=0,j=0,k=0,l=0,m=0;"M"==b[0][0]&&(i=b[0][1],j=b[0][2],k=i,l=j,m++,h.push(["M",i,j]));for(var n=m,o=b.length;o>n;n++){var p=h[n]=[],q=b[n];if(q[0]!=g.call(q[0]))switch(p[0]=g.call(q[0]),p[0]){case"a":p[1]=q[1],p[2]=q[2],p[3]=q[3],p[4]=q[4],p[5]=q[5],p[6]=+(q[6]-i).toFixed(3),p[7]=+(q[7]-j).toFixed(3);break;case"v":p[1]=+(q[1]-j).toFixed(3);break;case"m":k=q[1],l=q[2];default:for(var r=1,s=q.length;s>r;r++)p[r]=+(q[r]-(r%2?i:j)).toFixed(3)}else{p=h[n]=[],"m"==q[0]&&(k=q[1]+i,l=q[2]+j);for(var t=0,u=q.length;u>t;t++)h[n][t]=q[t]}var v=h[n].length;switch(h[n][0]){case"z":i=k,j=l;break;case"h":i+=+h[n][v-1];break;case"v":j+=+h[n][v-1];break;default:i+=+h[n][v-2],j+=+h[n][v-1]}}return h.toString=e,d.rel=f(h),h}function z(b){var d=c(b);if(d.abs)return f(d.abs);if(J(b,"array")&&J(b&&b[0],"array")||(b=a.parsePathString(b)),!b||!b.length)return[["M",0,0]];var g,h=[],i=0,j=0,k=0,l=0,m=0;"M"==b[0][0]&&(i=+b[0][1],j=+b[0][2],k=i,l=j,m++,h[0]=["M",i,j]);for(var n,o,p=3==b.length&&"M"==b[0][0]&&"R"==b[1][0].toUpperCase()&&"Z"==b[2][0].toUpperCase(),q=m,r=b.length;r>q;q++){if(h.push(n=[]),o=b[q],g=o[0],g!=g.toUpperCase())switch(n[0]=g.toUpperCase(),n[0]){case"A":n[1]=o[1],n[2]=o[2],n[3]=o[3],n[4]=o[4],n[5]=o[5],n[6]=+(o[6]+i),n[7]=+(o[7]+j);break;case"V":n[1]=+o[1]+j;break;case"H":n[1]=+o[1]+i;break;case"R":for(var s=[i,j].concat(o.slice(1)),t=2,u=s.length;u>t;t++)s[t]=+s[t]+i,s[++t]=+s[t]+j;h.pop(),h=h.concat(H(s,p));break;case"O":h.pop(),s=x(i,j,o[1],o[2]),s.push(s[0]),h=h.concat(s);break;case"U":h.pop(),h=h.concat(x(i,j,o[1],o[2],o[3])),n=["U"].concat(h[h.length-1].slice(-2));break;case"M":k=+o[1]+i,l=+o[2]+j;default:for(t=1,u=o.length;u>t;t++)n[t]=+o[t]+(t%2?i:j)}else if("R"==g)s=[i,j].concat(o.slice(1)),h.pop(),h=h.concat(H(s,p)),n=["R"].concat(o.slice(-2));else if("O"==g)h.pop(),s=x(i,j,o[1],o[2]),s.push(s[0]),h=h.concat(s);else if("U"==g)h.pop(),h=h.concat(x(i,j,o[1],o[2],o[3])),n=["U"].concat(h[h.length-1].slice(-2));else for(var v=0,w=o.length;w>v;v++)n[v]=o[v];if(g=g.toUpperCase(),"O"!=g)switch(n[0]){case"Z":i=k,j=l;break;case"H":i=n[1];break;case"V":j=n[1];break;case"M":k=n[n.length-2],l=n[n.length-1];default:i=n[n.length-2],j=n[n.length-1]}}return h.toString=e,d.abs=f(h),h}function A(a,b,c,d){return[a,b,c,d,c,d]}function B(a,b,c,d,e,f){var g=1/3,h=2/3;return[g*a+h*c,g*b+h*d,g*e+h*c,g*f+h*d,e,f]}function C(b,c,d,e,f,g,h,i,j,k){var l,m=120*P/180,n=P/180*(+f||0),o=[],p=a._.cacher(function(a,b,c){var d=a*O.cos(c)-b*O.sin(c),e=a*O.sin(c)+b*O.cos(c);return{x:d,y:e}});if(k)y=k[0],z=k[1],w=k[2],x=k[3];else{l=p(b,c,-n),b=l.x,c=l.y,l=p(i,j,-n),i=l.x,j=l.y;var q=(O.cos(P/180*f),O.sin(P/180*f),(b-i)/2),r=(c-j)/2,s=q*q/(d*d)+r*r/(e*e);s>1&&(s=O.sqrt(s),d=s*d,e=s*e);var t=d*d,u=e*e,v=(g==h?-1:1)*O.sqrt(T((t*u-t*r*r-u*q*q)/(t*r*r+u*q*q))),w=v*d*r/e+(b+i)/2,x=v*-e*q/d+(c+j)/2,y=O.asin(((c-x)/e).toFixed(9)),z=O.asin(((j-x)/e).toFixed(9));y=w>b?P-y:y,z=w>i?P-z:z,0>y&&(y=2*P+y),0>z&&(z=2*P+z),h&&y>z&&(y-=2*P),!h&&z>y&&(z-=2*P)}var A=z-y;if(T(A)>m){var B=z,D=i,E=j;z=y+m*(h&&z>y?1:-1),i=w+d*O.cos(z),j=x+e*O.sin(z),o=C(i,j,d,e,f,0,h,D,E,[z,B,w,x])}A=z-y;var F=O.cos(y),G=O.sin(y),H=O.cos(z),I=O.sin(z),J=O.tan(A/4),K=4/3*d*J,L=4/3*e*J,M=[b,c],N=[b+K*G,c-L*F],Q=[i+K*I,j-L*H],R=[i,j];if(N[0]=2*M[0]-N[0],N[1]=2*M[1]-N[1],k)return[N,Q,R].concat(o);o=[N,Q,R].concat(o).join().split(",");for(var S=[],U=0,V=o.length;V>U;U++)S[U]=U%2?p(o[U-1],o[U],n).y:p(o[U],o[U+1],n).x;return S}function D(a,b,c,d,e,f,g,h,i){var j=1-i;return{x:S(j,3)*a+3*S(j,2)*i*c+3*j*i*i*e+S(i,3)*g,y:S(j,3)*b+3*S(j,2)*i*d+3*j*i*i*f+S(i,3)*h}}function E(a,b,c,d,e,f,g,h){var i,j=e-2*c+a-(g-2*e+c),k=2*(c-a)-2*(e-c),l=a-c,m=(-k+O.sqrt(k*k-4*j*l))/2/j,n=(-k-O.sqrt(k*k-4*j*l))/2/j,o=[b,h],p=[a,g];return T(m)>"1e12"&&(m=.5),T(n)>"1e12"&&(n=.5),m>0&&1>m&&(i=D(a,b,c,d,e,f,g,h,m),p.push(i.x),o.push(i.y)),n>0&&1>n&&(i=D(a,b,c,d,e,f,g,h,n),p.push(i.x),o.push(i.y)),j=f-2*d+b-(h-2*f+d),k=2*(d-b)-2*(f-d),l=b-d,m=(-k+O.sqrt(k*k-4*j*l))/2/j,n=(-k-O.sqrt(k*k-4*j*l))/2/j,T(m)>"1e12"&&(m=.5),T(n)>"1e12"&&(n=.5),m>0&&1>m&&(i=D(a,b,c,d,e,f,g,h,m),p.push(i.x),o.push(i.y)),n>0&&1>n&&(i=D(a,b,c,d,e,f,g,h,n),p.push(i.x),o.push(i.y)),{min:{x:Q.apply(0,p),y:Q.apply(0,o)},max:{x:R.apply(0,p),y:R.apply(0,o)}}}function F(a,b){var d=!b&&c(a);if(!b&&d.curve)return f(d.curve);for(var e=z(a),g=b&&z(b),h={x:0,y:0,bx:0,by:0,X:0,Y:0,qx:null,qy:null},i={x:0,y:0,bx:0,by:0,X:0,Y:0,qx:null,qy:null},j=(function(a,b){var c,d;if(!a)return["C",b.x,b.y,b.x,b.y,b.x,b.y];switch(!(a[0]in{T:1,Q:1})&&(b.qx=b.qy=null),a[0]){case"M":b.X=a[1],b.Y=a[2];break;case"A":a=["C"].concat(C.apply(0,[b.x,b.y].concat(a.slice(1))));break;case"S":c=b.x+(b.x-(b.bx||b.x)),d=b.y+(b.y-(b.by||b.y)),a=["C",c,d].concat(a.slice(1));break;case"T":b.qx=b.x+(b.x-(b.qx||b.x)),b.qy=b.y+(b.y-(b.qy||b.y)),a=["C"].concat(B(b.x,b.y,b.qx,b.qy,a[1],a[2]));break;case"Q":b.qx=a[1],b.qy=a[2],a=["C"].concat(B(b.x,b.y,a[1],a[2],a[3],a[4]));break;case"L":a=["C"].concat(A(b.x,b.y,a[1],a[2]));break;case"H":a=["C"].concat(A(b.x,b.y,a[1],b.y));break;case"V":a=["C"].concat(A(b.x,b.y,b.x,a[1]));break;case"Z":a=["C"].concat(A(b.x,b.y,b.X,b.Y))}return a}),k=function(a,b){if(a[b].length>7){a[b].shift();for(var c=a[b];c.length;)a.splice(b++,0,["C"].concat(c.splice(0,6)));a.splice(b,1),n=R(e.length,g&&g.length||0)}},l=function(a,b,c,d,f){a&&b&&"M"==a[f][0]&&"M"!=b[f][0]&&(b.splice(f,0,["M",d.x,d.y]),c.bx=0,c.by=0,c.x=a[f][1],c.y=a[f][2],n=R(e.length,g&&g.length||0))},m=0,n=R(e.length,g&&g.length||0);n>m;m++){e[m]=j(e[m],h),k(e,m),g&&(g[m]=j(g[m],i)),g&&k(g,m),l(e,g,h,i,m),l(g,e,i,h,m);var o=e[m],p=g&&g[m],q=o.length,r=g&&p.length;h.x=o[q-2],h.y=o[q-1],h.bx=N(o[q-4])||h.x,h.by=N(o[q-3])||h.y,i.bx=g&&(N(p[r-4])||i.x),i.by=g&&(N(p[r-3])||i.y),i.x=g&&p[r-2],i.y=g&&p[r-1]}return g||(d.curve=f(e)),g?[e,g]:e}function G(a,b){if(!b)return a;var c,d,e,f,g,h,i;for(a=F(a),e=0,g=a.length;g>e;e++)for(i=a[e],f=1,h=i.length;h>f;f+=2)c=b.x(i[f],i[f+1]),d=b.y(i[f],i[f+1]),i[f]=c,i[f+1]=d;return a}function H(a,b){for(var c=[],d=0,e=a.length;e-2*!b>d;d+=2){var f=[{x:+a[d-2],y:+a[d-1]},{x:+a[d],y:+a[d+1]},{x:+a[d+2],y:+a[d+3]},{x:+a[d+4],y:+a[d+5]}];b?d?e-4==d?f[3]={x:+a[0],y:+a[1]}:e-2==d&&(f[2]={x:+a[0],y:+a[1]},f[3]={x:+a[2],y:+a[3]}):f[0]={x:+a[e-2],y:+a[e-1]}:e-4==d?f[3]=f[2]:d||(f[0]={x:+a[d],y:+a[d+1]}),c.push(["C",(-f[0].x+6*f[1].x+f[2].x)/6,(-f[0].y+6*f[1].y+f[2].y)/6,(f[1].x+6*f[2].x-f[3].x)/6,(f[1].y+6*f[2].y-f[3].y)/6,f[2].x,f[2].y])}return c}var I=b.prototype,J=a.is,K=a._.clone,L="hasOwnProperty",M=/,?([a-z]),?/gi,N=parseFloat,O=Math,P=O.PI,Q=O.min,R=O.max,S=O.pow,T=O.abs,U=h(1),V=h(),W=h(0,1),X=a._unit2px,Y={path:function(a){return a.attr("path")},circle:function(a){var b=X(a);return x(b.cx,b.cy,b.r)},ellipse:function(a){var b=X(a);return x(b.cx,b.cy,b.rx,b.ry)},rect:function(a){var b=X(a);return w(b.x,b.y,b.width,b.height,b.rx,b.ry)},image:function(a){var b=X(a);return w(b.x,b.y,b.width,b.height)},text:function(a){var b=a.node.getBBox();return w(b.x,b.y,b.width,b.height)},g:function(a){var b=a.node.getBBox();return w(b.x,b.y,b.width,b.height)},symbol:function(a){var b=a.getBBox();return w(b.x,b.y,b.width,b.height)},polyline:function(a){return"M"+a.attr("points")},polygon:function(a){return"M"+a.attr("points")+"z"},svg:function(a){var b=a.node.getBBox();return w(b.x,b.y,b.width,b.height)},deflt:function(a){var b=a.node.getBBox();return w(b.x,b.y,b.width,b.height)}};a.path=c,a.path.getTotalLength=U,a.path.getPointAtLength=V,a.path.getSubpath=function(a,b,c){if(this.getTotalLength(a)-c<1e-6)return W(a,b).end;var d=W(a,c,1);return b?W(d,b).end:d},I.getTotalLength=function(){return this.node.getTotalLength?this.node.getTotalLength():void 0},I.getPointAtLength=function(a){return V(this.attr("d"),a)},I.getSubpath=function(b,c){return a.path.getSubpath(this.attr("d"),b,c)},a._.box=d,a.path.findDotsAtSegment=i,a.path.bezierBBox=j,a.path.isPointInsideBBox=k,a.path.isBBoxIntersect=l,a.path.intersection=r,a.path.intersectionNumber=s,a.path.isPointInside=u,a.path.getBBox=v,a.path.get=Y,a.path.toRelative=y,a.path.toAbsolute=z,a.path.toCubic=F,a.path.map=G,a.path.toString=e,a.path.clone=f}),d.plugin(function(a){var b=Math.max,c=Math.min,d=function(a){if(this.items=[],this.length=0,this.type="set",a)for(var b=0,c=a.length;c>b;b++)a[b]&&(this[this.items.length]=this.items[this.items.length]=a[b],this.length++)},e=d.prototype;e.push=function(){for(var a,b,c=0,d=arguments.length;d>c;c++)a=arguments[c],a&&(b=this.items.length,this[b]=this.items[b]=a,this.length++);return this},e.pop=function(){return this.length&&delete this[this.length--],this.items.pop()},e.forEach=function(a,b){for(var c=0,d=this.items.length;d>c;c++)if(a.call(b,this.items[c],c)===!1)return this;return this},e.remove=function(){for(;this.length;)this.pop().remove();return this},e.attr=function(a){for(var b=0,c=this.items.length;c>b;b++)this.items[b].attr(a);return this},e.clear=function(){for(;this.length;)this.pop()},e.splice=function(a,e){a=0>a?b(this.length+a,0):a,e=b(0,c(this.length-a,e));var f,g=[],h=[],i=[];for(f=2;f<arguments.length;f++)i.push(arguments[f]);for(f=0;e>f;f++)h.push(this[a+f]);for(;f<this.length-a;f++)g.push(this[a+f]);var j=i.length;for(f=0;f<j+g.length;f++)this.items[a+f]=this[a+f]=j>f?i[f]:g[f-j];for(f=this.items.length=this.length-=e-j;this[f];)delete this[f++];return new d(h)},e.exclude=function(a){for(var b=0,c=this.length;c>b;b++)if(this[b]==a)return this.splice(b,1),!0;return!1},e.insertAfter=function(a){for(var b=this.items.length;b--;)this.items[b].insertAfter(a);return this},e.getBBox=function(){for(var a=[],d=[],e=[],f=[],g=this.items.length;g--;)if(!this.items[g].removed){var h=this.items[g].getBBox();a.push(h.x),d.push(h.y),e.push(h.x+h.width),f.push(h.y+h.height)}return a=c.apply(0,a),d=c.apply(0,d),e=b.apply(0,e),f=b.apply(0,f),{x:a,y:d,x2:e,y2:f,width:e-a,height:f-d,cx:a+(e-a)/2,cy:d+(f-d)/2}},e.clone=function(a){a=new d;for(var b=0,c=this.items.length;c>b;b++)a.push(this.items[b].clone());return a},e.toString=function(){return"Snap‘s set"},e.type="set",a.set=function(){var a=new d;return arguments.length&&a.push.apply(a,Array.prototype.slice.call(arguments,0)),a}}),d.plugin(function(a,b){function c(a){var b=a[0];switch(b.toLowerCase()){case"t":return[b,0,0];case"m":return[b,1,0,0,1,0,0];case"r":return 4==a.length?[b,0,a[2],a[3]]:[b,0];case"s":return 5==a.length?[b,1,1,a[3],a[4]]:3==a.length?[b,1,1]:[b,1]}}function d(b,d,e){d=l(d).replace(/\.{3}|\u2026/g,b),b=a.parseTransformString(b)||[],d=a.parseTransformString(d)||[];for(var f,g,j,k,m=Math.max(b.length,d.length),n=[],o=[],p=0;m>p;p++){if(j=b[p]||c(d[p]),k=d[p]||c(j),j[0]!=k[0]||"r"==j[0].toLowerCase()&&(j[2]!=k[2]||j[3]!=k[3])||"s"==j[0].toLowerCase()&&(j[3]!=k[3]||j[4]!=k[4])){b=a._.transform2matrix(b,e()),d=a._.transform2matrix(d,e()),n=[["m",b.a,b.b,b.c,b.d,b.e,b.f]],o=[["m",d.a,d.b,d.c,d.d,d.e,d.f]];break}for(n[p]=[],o[p]=[],f=0,g=Math.max(j.length,k.length);g>f;f++)f in j&&(n[p][f]=j[f]),f in k&&(o[p][f]=k[f])}return{from:i(n),to:i(o),f:h(n)}}function e(a){return a}function f(a){return function(b){return+b.toFixed(3)+a}}function g(b){return a.rgb(b[0],b[1],b[2])}function h(a){var b,c,d,e,f,g,h=0,i=[];for(b=0,c=a.length;c>b;b++){for(f="[",g=['"'+a[b][0]+'"'],d=1,e=a[b].length;e>d;d++)g[d]="val["+h++ +"]";f+=g+"]",i[b]=f}return Function("val","return Snap.path.toString.call(["+i+"])")}function i(a){for(var b=[],c=0,d=a.length;d>c;c++)for(var e=1,f=a[c].length;f>e;e++)b.push(a[c][e]);return b}var j={},k=/[a-z]+$/i,l=String;j.stroke=j.fill="colour",b.prototype.equal=function(b,c){var m,n,o=l(this.attr(b)||""),p=this;if(o==+o&&c==+c)return{from:+o,to:+c,f:e};if("colour"==j[b])return m=a.color(o),n=a.color(c),{from:[m.r,m.g,m.b,m.opacity],to:[n.r,n.g,n.b,n.opacity],f:g};if("transform"==b||"gradientTransform"==b||"patternTransform"==b)return c instanceof a.Matrix&&(c=c.toTransformString()),a._.rgTransform.test(c)||(c=a._.svgTransform2string(c)),d(o,c,function(){return p.getBBox(1)});if("d"==b||"path"==b)return m=a.path.toCubic(o,c),{from:i(m[0]),to:i(m[1]),f:h(m[0])};if("points"==b)return m=l(o).split(","),n=l(c).split(","),{from:m,to:n,f:function(a){return a}};var q=o.match(k),r=l(c).match(k);return q&&q==r?{from:parseFloat(o),to:parseFloat(c),f:f(q)}:{from:this.asPX(b),to:this.asPX(b,c),f:e}}}),d.plugin(function(a,c,d,e){for(var f=c.prototype,g="hasOwnProperty",h=("createTouch"in e.doc),i=["click","dblclick","mousedown","mousemove","mouseout","mouseover","mouseup","touchstart","touchmove","touchend","touchcancel"],j={mousedown:"touchstart",mousemove:"touchmove",mouseup:"touchend"},k=function(a){var b="y"==a?"scrollTop":"scrollLeft";return e.doc.documentElement[b]||e.doc.body[b]},l=function(){this.returnValue=!1},m=function(){return this.originalEvent.preventDefault()},n=function(){this.cancelBubble=!0},o=function(){return this.originalEvent.stopPropagation()},p=function(){return e.doc.addEventListener?function(a,b,c,d){var e=h&&j[b]?j[b]:b,f=function(e){var f=k("y"),i=k("x"),l=e.clientX+i,n=e.clientY+f;if(h&&j[g](b))for(var p=0,q=e.targetTouches&&e.targetTouches.length;q>p;p++)if(e.targetTouches[p].target==a){var r=e;e=e.targetTouches[p],e.originalEvent=r,e.preventDefault=m,e.stopPropagation=o;break}return c.call(d,e,l,n)};return a.addEventListener(e,f,!1),function(){return a.removeEventListener(e,f,!1),!0}}:e.doc.attachEvent?function(a,b,c,d){var f=function(a){a=a||e.win.event;var b=k("y"),f=k("x"),g=a.clientX+f,h=a.clientY+b;return a.preventDefault=a.preventDefault||l,a.stopPropagation=a.stopPropagation||n,c.call(d,a,g,h)};a.attachEvent("on"+b,f);var g=function(){return a.detachEvent("on"+b,f),!0};return g}:void 0}(),q=[],r=function(c){for(var d,e=c.clientX,f=c.clientY,g=k("y"),i=k("x"),j=q.length;j--;){if(d=q[j],h){for(var l,m=c.touches.length;m--;)if(l=c.touches[m],l.identifier==d.el._drag.id){e=l.clientX,f=l.clientY,(c.originalEvent?c.originalEvent:c).preventDefault();break}}else c.preventDefault();var n=d.el.node;a._.glob,n.nextSibling,n.parentNode,n.style.display,e+=i,f+=g,b("snap.drag.move."+d.el.id,d.move_scope||d.el,e-d.el._drag.x,f-d.el._drag.y,e,f,c)}},s=function(c){a.unmousemove(r).unmouseup(s);for(var d,e=q.length;e--;)d=q[e],d.el._drag={},b("snap.drag.end."+d.el.id,d.end_scope||d.start_scope||d.move_scope||d.el,c);q=[]},t=i.length;t--;)!function(b){a[b]=f[b]=function(c,d){return a.is(c,"function")&&(this.events=this.events||[],this.events.push({name:b,f:c,unbind:p(this.shape||this.node||e.doc,b,c,d||this)})),this},a["un"+b]=f["un"+b]=function(a){for(var c=this.events||[],d=c.length;d--;)if(c[d].name==b&&(c[d].f==a||!a))return c[d].unbind(),c.splice(d,1),!c.length&&delete this.events,this;return this}}(i[t]);f.hover=function(a,b,c,d){return this.mouseover(a,c).mouseout(b,d||c)},f.unhover=function(a,b){return this.unmouseover(a).unmouseout(b)};var u=[];f.drag=function(c,d,e,f,g,h){function i(i){(i.originalEvent||i).preventDefault();var j=k("y"),l=k("x");this._drag.x=i.clientX+l,this._drag.y=i.clientY+j,this._drag.id=i.identifier,!q.length&&a.mousemove(r).mouseup(s),q.push({el:this,move_scope:f,start_scope:g,end_scope:h}),d&&b.on("snap.drag.start."+this.id,d),c&&b.on("snap.drag.move."+this.id,c),e&&b.on("snap.drag.end."+this.id,e),b("snap.drag.start."+this.id,g||f||this,i.clientX+l,i.clientY+j,i)}if(!arguments.length){var j;return this.drag(function(a,b){this.attr({transform:j+(j?"T":"t")+[a,b]})},function(){j=this.transform().local})}return this._drag={},u.push({el:this,start:i}),this.mousedown(i),this},f.undrag=function(){for(var c=u.length;c--;)u[c].el==this&&(this.unmousedown(u[c].start),u.splice(c,1),b.unbind("snap.drag.*."+this.id));return!u.length&&a.unmousemove(r).unmouseup(s),this}}),d.plugin(function(a,c,d){var e=(c.prototype,d.prototype),f=/^\s*url\((.+)\)/,g=String,h=a._.$;a.filter={},e.filter=function(b){var d=this;"svg"!=d.type&&(d=d.paper);var e=a.parse(g(b)),f=a._.id(),i=(d.node.offsetWidth,d.node.offsetHeight,h("filter"));return h(i,{id:f,filterUnits:"userSpaceOnUse"}),i.appendChild(e.node),d.defs.appendChild(i),new c(i)},b.on("snap.util.getattr.filter",function(){b.stop();var c=h(this.node,"filter");if(c){var d=g(c).match(f);return d&&a.select(d[1])}}),b.on("snap.util.attr.filter",function(a){if(a instanceof c&&"filter"==a.type){b.stop();var d=a.node.id;d||(h(a.node,{id:a.id}),d=a.id),h(this.node,{filter:"url(#"+d+")"})}a&&"none"!=a||(b.stop(),this.node.removeAttribute("filter"))}),a.filter.blur=function(b,c){null==b&&(b=2);var d=null==c?b:[b,c];return a.format('<feGaussianBlur stdDeviation="{def}"/>',{def:d})},a.filter.blur.toString=function(){return this()},a.filter.shadow=function(b,c,d,e){return e=e||"#000",null==d&&(d=4),"string"==typeof d&&(e=d,d=4),null==b&&(b=0,c=2),null==c&&(c=b),e=a.color(e),a.format('<feGaussianBlur in="SourceAlpha" stdDeviation="{blur}"/><feOffset dx="{dx}" dy="{dy}" result="offsetblur"/><feFlood flood-color="{color}"/><feComposite in2="offsetblur" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>',{color:e,dx:b,dy:c,blur:d})},a.filter.shadow.toString=function(){return this()},a.filter.grayscale=function(b){return null==b&&(b=1),a.format('<feColorMatrix type="matrix" values="{a} {b} {c} 0 0 {d} {e} {f} 0 0 {g} {b} {h} 0 0 0 0 0 1 0"/>',{a:.2126+.7874*(1-b),b:.7152-.7152*(1-b),c:.0722-.0722*(1-b),d:.2126-.2126*(1-b),e:.7152+.2848*(1-b),f:.0722-.0722*(1-b),g:.2126-.2126*(1-b),h:.0722+.9278*(1-b)})},a.filter.grayscale.toString=function(){return this()},a.filter.sepia=function(b){return null==b&&(b=1),a.format('<feColorMatrix type="matrix" values="{a} {b} {c} 0 0 {d} {e} {f} 0 0 {g} {h} {i} 0 0 0 0 0 1 0"/>',{a:.393+.607*(1-b),b:.769-.769*(1-b),c:.189-.189*(1-b),d:.349-.349*(1-b),e:.686+.314*(1-b),f:.168-.168*(1-b),g:.272-.272*(1-b),h:.534-.534*(1-b),i:.131+.869*(1-b)})},a.filter.sepia.toString=function(){return this()},a.filter.saturate=function(b){return null==b&&(b=1),a.format('<feColorMatrix type="saturate" values="{amount}"/>',{amount:1-b})},a.filter.saturate.toString=function(){return this()
},a.filter.hueRotate=function(b){return b=b||0,a.format('<feColorMatrix type="hueRotate" values="{angle}"/>',{angle:b})},a.filter.hueRotate.toString=function(){return this()},a.filter.invert=function(b){return null==b&&(b=1),a.format('<feComponentTransfer><feFuncR type="table" tableValues="{amount} {amount2}"/><feFuncG type="table" tableValues="{amount} {amount2}"/><feFuncB type="table" tableValues="{amount} {amount2}"/></feComponentTransfer>',{amount:b,amount2:1-b})},a.filter.invert.toString=function(){return this()},a.filter.brightness=function(b){return null==b&&(b=1),a.format('<feComponentTransfer><feFuncR type="linear" slope="{amount}"/><feFuncG type="linear" slope="{amount}"/><feFuncB type="linear" slope="{amount}"/></feComponentTransfer>',{amount:b})},a.filter.brightness.toString=function(){return this()},a.filter.contrast=function(b){return null==b&&(b=1),a.format('<feComponentTransfer><feFuncR type="linear" slope="{amount}" intercept="{amount2}"/><feFuncG type="linear" slope="{amount}" intercept="{amount2}"/><feFuncB type="linear" slope="{amount}" intercept="{amount2}"/></feComponentTransfer>',{amount:b,amount2:.5-b/2})},a.filter.contrast.toString=function(){return this()}}),d});
/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, eve */

define('Editor',['eve', 'CSSUtils', 'snap'], function(eve, CSSUtils, Snap){
    
    
    function Editor(target, value){
        
        if (!target || !(target instanceof HTMLElement)){
            throw new TypeError('Target expected as HTMLElement object, but was: ' + typeof target);
        }
        
        this.target = target;
        this.value = value;
        this.holder = null; // setup by setupEditorHolder()
        
        // target element offsets with regards to the page
        // setup by setupOffsets()
        this.offsets = {
            left: 0,
            top: 0
        };
    }
    
    Editor.prototype = {
        setup: function(){
            this.setupEditorHolder();
            this.setupDrawingSurface();
            this.setupOffsets();
            
            window.setTimeout(function(){
                this.trigger('ready');
            }.bind(this));
        },
        
        setupEditorHolder: function() {
            
            // abort if editor holder already exists
            if (this.holder) {
                var root = document.documentElement;
                this.holder.style.display = 'none';
                this.holder.style.minHeight = root.scrollHeight + 'px';
                this.holder.style.minWidth = root.scrollWidth + 'px';
                this.holder.style.display = 'block';
                return;
            }
            
            // create an element for the holder
            this.holder = document.createElement('div');
            
            // position this element so that it fills the viewport
            this.holder.style.position = "absolute";
            this.holder.style.top = 0;
            this.holder.style.left = 0;
            this.holder.style.right = 0;
            this.holder.style.bottom = 0;
            
            // make sure editor is the top-most thing on the page
            // see http://softwareas.com/whats-the-maximum-z-index
            this.holder.style.zIndex = 2147483647; 
            
            // other styling stuff
            this.holder.style.background = "rgba(0, 194, 255, 0.2)";
            this.holder.setAttribute('data-role', 'shape-editor');
            
            // add this layer to the document
            document.body.appendChild(this.holder);
            
            // resize tricks
            this.setupEditorHolder();
        },
        
        setupDrawingSurface: function(){
            this.snap = new Snap('100%','100%');
            this.holder.appendChild(this.snap.node);
            this.paper = this.snap.paper;
        },
        
        setupOffsets: function() {
            var rect = this.target.getBoundingClientRect(),
                box = CSSUtils.getContentBoxOf(this.target);
                
            this.offsets.left = rect.left + window.scrollX + box.left;
            this.offsets.top = rect.top + window.scrollY + box.top;
        },
        
        remove: function() {
            var holder = this.holder;
            
            if (holder && holder.parentElement){
                holder.parentNode.removeChild(holder);
            }
            
            this.trigger('removed', {});
        },
        
        on: eve.on,
        off: eve.off,
        trigger: eve
    };   
    
    return Editor;
});

/*
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/mit-license.php
 *
 * Adapted from original source https://github.com/ElbertF/Raphael.FreeTransform
 * to work with Snap.svg
 *
 */
(function (root, factory) {
    if ( typeof define === 'function' && define.amd ) {
        // AMD. Register as an anonymous module.
        define('snap.freeTransform',['snap'], function(Snap) {
            // Use global variables if the locals are undefined.
            return factory(Snap || root.Snap);
        });
    } else {
        factory(Snap);
    }
}(this, function(Snap) {
    Snap.plugin(function (Snap, Element, Paper, glob) {
        var freeTransform = function(subject, options, callback) {
            // Enable method chaining
            if ( subject.freeTransform ) { return subject.freeTransform; }

            var paper = subject.paper,
                bbox  = subject.getBBox(true);
                
            var ft = subject.freeTransform = {
                // Keep track of transformations
                attrs: {
                    x: bbox.x,
                    y: bbox.y,
                    size: { x: bbox.width, y: bbox.height },
                    center: { x: bbox.cx, y: bbox.cy },
                    rotate: 0,
                    scale: { x: 1, y: 1 },
                    translate: { x: 0, y: 0 },
                    ratio: 1
                },
                axes: null,
                bbox: null,
                callback: null,
                items: [],
                handles: { center: null, x: null, y: null },
                offset: {
                    rotate: 0,
                    scale: { x: 1, y: 1 },
                    translate: { x: 0, y: 0 }
                },
                opts: {
                    animate: false,
                    attrs: { fill: '#fff', stroke: '#000' },
                    boundary: { x: paper._left || 0, y: paper._top || 0, width: null, height: null },
                    distance: 1.3,
                    drag: true,
                    draw: false,
                    keepRatio: false,
                    range: { rotate: [ -180, 180 ], scale: [ -99999, 99999 ] },
                    rotate: true,
                    scale: true,
                    snap: { rotate: 0, scale: 0, drag: 0 },
                    snapDist: { rotate: 0, scale: 0, drag: 7 },
                    size: 5
                },
                subject: subject
            };

            /**
             * Update handles based on the element's transformations
             */
            ft.updateHandles = function() {
                if ( ft.handles.bbox || ft.opts.rotate.indexOf('self') >= 0 ) {
                    var corners = getBBox();
                }
                
                // Get the element's rotation
                var rad = {
                    x: ( ft.attrs.rotate      ) * Math.PI / 180,
                    y: ( ft.attrs.rotate + 90 ) * Math.PI / 180
                };
                
                var radius = {
                    x: ft.attrs.size.x / 2 * ft.attrs.scale.x,
                    y: ft.attrs.size.y / 2 * ft.attrs.scale.y
                }; 
                
                ft.axes.map(function(axis) { 
                    if ( ft.handles[axis] ) {
                        
                        var cx = ft.attrs.center.x + ft.attrs.translate.x + radius[axis] * ft.opts.distance * Math.cos(rad[axis]),
                            cy = ft.attrs.center.y + ft.attrs.translate.y + radius[axis] * ft.opts.distance * Math.sin(rad[axis]);
                            
                            
                        // Keep handle within boundaries
                        if ( ft.opts.boundary ) { 
                            cx = Math.max(Math.min(cx, ft.opts.boundary.x + ( ft.opts.boundary.width  || getPaperSize().x )), ft.opts.boundary.x);
                            cy = Math.max(Math.min(cy, ft.opts.boundary.y + ( ft.opts.boundary.height || getPaperSize().y )), ft.opts.boundary.y);
                        } 
                        
                        ft.handles[axis].disc.attr({ 'cx': cx, 'cy': cy });
                        
                        ft.handles[axis].line.toFront().attr({
                            path: [ [ 'M', ft.attrs.center.x + ft.attrs.translate.x, ft.attrs.center.y + ft.attrs.translate.y ], [ 'L', ft.handles[axis].disc.attr('cx'), ft.handles[axis].disc.attr('cy') ] ]
                        });
                        
                        ft.handles[axis].disc.toFront();
                    }
                });

                if ( ft.bbox ) {
                    ft.bbox.toFront().attr({
                        path: [
                            [ 'M', corners[0].x, corners[0].y ],
                            [ 'L', corners[1].x, corners[1].y ],
                            [ 'L', corners[2].x, corners[2].y ],
                            [ 'L', corners[3].x, corners[3].y ],
                            [ 'L', corners[0].x, corners[0].y ]
                        ]
                    });

                    // Allowed x, y scaling directions for bbox handles
                    var bboxHandleDirection = [
                        [ -1, -1 ], [ 1, -1 ], [ 1, 1 ], [ -1, 1 ],
                        [  0, -1 ], [ 1,  0 ], [ 0, 1 ], [ -1, 0 ]
                    ];

                    if ( ft.handles.bbox ) {
                        ft.handles.bbox.map(function (handle, i) {
                            var cx, cy, j, k;

                            if ( handle.isCorner ) {
                                cx = corners[i].x;
                                cy = corners[i].y;
                            } else {
                                j  = i % 4;
                                k  = ( j + 1 ) % corners.length;
                                cx = ( corners[j].x + corners[k].x ) / 2;
                                cy = ( corners[j].y + corners[k].y ) / 2;
                            }

                            handle.element.toFront()
                                .attr({
                                    x: cx - ( handle.isCorner ? ft.opts.size.bboxCorners : ft.opts.size.bboxSides ),
                                    y: cy - ( handle.isCorner ? ft.opts.size.bboxCorners : ft.opts.size.bboxSides )
                                })
                                .transform('R' + ft.attrs.rotate);

                            handle.x = bboxHandleDirection[i][0];
                            handle.y = bboxHandleDirection[i][1];
                        });
                    }
                }

                if ( ft.circle ) {
                    ft.circle.attr({
                        cx: ft.attrs.center.x + ft.attrs.translate.x,
                        cy: ft.attrs.center.y + ft.attrs.translate.y,
                        r:  Math.max(radius.x, radius.y) * ft.opts.distance
                    });
                }

                if ( ft.handles.center ) {
                    ft.handles.center.disc.toFront().attr({
                        cx: ft.attrs.center.x + ft.attrs.translate.x,
                        cy: ft.attrs.center.y + ft.attrs.translate.y
                    });
                }

                if ( ft.opts.rotate.indexOf('self') >= 0 ) {
                    radius = Math.max(
                        Math.sqrt(Math.pow(corners[1].x - corners[0].x, 2) + Math.pow(corners[1].y - corners[0].y, 2)),
                        Math.sqrt(Math.pow(corners[2].x - corners[1].x, 2) + Math.pow(corners[2].y - corners[1].y, 2))
                    ) / 2;
                }

                return ft;
            };

            /**
             * Add handles
             */
            ft.showHandles = function() {
                ft.hideHandles();

                ft.axes.map(function(axis) {
                    ft.handles[axis] = {};
                    ft.handles[axis].line = paper
                        .path([[ 'M', ft.attrs.center.x, ft.attrs.center.y ]])
                        .attr({
                            stroke: ft.opts.attrs.stroke,
                            'stroke-dasharray': '5, 5',
                            opacity: .5
                        });

                    ft.handles[axis].disc = paper
                        .circle(ft.attrs.center.x, ft.attrs.center.y, ft.opts.size.axes)
                        .attr(ft.opts.attrs);
                });
                
                if ( ft.opts.draw.indexOf('bbox') >= 0 ) {
                    ft.bbox = paper
                        .path('')
                        .attr({
                            fill: 'none',
                            stroke: ft.opts.attrs.stroke,
                            'stroke-dasharray': '5, 5',
                            opacity: .5
                        });

                    ft.handles.bbox = [];

                    var i, handle;

                    for ( i = ( ft.opts.scale.indexOf('bboxCorners') >= 0 ? 0 : 4 ); i < ( ft.opts.scale.indexOf('bboxSides') === -1 ? 4 : 8 ); i ++ ) {
                        handle = {};

                        handle.axis     = i % 2 ? 'x' : 'y';
                        handle.isCorner = i < 4;

                        handle.element = paper
                            .rect(ft.attrs.center.x, ft.attrs.center.y, ft.opts.size[handle.isCorner ? 'bboxCorners' : 'bboxSides' ] * 2, ft.opts.size[handle.isCorner ? 'bboxCorners' : 'bboxSides' ] * 2)
                            .attr(ft.opts.attrs);

                        ft.handles.bbox[i] = handle;
                    }
                }

                if ( ft.opts.draw.indexOf('circle') !== -1 ) {
                    ft.circle = paper
                        .circle(0, 0, 0)
                        .attr({
                            stroke: ft.opts.attrs.stroke,
                            'stroke-dasharray': '5, 5',
                            opacity: .3
                        });
                }

                if ( ft.opts.drag.indexOf('center') !== -1 ) {
                    ft.handles.center = {};

                    ft.handles.center.disc = paper
                        .circle(ft.attrs.center.x, ft.attrs.center.y, ft.opts.size.center)
                        .attr(ft.opts.attrs);
                }

                // Drag x, y handles
                ft.axes.map(function(axis) {
                    if ( !ft.handles[axis] ) {
                        return;
                    }
                    
                    var rotate = ft.opts.rotate.indexOf('axis' + axis.toUpperCase()) !== -1,
                        scale  = ft.opts.scale .indexOf('axis' + axis.toUpperCase()) !== -1;
                        
                        var _dragMove = function(dx, dy) {
                            // viewBox might be scaled
                            if ( ft.o.viewBoxRatio ) {
                                dx *= ft.o.viewBoxRatio.x;
                                dy *= ft.o.viewBoxRatio.y;
                            }

                            var cx = dx + parseInt(ft.handles[axis].disc.ox, 10),
                                cy = dy + parseInt(ft.handles[axis].disc.oy, 10);
                                
                            var mirrored = {
                                x: ft.o.scale.x < 0,
                                y: ft.o.scale.y < 0
                            };

                            if ( rotate ) {
                                var rad = Math.atan2(cy - ft.o.center.y - ft.o.translate.y, cx - ft.o.center.x - ft.o.translate.x);

                                ft.attrs.rotate = rad * 180 / Math.PI - ( axis === 'y' ? 90 : 0 );

                                if ( mirrored[axis] ) {
                                    ft.attrs.rotate -= 180;
                                }
                            }

                            // Keep handle within boundaries
                            if ( ft.opts.boundary ) {
                                cx = Math.max(Math.min(cx, ft.opts.boundary.x + ( ft.opts.boundary.width  || getPaperSize().x )), ft.opts.boundary.x);
                                cy = Math.max(Math.min(cy, ft.opts.boundary.y + ( ft.opts.boundary.height || getPaperSize().y )), ft.opts.boundary.y);
                            }

                            var radius = Math.sqrt(Math.pow(cx - ft.o.center.x - ft.o.translate.x, 2) + Math.pow(cy - ft.o.center.y - ft.o.translate.y, 2));

                            if ( scale ) {
                                ft.attrs.scale[axis] = radius / ( ft.o.size[axis] / 2 * ft.opts.distance );

                                if ( mirrored[axis] ) {
                                    ft.attrs.scale[axis] *= -1;
                                }
                            }

                            applyLimits();

                            // Maintain aspect ratio
                            if ( ft.opts.keepRatio.indexOf('axis' + axis.toUpperCase()) !== -1 ) {
                                keepRatio(axis);
                            } else {
                                ft.attrs.ratio = ft.attrs.scale.x / ft.attrs.scale.y;
                            }

                            if ( ft.attrs.scale.x && ft.attrs.scale.y ) { ft.apply(); }

                            asyncCallback([ rotate ? 'rotate' : null, scale ? 'scale' : null ]);
                        }
                        var _dragStart = function() {
                            // Offset values
                            ft.o = cloneObj(ft.attrs);

                            if ( paper._viewBox ) {
                                ft.o.viewBoxRatio = {
                                    x: paper._viewBox[2] / getPaperSize().x,
                                    y: paper._viewBox[3] / getPaperSize().y
                                };
                            }
                            
                            ft.handles[axis].disc.ox = parseInt(this.attr('cx'), 10);
                            ft.handles[axis].disc.oy = parseInt(this.attr('cy'), 10);

                            asyncCallback([ rotate ? 'rotate start' : null, scale ? 'scale start' : null ]);
                        }
                        var _dragEnd = function() {
                            asyncCallback([ rotate ? 'rotate end'   : null, scale ? 'scale end'   : null ]);
                        }
                    
                    ft.handles[axis].disc.attr('fill', 'red')    
                    ft.handles[axis].disc.drag(_dragMove, _dragStart, _dragEnd);
                });

                // Drag bbox handles
                if ( ft.opts.draw.indexOf('bbox') >= 0 && ( ft.opts.scale.indexOf('bboxCorners') !== -1 || ft.opts.scale.indexOf('bboxSides') !== -1 ) ) {
                    ft.handles.bbox.map(function(handle) {
                        
                        var _dragMove = function(dx, dy) {
                            // viewBox might be scaled
                            if ( ft.o.viewBoxRatio ) {
                                dx *= ft.o.viewBoxRatio.x;
                                dy *= ft.o.viewBoxRatio.y;
                            }

                            var sin, cos, rx, ry, rdx, rdy, mx, my, sx, sy,
                                previous = cloneObj(ft.attrs);

                            sin = ft.o.rotate.sin;
                            cos = ft.o.rotate.cos;

                            // First rotate dx, dy to element alignment
                            rx = dx * cos - dy * sin;
                            ry = dx * sin + dy * cos;

                            rx *= Math.abs(handle.x);
                            ry *= Math.abs(handle.y);

                            // And finally rotate back to canvas alignment
                            rdx = rx *   cos + ry * sin;
                            rdy = rx * - sin + ry * cos;

                            ft.attrs.translate = {
                                x: ft.o.translate.x + rdx / 2,
                                y: ft.o.translate.y + rdy / 2
                            };

                            // Mouse position, relative to element center after translation
                            mx = ft.o.handlePos.cx + dx - ft.attrs.center.x - ft.attrs.translate.x;
                            my = ft.o.handlePos.cy + dy - ft.attrs.center.y - ft.attrs.translate.y;

                            // Position rotated to align with element
                            rx = mx * cos - my * sin;
                            ry = mx * sin + my * cos;

                            // Maintain aspect ratio
                            if ( handle.isCorner && ft.opts.keepRatio.indexOf('bboxCorners') !== -1 ) {
                                var
                                    ratio = ( ft.attrs.size.x * ft.attrs.scale.x ) / ( ft.attrs.size.y * ft.attrs.scale.y ),
                                    tdy = rx * handle.x * ( 1 / ratio ),
                                    tdx = ry * handle.y * ratio
                                    ;

                                if ( tdx > tdy * ratio ) {
                                    rx = tdx * handle.x;
                                } else {
                                    ry = tdy * handle.y;
                                }
                            }

                            // Scale element so that handle is at mouse position
                            sx = rx * 2 * handle.x / ft.o.size.x;
                            sy = ry * 2 * handle.y / ft.o.size.y;

                            ft.attrs.scale = {
                                x: sx || ft.attrs.scale.x,
                                y: sy || ft.attrs.scale.y
                            };

                            // Check boundaries
                            if ( !isWithinBoundaries().x || !isWithinBoundaries().y ) { ft.attrs = previous; }

                            applyLimits();

                            // Maintain aspect ratio
                            if ( ( handle.isCorner && ft.opts.keepRatio.indexOf('bboxCorners') !== -1 ) || ( !handle.isCorner && ft.opts.keepRatio.indexOf('bboxSides') !== -1 ) ) {
                                keepRatio(handle.axis);

                                var trans = {
                                    x: ( ft.attrs.scale.x - ft.o.scale.x ) * ft.o.size.x * handle.x,
                                    y: ( ft.attrs.scale.y - ft.o.scale.y ) * ft.o.size.y * handle.y
                                };

                                rx =   trans.x * cos + trans.y * sin;
                                ry = - trans.x * sin + trans.y * cos;

                                ft.attrs.translate.x = ft.o.translate.x + rx / 2;
                                ft.attrs.translate.y = ft.o.translate.y + ry / 2;
                            }

                            ft.attrs.ratio = ft.attrs.scale.x / ft.attrs.scale.y;

                            asyncCallback([ 'scale' ]);

                            ft.apply();
                        }
                        var _dragStart = function() {
                            var rotate = ( ( 360 - ft.attrs.rotate ) % 360 ) / 180 * Math.PI,
                                handlePos = {
                                    x: parseInt(handle.element.attr('x'), 10),
                                    y: parseInt(handle.element.attr('y'), 10)
                                };
                                
                            // Offset values
                            ft.o = cloneObj(ft.attrs);

                            ft.o.handlePos = {
                                cx: handlePos.x + ft.opts.size[handle.isCorner ? 'bboxCorners' : 'bboxSides'],
                                cy: handlePos.y + ft.opts.size[handle.isCorner ? 'bboxCorners' : 'bboxSides']
                            };

                            // Pre-compute rotation sin & cos for efficiency
                            ft.o.rotate = {
                                sin: Math.sin(rotate),
                                cos: Math.cos(rotate)
                            };

                            if ( paper._viewBox ) {
                                ft.o.viewBoxRatio = {
                                    x: paper._viewBox[2] / getPaperSize().x,
                                    y: paper._viewBox[3] / getPaperSize().y
                                };
                            }

                            asyncCallback([ 'scale start' ]);
                        }
                        var _dragEnd = function() {
                            asyncCallback([ 'scale end' ]);
                        }
                        
                        handle.element.drag(_dragMove, _dragStart, _dragEnd);
                    });
                }

                // Drag element and center handle
                var draggables = [];

                if ( ft.opts.drag.indexOf('self') >= 0 && ft.opts.scale.indexOf('self') === -1 && ft.opts.rotate.indexOf('self') === -1 ) {
                    draggables.push(subject);
                }

                if ( ft.opts.drag.indexOf('center') >= 0 ) {
                    draggables.push(ft.handles.center.disc);
                }

                draggables.map(function(draggable) {
                    
                    var _dragMove = function(dx, dy) {
                        // viewBox might be scaled
                        if ( ft.o.viewBoxRatio ) {
                            dx *= ft.o.viewBoxRatio.x;
                            dy *= ft.o.viewBoxRatio.y;
                        }

                        ft.attrs.translate.x = ft.o.translate.x + dx;
                        ft.attrs.translate.y = ft.o.translate.y + dy;


                        var bbox = cloneObj(ft.o.bbox);

                        bbox.x += dx;
                        bbox.y += dy;

                        applyLimits(bbox);

                        asyncCallback([ 'drag' ]);

                        ft.apply();
                    }
                    
                    var _dragStart = function() {
                        // Offset values
                        ft.o = cloneObj(ft.attrs);

                        if ( ft.opts.snap.drag ) {
                            ft.o.bbox = subject.getBBox();
                        }

                        // viewBox might be scaled
                        if ( paper._viewBox ) {
                            ft.o.viewBoxRatio = {
                                x: paper._viewBox[2] / getPaperSize().x,
                                y: paper._viewBox[3] / getPaperSize().y
                            };
                        }

                        ft.axes.map(function(axis) {
                            if ( ft.handles[axis] ) {
                                ft.handles[axis].disc.ox = ft.handles[axis].disc.attr('cx');
                                ft.handles[axis].disc.oy = ft.handles[axis].disc.attr('cy');
                            }
                        });

                        asyncCallback([ 'drag start' ]);
                    }
                    
                    var _dragEnd = function() {
                        asyncCallback([ 'drag end' ]);
                    }
                    
                    draggable.drag(_dragMove, _dragStart, _dragEnd);
                });

                var rotate = ft.opts.rotate.indexOf('self') >= 0,
                    scale  = ft.opts.scale .indexOf('self') >= 0;
                
                if ( rotate || scale ) {
                    subject.drag(function(dx, dy, x, y) {
                        if ( rotate ) {
                            var rad = Math.atan2(y - ft.o.center.y - ft.o.translate.y, x - ft.o.center.x - ft.o.translate.x);
                
                            ft.attrs.rotate = ft.o.rotate + ( rad * 180 / Math.PI ) - ft.o.deg;
                        }
                
                        var mirrored = {
                            x: ft.o.scale.x < 0,
                            y: ft.o.scale.y < 0
                        };
                
                        if ( scale ) {
                            var radius = Math.sqrt(Math.pow(x - ft.o.center.x - ft.o.translate.x, 2) + Math.pow(y - ft.o.center.y - ft.o.translate.y, 2));
                
                            ft.attrs.scale.x = ft.attrs.scale.y = ( mirrored.x ? -1 : 1 ) * ft.o.scale.x + ( radius - ft.o.radius ) / ( ft.o.size.x / 2 );
                
                            if ( mirrored.x ) { ft.attrs.scale.x *= -1; }
                            if ( mirrored.y ) { ft.attrs.scale.y *= -1; }
                        }
                
                        applyLimits();
                
                        ft.apply();
                
                        asyncCallback([ rotate ? 'rotate' : null, scale ? 'scale' : null ]);
                    }, function(x, y) {
                        // Offset values
                        ft.o = cloneObj(ft.attrs);
                
                        ft.o.deg = Math.atan2(y - ft.o.center.y - ft.o.translate.y, x - ft.o.center.x - ft.o.translate.x) * 180 / Math.PI;
                
                        ft.o.radius = Math.sqrt(Math.pow(x - ft.o.center.x - ft.o.translate.x, 2) + Math.pow(y - ft.o.center.y - ft.o.translate.y, 2));
                
                        // viewBox might be scaled
                        if ( paper._viewBox ) {
                            ft.o.viewBoxRatio = {
                                x: paper._viewBox[2] / getPaperSize().x,
                                y: paper._viewBox[3] / getPaperSize().y
                            };
                        }
                
                        asyncCallback([ rotate ? 'rotate start' : null, scale ? 'scale start' : null ]);
                    }, function() {
                        asyncCallback([ rotate ? 'rotate end'   : null, scale ? 'scale end'   : null ]);
                    });
                }

                ft.updateHandles();

                return ft;
            };

            /**
             * Remove handles
             */

            /*

            */
            ft.hideHandles = function(opts) {
                var opts = opts || {}

                if ( opts.undrag === undefined ) {
                    opts.undrag = true;
                }

                if ( opts.undrag ) {
                    ft.items.map(function(item) {
                        item.el.undrag();
                    });
                }

                if ( ft.handles.center ) { 
                    ft.handles.center.disc.remove();

                    ft.handles.center = null;
                }

                [ 'x', 'y' ].map(function(axis) { 
                    if ( ft.handles[axis] ) {  
                        ft.handles[axis].disc.remove();
                        ft.handles[axis].line.remove();

                        ft.handles[axis] = null;
                    }
                });

                if ( ft.bbox ) {
                    ft.bbox.remove();

                    ft.bbox = null;

                    if ( ft.handles.bbox ) {  
                        ft.handles.bbox.map(function(handle) {
                            handle.element.remove();
                        });

                        ft.handles.bbox = null;
                    }
                }

                if ( ft.circle ) {
                    ft.circle.remove();

                    ft.circle = null;
                }

                return ft;
            };

            // Override defaults
            ft.setOpts = function(options, callback) {
                if ( callback !== undefined ) {
                    ft.callback = typeof callback === 'function' ? callback : false;
                }

                var i, j;

                for ( i in options ) {
                    if ( options[i] && options[i].constructor === Object ) {
                        if(ft.opts[i] === false){
                            ft.opts[i] = {};
                        }
                        for ( j in options[i] ) {
                            if ( options[i].hasOwnProperty(j) ) {
                                ft.opts[i][j] = options[i][j];
                            }
                        }
                    } else { 
                        ft.opts[i] = options[i];
                    }
                }

                if ( ft.opts.animate   === true ) { ft.opts.animate   = { delay:   700, easing: 'linear' }; }
                if ( ft.opts.drag      === true ) { ft.opts.drag      = [ 'center', 'self' ]; }
                if ( ft.opts.keepRatio === true ) { ft.opts.keepRatio = [ 'bboxCorners', 'bboxSides' ]; }
                if ( ft.opts.rotate    === true ) { ft.opts.rotate    = [ 'axisX', 'axisY' ]; }
                if ( ft.opts.scale     === true ) { ft.opts.scale     = [ 'axisX', 'axisY', 'bboxCorners', 'bboxSides' ]; }

                [ 'drag', 'draw', 'keepRatio', 'rotate', 'scale' ].map(function(option) {
                    if ( ft.opts[option] === false ) {
                        ft.opts[option] = [];
                    }
                });

                ft.axes = [];

                if ( ft.opts.rotate.indexOf('axisX') >= 0 || ft.opts.scale.indexOf('axisX') >= 0 ) { ft.axes.push('x'); }
                if ( ft.opts.rotate.indexOf('axisY') >= 0 || ft.opts.scale.indexOf('axisY') >= 0 ) { ft.axes.push('y'); }

                [ 'drag', 'rotate', 'scale' ].map(function(option) {
                    if ( !ft.opts.snapDist[option] ) {
                        ft.opts.snapDist[option] = ft.opts.snap[option];
                    }
                });

                // Force numbers
                ft.opts.range = {
                    rotate: [ parseFloat(ft.opts.range.rotate[0]), parseFloat(ft.opts.range.rotate[1]) ],
                    scale:  [ parseFloat(ft.opts.range.scale[0]),  parseFloat(ft.opts.range.scale[1])  ]
                };
                
                
                ft.opts.snap = {
                    drag:   parseFloat(ft.opts.snap.drag),
                    rotate: parseFloat(ft.opts.snap.rotate),
                    scale:  parseFloat(ft.opts.snap.scale)
                };

                ft.opts.snapDist = {
                    drag:   parseFloat(ft.opts.snapDist.drag),
                    rotate: parseFloat(ft.opts.snapDist.rotate),
                    scale:  parseFloat(ft.opts.snapDist.scale)
                };

                if ( typeof ft.opts.size === 'string' ) {
                    ft.opts.size = parseFloat(ft.opts.size);
                } 
                
                if ( !isNaN(ft.opts.size) ) {
                    ft.opts.size = {
                        axes:        ft.opts.size,
                        bboxCorners: ft.opts.size,
                        bboxSides:   ft.opts.size,
                        center:      ft.opts.size
                    };
                }
                
                if ( typeof ft.opts.distance === 'string' ) {
                    ft.opts.distance = parseFloat(ft.opts.distance);
                } 
                
                
                ft.showHandles();

                asyncCallback([ 'init' ]);

                return ft;
            };

            ft.setOpts(options, callback);

            /**
             * Apply transformations, optionally update attributes manually
             */
            ft.apply = function() {
                ft.items.map(function(item, i) {
                    // Take offset values into account
                    var
                        center = {
                            x: ft.attrs.center.x + ft.offset.translate.x,
                            y: ft.attrs.center.y + ft.offset.translate.y
                        },
                        rotate    = ft.attrs.rotate - ft.offset.rotate,
                        scale     = {
                            x: ft.attrs.scale.x / ft.offset.scale.x,
                            y: ft.attrs.scale.y / ft.offset.scale.y
                        },
                        translate = {
                            x: ft.attrs.translate.x - ft.offset.translate.x,
                            y: ft.attrs.translate.y - ft.offset.translate.y
                        };

                    if ( ft.opts.animate ) {
                        asyncCallback([ 'animate start' ]);

                        item.el.animate(
                            { transform: [
                                'R' + rotate, center.x, center.y,
                                'S' + scale.x, scale.y, center.x, center.y,
                                'T' + translate.x, translate.y
                            ].join(',')},
                            ft.opts.animate.delay,
                            ft.opts.animate.easing,
                            function() {
                                asyncCallback([ 'animate end' ]);

                                ft.updateHandles();
                            }
                        );
                    } else {
                        item.el.transform([
                            'R' + rotate, center.x, center.y,
                            'S' + scale.x, scale.y, center.x, center.y,
                            'T' + translate.x, translate.y
                        ].join(','));
                        

                        asyncCallback([ 'apply' ]);

                        ft.updateHandles();
                    }
                });

                return ft;
            };

            /**
             * Clean exit
             */
            ft.unplug = function() {
                var attrs = ft.attrs;

                ft.hideHandles();

                // Goodbye
                delete subject.freeTransform;

                return attrs;
            };

            // Store attributes for each item
            function scan(subject) {
                ( subject.type === 'set' ? subject.items : [ subject ] ).map(function(item) {
                    if ( item.type === 'set' ) {
                        scan(item);
                    } else {      
                        ft.items.push({
                            el: item,
                            attrs: {
                                rotate:    0,
                                scale:     { x: 1, y: 1 },
                                translate: { x: 0, y: 0 }
                            },
                            transformString: item.transform().toString()
                        });
                    }
                });
            }

            scan(subject);

            // Get the current transform values for each item
            ft.items.map(function(item, i) {
                if ( item.el._ && item.el._.transform && typeof item.el._.transform === 'object' ) {
                    item.el._.transform.map(function(transform) {
                        if ( transform[0] ) { 
                            switch ( transform[0].toUpperCase() ) {
                                case 'T':
                                    ft.items[i].attrs.translate.x += transform[1];
                                    ft.items[i].attrs.translate.y += transform[2];

                                    break;
                                case 'S':
                                    ft.items[i].attrs.scale.x *= transform[1];
                                    ft.items[i].attrs.scale.y *= transform[2];

                                    break;
                                case 'R':
                                    ft.items[i].attrs.rotate += transform[1];

                                    break;
                            }
                        }
                    });
                }
            });

            // If subject is not of type set, the first item _is_ the subject
            if ( subject.type !== 'set' ) {
                ft.attrs.rotate    = ft.items[0].attrs.rotate;
                ft.attrs.scale     = ft.items[0].attrs.scale;
                ft.attrs.translate = ft.items[0].attrs.translate;
                
                ft.items[0].attrs = {
                    rotate:    0,
                    scale:     { x: 1, y: 1 },
                    translate: { x: 0, y: 0 }
                };

                ft.items[0].transformString = '';
            }

            ft.attrs.ratio = ft.attrs.scale.x / ft.attrs.scale.y;

            /**
             * Get rotated bounding box
             */
            function getBBox() {
                var rad = {
                    x: ( ft.attrs.rotate      ) * Math.PI / 180,
                    y: ( ft.attrs.rotate + 90 ) * Math.PI / 180
                };

                var radius = {
                    x: ft.attrs.size.x / 2 * ft.attrs.scale.x,
                    y: ft.attrs.size.y / 2 * ft.attrs.scale.y
                };

                var
                    corners = [],
                    signs   = [ { x: -1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 } ]
                    ;

                signs.map(function(sign) {
                    corners.push({
                        x: ( ft.attrs.center.x + ft.attrs.translate.x + sign.x * radius.x * Math.cos(rad.x) ) + sign.y * radius.y * Math.cos(rad.y),
                        y: ( ft.attrs.center.y + ft.attrs.translate.y + sign.x * radius.x * Math.sin(rad.x) ) + sign.y * radius.y * Math.sin(rad.y)
                    });
                });

                return corners;
            }

            /**
             * Get dimension of the paper
             */
            function getPaperSize() {
                
                // TODO: check and remove. Old Raphael shims here
                // var match = {
                //     x: /^([0-9]+)%$/.exec(paper.attr('width')),
                //     y: /^([0-9]+)%$/.exec(paper.attr('height'))
                // };
                // 
                // 
                // return {
                //     x: match.x ? paper.canvas.clientWidth  || paper.canvas.parentNode.clientWidth  * parseInt(match.x[1], 10) * 0.01 : paper.canvas.clientWidth  || paper.width,
                //     y: match.y ? paper.canvas.clientHeight || paper.canvas.parentNode.clientHeight * parseInt(match.y[1], 10) * 0.01 : paper.canvas.clientHeight || paper.height
                // };
                // 

                return {
                    x: parseInt(paper.node.clientWidth),
                    y: parseInt(paper.node.clientHeight)
                }
            }

            /**
             * Apply limits
             */
            function applyLimits(bbox) {
                // Snap to grid
                if ( bbox && ft.opts.snap.drag ) {
                    var
                        x    = bbox.x,
                        y    = bbox.y,
                        dist = { x: 0, y: 0 },
                        snap = { x: 0, y: 0 }
                        ;

                    [ 0, 1 ].map(function() {
                        // Top and left sides first
                        dist.x = x - Math.round(x / ft.opts.snap.drag) * ft.opts.snap.drag;
                        dist.y = y - Math.round(y / ft.opts.snap.drag) * ft.opts.snap.drag;

                        if ( Math.abs(dist.x) <= ft.opts.snapDist.drag ) { snap.x = dist.x; }
                        if ( Math.abs(dist.y) <= ft.opts.snapDist.drag ) { snap.y = dist.y; }

                        // Repeat for bottom and right sides
                        x += bbox.width  - snap.x;
                        y += bbox.height - snap.y;
                    });

                    ft.attrs.translate.x -= snap.x;
                    ft.attrs.translate.y -= snap.y;
                }

                // Keep center within boundaries
                if ( ft.opts.boundary ) {
                    var b = ft.opts.boundary;
                    b.width  = b.width  || getPaperSize().x;
                    b.height = b.height || getPaperSize().y;
                    
                    if ( ft.attrs.center.x + ft.attrs.translate.x < b.x            ) { ft.attrs.translate.x += b.x -            ( ft.attrs.center.x + ft.attrs.translate.x ); }
                    if ( ft.attrs.center.y + ft.attrs.translate.y < b.y            ) { ft.attrs.translate.y += b.y -            ( ft.attrs.center.y + ft.attrs.translate.y ); }
                    if ( ft.attrs.center.x + ft.attrs.translate.x > b.x + b.width  ) { ft.attrs.translate.x += b.x + b.width  - ( ft.attrs.center.x + ft.attrs.translate.x ); }
                    if ( ft.attrs.center.y + ft.attrs.translate.y > b.y + b.height ) { ft.attrs.translate.y += b.y + b.height - ( ft.attrs.center.y + ft.attrs.translate.y ); }
                }

                // Snap to angle, rotate with increments
                dist = Math.abs(ft.attrs.rotate % ft.opts.snap.rotate);
                dist = Math.min(dist, ft.opts.snap.rotate - dist);

                if ( dist < ft.opts.snapDist.rotate ) {
                    ft.attrs.rotate = Math.round(ft.attrs.rotate / ft.opts.snap.rotate) * ft.opts.snap.rotate;
                }

                // Snap to scale, scale with increments
                dist = {
                    x: Math.abs(( ft.attrs.scale.x * ft.attrs.size.x ) % ft.opts.snap.scale),
                    y: Math.abs(( ft.attrs.scale.y * ft.attrs.size.x ) % ft.opts.snap.scale)
                };

                dist = {
                    x: Math.min(dist.x, ft.opts.snap.scale - dist.x),
                    y: Math.min(dist.y, ft.opts.snap.scale - dist.y)
                };

                if ( dist.x < ft.opts.snapDist.scale ) {
                    ft.attrs.scale.x = Math.round(ft.attrs.scale.x * ft.attrs.size.x / ft.opts.snap.scale) * ft.opts.snap.scale / ft.attrs.size.x;
                }

                if ( dist.y < ft.opts.snapDist.scale ) {
                    ft.attrs.scale.y = Math.round(ft.attrs.scale.y * ft.attrs.size.y / ft.opts.snap.scale) * ft.opts.snap.scale / ft.attrs.size.y;
                }

                // Limit range of rotation
                if ( ft.opts.range.rotate ) {
                    var deg = ( 360 + ft.attrs.rotate ) % 360;

                    if ( deg > 180 ) { deg -= 360; }

                    if ( deg < ft.opts.range.rotate[0] ) { ft.attrs.rotate += ft.opts.range.rotate[0] - deg; }
                    if ( deg > ft.opts.range.rotate[1] ) { ft.attrs.rotate += ft.opts.range.rotate[1] - deg; }
                }

                // Limit scale
                if ( ft.opts.range.scale ) {
                    if ( ft.attrs.scale.x * ft.attrs.size.x < ft.opts.range.scale[0] ) {
                        ft.attrs.scale.x = ft.opts.range.scale[0] / ft.attrs.size.x;
                    }

                    if ( ft.attrs.scale.y * ft.attrs.size.y < ft.opts.range.scale[0] ) {
                        ft.attrs.scale.y = ft.opts.range.scale[0] / ft.attrs.size.y;
                    }

                    if ( ft.attrs.scale.x * ft.attrs.size.x > ft.opts.range.scale[1] ) {
                        ft.attrs.scale.x = ft.opts.range.scale[1] / ft.attrs.size.x;
                    }

                    if ( ft.attrs.scale.y * ft.attrs.size.y > ft.opts.range.scale[1] ) {
                        ft.attrs.scale.y = ft.opts.range.scale[1] / ft.attrs.size.y;
                    }
                }
            }

            function isWithinBoundaries() {
                return {
                    x: ft.attrs.scale.x * ft.attrs.size.x >= ft.opts.range.scale[0] && ft.attrs.scale.x * ft.attrs.size.x <= ft.opts.range.scale[1],
                    y: ft.attrs.scale.y * ft.attrs.size.y >= ft.opts.range.scale[0] && ft.attrs.scale.y * ft.attrs.size.y <= ft.opts.range.scale[1]
                };
            }

            function keepRatio(axis) {
                if ( axis === 'x' ) {
                    ft.attrs.scale.y = ft.attrs.scale.x / ft.attrs.ratio;
                } else {
                    ft.attrs.scale.x = ft.attrs.scale.y * ft.attrs.ratio;
                }
            }

            /**
             * Recursive copy of object
             */
            function cloneObj(obj) {
                var i, clone = {};
                
                for ( i in obj ) {
                    clone[i] = typeof obj[i] === 'object' ? cloneObj(obj[i]) : obj[i];
                }
                
                return clone;
            }

            var timeout = false;

            /**
             * Call callback asynchronously for better performance
             */
            function asyncCallback(e) {
                if ( ft.callback ) {
                    // Remove empty values
                    var events = [];

                    e.map(function(e, i) { if ( e ) { events.push(e); } });

                    clearTimeout(timeout);

                    timeout=setTimeout(function() { if ( ft.callback ) { ft.callback(ft, events); } }, 1);
                }
            }

            ft.updateHandles();

            // Enable method chaining
            return ft;
        };
        
        Snap.freeTransform = freeTransform
    })
}));

// Copyright (c) 2013 Adobe Systems Incorporated. All rights reserved.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
// http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module. Require Snap dependency
        define('snap.plugins',['snap'], function(Snap) {
            return factory(Snap || root.Snap);
        });
    } else {
        factory(Snap);
    }
}(this, function(Snap) {
    Snap.plugin(function (Snap, Element, Paper, glob) {
        var elproto = Element.prototype;
        elproto.toFront = function() {
            this.appendTo(this.paper);
            return this

        };
        elproto.toBack = function() {
            this.prependTo(this.paper);
            return this
        };
    })
}));

/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define */

define('PolygonEditor',['Editor', 'CSSUtils', 'snap', 'snap.freeTransform', 'snap.plugins'], function(Editor, CSSUtils, Snap, freeTransform){
    
    
    var _defaults = {
        path: {
            stroke: 'black',
            fill: 'rgba(0,0,0,0)' // tricks transform editor to accept self-drag
        },
        point: {
            radius: 5,
            stroke: 'black',
            fill: 'gray',
        },
        xUnit: 'px',
        yUnit: 'px'
    };
    
    function PolygonEditor(target, value, options){
        Editor.apply(this, arguments);
        
        // array of objects with x, y, xUnit, yUnit for each vertex
        this.vertices = [];
        
        // Snap polygon path
        this.shape = null;
        
        // Snap instance reference; setup in Editor.js
        this.snap = null;
        
        // Snap paper for shape overaly; setup in Editor.js
        this.paper = null;
        
        // Snap group of SVG obj references for rendered vertices
        this.points = null;
        
        // TODO: extend with 'options'
        this.config = _defaults;
        
        // SVG object reference of vertex being dragged
        this.activeVertex = null;
        
        // Index of vertex being dragged
        this.activeVertexIndex = null;
        
        this.setup();
        this.applyOffsets();
        this.draw();
    }
    
    PolygonEditor.prototype = Object.create(Editor.prototype);
    PolygonEditor.prototype.constructor = PolygonEditor;
    
    PolygonEditor.prototype.setup = function(){
        /*  
            Sets up: this.holder, this.paper, this.snap, this.offsets
            Called manually so you have the option to implement a different drawing surface
        */ 
        Editor.prototype.setup.call(this);
        
        this.vertices = this.parseShape(this.value, this.target);
        
        if (!this.vertices.length){
            this.vertices = this.inferShapeFromElement(this.target);
        }
        
        this.polygonFillRule = this.vertices.polygonFillRule || 'nonzero';
        
        this.points = this.paper.g();
        
        // polygon path to visualize the shape
        this.shape = this.paper.path().attr(this.config.path).attr('fill','none');
        
        // TODO: throttle sensibly
        window.addEventListener('resize', this.refresh.bind(this));
        this.holder.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.holder.addEventListener('dblclick', this.onDblClick.bind(this));
    };
    
    PolygonEditor.prototype.refresh = function(){
        this.removeOffsets();
        this.setupOffsets();
        this.applyOffsets();
        this.draw();
    };
    
    /*
        Parse polygon string into array of objects with x, y coordinates and units for each vertex.
        Returns an empty array if polygon declaration is invalid.
        
        @example: [{x: 0, y: 0, xUnit: px, yUnit: px}, ...]
        
        @param {String} shape CSS polygon function shape
        @param {HTMLElement} element Reference for content box used when converting units to pixels (e.g. % to px). Usually the element onto which the shape is defined.
        
        @return {Array}
    */
    PolygonEditor.prototype.parseShape = function(shape, element){
        var coords = [],
            infos;
        
        // superficial check for shape declaration
        if (typeof shape !== 'string' || !/^polygon\(.*?\)/i.test(shape.trim())){
            
            // remove editor DOM saffolding
            this.remove();
            
            throw new Error('No polygon() function definition in provided value');
        }
        
        infos = /polygon\s*\(([a-z]*),\s*(([-+0-9.]+[a-z%]*|calc\([^)]*\)|\s|\,)*)\)?(\s*)/i.exec(shape.trim());
        
        if (infos){
            coords = (
                infos[2]
                .replace(/\s+/g, ' ')
                .replace(/( ,|, )/g, ',').trim()
                .split(',')
                .map(function(pair) {

                    var points = pair.split(' ').map(function(pointString, i) {
                        
                        // TODO: what about calc(...)?
                        var isHeightRelated = true;
                        
                        return CSSUtils.convertToPixels(pointString, element, isHeightRelated);
                    });
                    
                    if( !points[0] ) { points[0] = { value: 0 }; }
                    if( !points[1] ) { points[1] = { value: 0 }; }
                    
                    return {
                        x: points[0].value,
                        y: points[1].value,
                        xUnit: points[0].unit,
                        yUnit: points[1].unit
                    };
                    
                })
            );
            
            coords.polygonFillRule = infos[1] || null;
        }
        
        return coords;
    };
    
    /*
        Return an array of x, y coordinates and units for the vertices which describe the element as a polygon.
        @throws {TypeError} if element is not a HTMLElement
        
        @param {HTMLElement} element
        @return {Array}
    */
    
    PolygonEditor.prototype.inferShapeFromElement = function(element) {
        if (!(element instanceof HTMLElement)){
            throw new TypeError('inferShapeFromElement() \n Expected HTMLElement, got: ' + typeof element + ' ' + element);
        }
        
        var box = CSSUtils.getContentBoxOf(element);
        
        // TODO: also infer unit values
        var coords = [
            { x: 0, y: 0, xUnit: 'px', yUnit: 'px' },
            { x: box.width, y: 0, xUnit: 'px', yUnit: 'px' },
            { x: box.width, y: box.height, xUnit: 'px', yUnit: 'px' },
            { x: 0, y: box.height, xUnit: 'px', yUnit: 'px' }
        ];
        
        coords.polygonFillRule = 'nonzero';
        
        return coords;
    };
    
    /*
        Return a valid polygon CSS Shape value from the current editor's state.
        @example polygon(nonzero, 0 0, 100px 0, ...)
        
        @return {String}
    */
    PolygonEditor.prototype.getCSSValue = function(){
        var offsetTop = this.offsets.top,
            offsetLeft = this.offsets.left,
            element = this.target,
            // @see http://dev.w3.org/csswg/css-shapes/#typedef-fill-rule
            fillRule = this.polygonFillRule,
            path;
            
        path = this.vertices.map(function(vertex, i){
            var x, y, xCoord, yCoord;
        
            // remove offsets
            x = Math.ceil(vertex.x - offsetLeft);
            y = Math.ceil(vertex.y - offsetTop);

            // turn px value into original units
            xCoord = CSSUtils.convertFromPixels(x, vertex.xUnit, element, false);
            yCoord = CSSUtils.convertFromPixels(y, vertex.yUnit, element, false);
            
            // return space-separted pair
            return [xCoord, yCoord].join(' ');
        });
        
        return 'polygon(' + [fillRule, path.join(', ')].join(', ') + ')';
    };
    
    /*
        Mutates the vertices array to account for element offsets on the page.
        This is required because the editor surface is 100% of the viewport and
        we are working with absolute units while editing.
        
        Offsets must be subtracted when the output polygon value is requested.
        
        @see PolygonEditor.removeOffsets()
    */
    PolygonEditor.prototype.applyOffsets = function(){
        this.vertices.forEach(function(v){
            v.x = v.x + this.offsets.left;
            v.y = v.y + this.offsets.top;
        }.bind(this)
        );
    };
    
    /*
        Mutates the vertices array to subtract the offsets.
        
        @see PolygonEditor.applyOffsets()
    */
    PolygonEditor.prototype.removeOffsets = function(){
        this.vertices.forEach(function(v){
            v.x = v.x - this.offsets.left;
            v.y = v.y - this.offsets.top;
        }.bind(this)
        );
    };
    
    /*
        Mousedown handler:
        - get the vertex at event target, if one exists
        OR
        - insert a new vertex if event target is close to a polygon edge
        THEN
        - attach event handlers for dragging the vertex
    */
    PolygonEditor.prototype.onMouseDown = function(e){
        var edge,
            // need target as a Raphael obj reference; e.target won't suffice.
            target = Snap.getElementByPoint(e.x, e.y);
        
        // prevent vertex editing while transform editor is on
        if (this.transformEditor){
            return;
        }
        
        // check if target is a vertex representation i.e. draggable point
        if (target && target.data && typeof target.data('vertex-index') === 'number'){
            
            this.activeVertex = target;
            this.activeVertexIndex = target.data('vertex-index');
            
        } else {
            
            edge = this.polygonEdgeNear({x: e.x, y: e.y});
            
            if (edge){
                // insert new vertex
                // TODO: insert vertex precisely on the segment, or at event ?
                this.vertices.splice(edge.index1, 0, {
                    x: e.x,
                    y: e.y,
                    // TODO: infer units from the vertices of the edge
                    xUnits: this.config.xUnit,
                    yUnits: this.config.yUnit,
                });
                
                this.draw();
                
                this.activeVertex = Snap.getElementByPoint(e.x, e.y);
                this.activeVertexIndex = edge.index1;
            }
        } 
        
        if (!this.activeVertex || typeof this.activeVertexIndex !== 'number'){
            return;
        }
        
        // attaches mousemove and mouseup
        this.handleDragging();
    };
    
    PolygonEditor.prototype.handleDragging = function(){
        var scope = this;
        var _mouseMove = function(e){
            return scope.onMouseMove.call(scope, e);
        };
        
        var _mouseUp = function(){
            return function(){
                this.activeVertex = null;
                this.activeVertexIndex = null;
                this.holder.removeEventListener('mousemove', _mouseMove);
            }.call(scope);
        };
        
        this.holder.addEventListener('mousemove', _mouseMove);
        this.holder.addEventListener('mouseup', _mouseUp);
    };
    
    /*
        Upate the current active vertex's coordinates with the event x and y,
        then redraw the shape.
    */
    PolygonEditor.prototype.onMouseMove = function(e){
        // 'this' is the PolygonEditor instance
        var vertex = this.vertices[this.activeVertexIndex];
        vertex.x = e.x;
        vertex.y = e.y;
        
        this.draw();
    };
    
    /*
        Given a point with x, y coordinates, attempt to find the polygon edge to which it belongs.
        Returns an object with indexes for the two vertices which define the edge.
        Returns null if the point does not belong to any edge.
        
        @example .polygonEdgeNear({x: 0, y: 100}) // => {index0: 0, index1: 1}
        
        @param {Object} p Object with x, y coordinates for the point to find nearby polygon edge.
        @return {Object | null} 
    */
    PolygonEditor.prototype.polygonEdgeNear = function(p){
        var edge = null,
            vertices = this.vertices,
            radius = this.config.point.radius,
            thresholdDistance = radius * radius;
        
        vertices.forEach(function(v, i){
            var v0 = vertices[i],
                v1 = vertices[(i + 1) % vertices.length];
                
            if (_distanceToEdgeSquared(v0, v1, p) < thresholdDistance){
                edge = {index0: i, index1: (i + 1) % vertices.length};
            }
        });
        
        return edge;
    };
    
    /*
        Double click handler:
        - if event target is on a vertex, remove it
        - redraw shape
        
        //TODO: prevent delete if less than 2 vertices left?
    */
    PolygonEditor.prototype.onDblClick = function(e){
        var target = Snap.getElementByPoint(e.x, e.y);
        
        // check if target is a vertex representation i.e. draggable point
        if (target && target.data && typeof target.data('vertex-index') === 'number'){
            
            // remove the vertex
            this.vertices.splice(target.data('vertex-index'), 1);
            this.draw();
        }
    };
    
    PolygonEditor.prototype.draw = function(){
        var paper = this.paper,
            config = this.config,
            drawVertices = this.transformEditor ? false : true,
            points = this.points,
            commands = [];
            
        this.points.clear();
        
        this.vertices.forEach(function(v, i) {
            if (drawVertices){
                var point = paper.circle(v.x, v.y, config.point.radius);
                point.attr(config.point);
                point.data('vertex-index', i);
                points.add(point);
            }
            
            if (i === 0){
                // Move cursor to first vertex, then prepare drawing lines
                ['M' + v.x, v.y].forEach(function(cmd) {
                    commands.push(cmd);
                });
            } else {
                commands.push('L' + v.x, v.y);
            }
        });
        
        // close path
        commands.push('z');
        
        // draw the polygon shape
        this.shape.attr('path', commands).toBack();
        
        this.trigger('shapechange', this);
    };
    
    PolygonEditor.prototype.toggleFreeTransform = function(){
        
        // make a clone of the vertices to avoid compound tranforms
        var verticesClone = (JSON.parse(JSON.stringify(this.vertices))),
            scope = this;
        
        function _transformPoints(){
            
            var matrix = scope.shapeClone.transform().localMatrix,
                vertices = scope.vertices;
                
            verticesClone.forEach(function(v, i){
                vertices[i].x = matrix.x(v.x,v.y);
                vertices[i].y = matrix.y(v.x,v.y);
            });
            
            scope.draw();
        }
        
        if (this.transformEditor){
            this.shapeClone.remove();
            this.transformEditor.unplug();
            delete this.transformEditor;
            
            // restores vertex editing
            this.draw();
            
            return;
        }
        
        // using a phantom shape because we already redraw the path by the transformed coordinates.
        // using the same path would result in double transformations for the shape
        this.shapeClone = this.shape.clone().attr({ stroke: 'none', fill: this.config.path.fill});
        
        this.transformEditor = Snap.freeTransform(this.shapeClone, {
            draw: ['bbox'],
            drag: ['self','center'],
            keepRatio: ['bboxCorners'],
            rotate: ['axisX'],
            scale: ['bboxCorners','bboxSides'],
            distance: '0.6'
        }, _transformPoints);
    };
    
    PolygonEditor.prototype.turnOnFreeTransform = function(){
        if (this.transformEditor){
            // aready turned on
            return;
        }
        
        this.toggleFreeTransform();
    };
    
    PolygonEditor.prototype.turnOffFreeTransform = function(){
        if (!this.transformEditor){
            // already turned off
            return;
        }
        
        this.toggleFreeTransform();
    };
    
    /*
        Calculate min distance between a point and a line,
        @see http://paulbourke.net/geometry/pointlineplane/
        Accepts three points with x/y keys for unit-less coordinates.
        
        @param {Object} p1 Start of line
        @param {Object} p2 End of line
        @param {Object} p3 Point away from line
        
        @example _distanceToEdgeSquared({x:0, y:0}, {x: 0, y: 100}, {x: 100, 100})
        
        @return {Number} distance from point to line
    */
    function _distanceToEdgeSquared(p1, p2, p3){
        var dx = p2.x - p1.x;
        var dy = p2.y - p1.y;
        
        if (dx === 0 && dy === 0){
            return Number.POSITIVE_INFNITY;
        }
        
        var u = ((p3.x - p1.x) * dx + (p3.y - p1.y) * dy) / (dx * dx + dy * dy);
        
        if (u < 0 || u > 1){
            return Number.POSITIVE_INFINITY;
        }
        
        var x = p1.x + u * dx;  // closest point on edge p1,p2 to p3
        var y = p1.y + u * dy;
        
        return Math.pow(p3.x - x, 2) + Math.pow(p3.y - y, 2);
    }
    
    return PolygonEditor;
});

/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define */

define('CircleEditor',['Editor','CSSUtils', 'snap'], function(Editor, CSSUtils, Snap){
    
    
    var _defaults = {
        path: {
            stroke: 'black',
            fill: 'rgba(0,0,0,0)' // tricks transform editor to accept self-drag
        },
        cxUnit: 'px',
        cyUnit: 'px',
        rUnit: 'px'
    };
    
    function CircleEditor(target, value, options){
        Editor.apply(this, arguments);
        
        // coordinates for circle: cx, cy, radius and corresponding units
        this.coords = null;
        
        // TODO: extend with options
        this.config = _defaults;
        
        this.setup();
        this.applyOffsets();
        this.draw();
        
        this.toggleFreeTransform();
    }
    
    CircleEditor.prototype = Object.create(Editor.prototype);
    CircleEditor.prototype.constructor = CircleEditor;

    CircleEditor.prototype.setup = function(){
        // Sets up: this.holder, this.paper, this.snap, this.offsets
        Editor.prototype.setup.call(this);
        
        this.coords = this.parseShape(this.value);
        
        if (!this.coords){
            this.coords = this.inferShapeFromElement(this.target);
        }
        
        this.shape = this.paper.circle().attr(this.config.path);
        
        // TODO: throttle sensibly
        window.addEventListener('resize', this.refresh.bind(this));
    };
    
    CircleEditor.prototype.refresh = function(){
        this.removeOffsets();
        this.setupOffsets();
        this.applyOffsets();
        this.draw();
    };
    
    /*
        Add the element's offsets to the circle coordinates.
        
        The editor surface covers 100% of the viewport and we're working 
        with absolute units while editing.
        
        @see CircleEditor.removeOffsets()
    */
    CircleEditor.prototype.applyOffsets = function(){
        var cx = this.coords.cx + this.offsets.left,
            cy = this.coords.cy + this.offsets.top;
        
        this.coords.cx = cx;
        this.coords.cy = cy;
    };
    
    /*
        Subtract the element's offsets from the circle coordinates.
        
        @see CircleEditor.applyOffsets()
    */
    CircleEditor.prototype.removeOffsets = function(){
        var cx = this.coords.cx - this.offsets.left,
            cy = this.coords.cy - this.offsets.top;
        
        this.coords.cx = cx;
        this.coords.cy = cy;
    };
    
    /*
        Parse circle string into object with coordinates for center, radius and units.
        Returns undefined if cannot parse shape.
        
        TODO: account for upcoming notation: http://dev.w3.org/csswg/css-shapes/#funcdef-circle
        
        @example:
        {
            cx: 0,          // circle center x
            cxUnit: 'px',
            cy: 0,          // circle center y
            cyUnit: 'px',
            r: 50,          // circle radius
            rUnit: '%'
        }
        
        @param {String} shape CSS circle function shape
        
        @return {Object | undefined}
    */
    CircleEditor.prototype.parseShape = function(shape){
        var element = this.target,
            coords,
            infos,
            args;
            
        // superficial check for shape declaration
        if (typeof shape !== 'string' || !/^circle\(.*?\)/i.test(shape.trim())){
            
            // remove editor DOM saffolding
            this.remove();
            
            throw new Error('No circle() function definition in provided value');
        }
        
        infos = /circle\s*\(((\s*[-+0-9.]+[a-z%]*\s*,*\s*){3})\s*\)/i.exec(shape.trim());
            
        if (infos){
            if (!infos[1]){
                return;
            }
            
            args = infos[1].replace(/\s+/g, '').split(',');
            
            // incomplete circle definition
            if (args.length < 3){
                return;
            }
            
            args = args.map(function(arg, i){
                
                // third argument is the radius. special case for circle & ellipse
                var isHeightRelated = (i === 0) ? 0 : 1; // TODO: figure this out from Francois
                
                return CSSUtils.convertToPixels(arg, element, isHeightRelated);
            });
            
            coords = {
                cx: args[0].value,
                cxUnit: args[0].unit,
                cy: args[1].value,
                cyUnit: args[1].unit,
                r: args[2].value,
                rUnit: args[2].unit
            };
        } 
        
        return coords;
    };
    
    /*
        Attempt to infer the coordinates for a circle that fits within the element.
        The center is at the element's center. The radius is the distance from the center to the closest edge.
        
        @throws Error if the element has no width or height.
        
        @param {HTMLElement} element Element from which to infer the shape.
        @return {Object} coordinates for circle. @see CircleEditor.parseShape()
    */
    CircleEditor.prototype.inferShapeFromElement = function(element){
        if (!(element instanceof HTMLElement)){
            throw new TypeError('inferShapeFromElement() \n Expected HTMLElement, got: ' + typeof element + ' ' + element);
        }
        
        var box = CSSUtils.getContentBoxOf(element);

        if (!box.height || !box.width){
            throw new Error('inferShapeFromElement() \n Cannot infer shape from element because it has no width or height');
        }
        
        // TODO: also infer unit values
        return {
            cx: box.width / 2,
            cxUnit: this.config.cxUnit,
            cy: box.height / 2,
            cyUnit: this.config.cyUnit,
            // pick radius in relation to closest-edge
            r: Math.min(box.height, box.width) / 2,
            rUnit: this.config.rUnit
        };
    };
    
    CircleEditor.prototype.getCSSValue = function(){
        var cx = this.coords.cx - this.offsets.left,
            cy = this.coords.cy - this.offsets.top,
            r = this.coords.r;
            
        cx = CSSUtils.convertFromPixels(cx, this.coords.cxUnit, this.target, false);
        cy = CSSUtils.convertFromPixels(cy, this.coords.cyUnit, this.target, false);
        r = CSSUtils.convertFromPixels(r, this.coords.rUnit, this.target, true);
        
        return 'circle(' + [cx, cy, r].join(', ') + ')';
    };
    
    CircleEditor.prototype.toggleFreeTransform = function(){
        
        // make a clone to avoid compound tranforms
        var coordsClone = (JSON.parse(JSON.stringify(this.coords)));
        var scope = this;
        
        function _transformPoints(){
            var matrix = scope.shapeClone.transform().localMatrix;
            
            scope.coords.cx = matrix.x(coordsClone.cx, coordsClone.cy);
            scope.coords.cy = matrix.y(coordsClone.cx, coordsClone.cy);
            scope.coords.r = scope.transformEditor.attrs.scale.x * coordsClone.r;
            
            scope.draw();
        }
        
        if (this.transformEditor){
            this.shapeClone.remove();
            this.transformEditor.unplug();
            delete this.transformEditor;
            
            return;
        }
        
        // using a phantom shape because we already redraw the path by the transformed coordinates.
        // using the same path would result in double transformations for the shape
        this.shapeClone = this.shape.clone().attr('stroke', 'none');
        
        this.transformEditor = Snap.freeTransform(this.shapeClone, {
            draw: ['bbox'],
            drag: ['self','center'],
            keepRatio: ['bboxCorners'],
            rotate: [],
            scale: ['bboxCorners'],
            distance: '0.6'
        }, 
        _transformPoints);
    };
    
    
    CircleEditor.prototype.draw = function(){
        // draw the circle shape
        this.shape.attr(this.coords);
        
        this.trigger('shapechange', this);
    };
    
    return CircleEditor;
});
/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define */

define('EllipseEditor',['Editor','CSSUtils', 'snap'], function(Editor, CSSUtils, Snap){
    
    
    var _defaults = {
        path: {
            stroke: 'black',
            fill: 'rgba(0,0,0,0)' // tricks transform editor to accept self-drag
        },
        cxUnit: 'px',
        cyUnit: 'px',
        rxUnit: 'px',
        ryUnit: 'px'
    };
    
    function EllipseEditor(target, value, options){
        Editor.apply(this, arguments);
        
        // coordinates for circle: cx, cy, x and y radii and corresponding units
        this.coords = null;
        
        // TODO: extend with options
        this.config = _defaults;
        
        this.setup();
        this.applyOffsets();
        this.draw();
        
        this.toggleFreeTransform();
    }
    
    EllipseEditor.prototype = Object.create(Editor.prototype);
    EllipseEditor.prototype.constructor = EllipseEditor;

    EllipseEditor.prototype.setup = function(){
        // Sets up: this.holder, this.paper, this.snap, this.offsets
        Editor.prototype.setup.call(this);
        
        this.coords = this.parseShape(this.value);
        
        if (!this.coords){
            this.coords = this.inferShapeFromElement(this.target);
        }
        
        this.shape = this.paper.ellipse().attr(this.config.path);
        
        // TODO: throttle sensibly
        window.addEventListener('resize', this.refresh.bind(this));
    };
    
    EllipseEditor.prototype.refresh = function(){
        this.removeOffsets();
        this.setupOffsets();
        this.applyOffsets();
        this.draw();
    };
    
    /*
        Add the element's offsets to the ellipse center coordinates.
        
        The editor surface covers 100% of the viewport and we're working 
        with absolute units while editing.
        
        @see EllipseEditor.removeOffsets()
    */
    EllipseEditor.prototype.applyOffsets = function(){
        var cx = this.coords.cx + this.offsets.left,
            cy = this.coords.cy + this.offsets.top;
        
        this.coords.cx = cx;
        this.coords.cy = cy;
    };
    
    /*
        Subtract the element's offsets from the ellipse center coordinates.
        
        @see EllipseEditor.applyOffsets()
    */
    EllipseEditor.prototype.removeOffsets = function(){
        var cx = this.coords.cx - this.offsets.left,
            cy = this.coords.cy - this.offsets.top;
        
        this.coords.cx = cx;
        this.coords.cy = cy;
    };
    
    /*
        Parse ellipse string into object with coordinates for center, radii and units.
        Returns undefined if cannot parse shape.
        
        TODO: account for upcoming notation: http://dev.w3.org/csswg/css-shapes/#funcdef-ellipse
        
        @example:
        {
            cx: 0,          // ellipse center x
            cxUnit: 'px',
            cy: 0,          // ellipse center y
            cyUnit: 'px',
            rx: 50,          // ellipse x radius
            rxUnit: '%',
            ry: 50,          // ellipse y radius
            ryUnit: '%'
        }
        
        @param {String} shape CSS ellipse function shape
        
        @return {Object | undefined}
    */
    EllipseEditor.prototype.parseShape = function(shape){
        var element = this.target,
            coords,
            infos,
            args;

        // superficial check for ellipse declaration
        if (typeof shape !== 'string' || !/^ellipse\(.*?\)/i.test(shape.trim())){

            // remove editor DOM saffolding
            this.remove();

            throw new Error('No ellipse() function definition in provided value');
        }
        
        infos = /ellipse\s*\(((\s*[-+0-9.]+[a-z%]*\s*,*\s*){4})\s*\)/i.exec(shape.trim());
        
        if (infos){
            if (!infos[1]){
                return;
            }
            
            args = infos[1].replace(/\s+/g, '').split(',');
            
            // incomplete ellipse definition
            if (args.length < 4){
                return;
            }
            
            args = args.map(function(arg, i){
                
                // third argument is the radius. special case for circle & ellipse
                var isHeightRelated = (i === 0) ? 0 : 1; // TODO: figure this out from Francois
                
                return CSSUtils.convertToPixels(arg, element, isHeightRelated);
            });
            
            coords = {
                cx: args[0].value,
                cxUnit: args[0].unit,
                cy: args[1].value,
                cyUnit: args[1].unit,
                rx: args[2].value,
                rxUnit: args[2].unit,
                ry: args[3].value,
                ryUnit: args[3].unit
            };
        } 
        
        return coords;
    };
    
    /*
        Attempt to infer the coordinates for an ellipse that fits within the element.
        The center is at the element's center. The x radius is half the element's width.
        The y radius is half the element's height.
        
        @throws Error if the element has no width or height.
        
        @param {HTMLElement} element Element from which to infer the shape.
        @return {Object} coordinates for ellipse. @see EllipseEditor.parseShape()
    */
    EllipseEditor.prototype.inferShapeFromElement = function(element){
        if (!(element instanceof HTMLElement)){
            throw new TypeError('inferShapeFromElement() \n Expected HTMLElement, got: ' + typeof element + ' ' + element);
        }
        
        var box = CSSUtils.getContentBoxOf(element);

        if (!box.height || !box.width){
            throw new Error('inferShapeFromElement() \n Cannot infer shape from element because it has no width or height');
        }
        
        // TODO: also infer unit values
        return {
            cx: box.width / 2,
            cxUnit: this.config.cxUnit,
            cy: box.height / 2,
            cyUnit: this.config.cyUnit,
            rx: box.width / 2,
            rxUnit: this.config.rxUnit,
            ry: box.height / 2,
            ryUnit: this.config.ryUnit
        };
    };
    
    EllipseEditor.prototype.getCSSValue = function(){
        var cx = this.coords.cx - this.offsets.left,
            cy = this.coords.cy - this.offsets.top,
            rx = this.coords.rx,
            ry = this.coords.ry;
            
        cx = CSSUtils.convertFromPixels(cx, this.coords.cxUnit, this.target, false);
        cy = CSSUtils.convertFromPixels(cy, this.coords.cyUnit, this.target, false);
        rx = CSSUtils.convertFromPixels(rx, this.coords.rxUnit, this.target, true);
        ry = CSSUtils.convertFromPixels(ry, this.coords.ryUnit, this.target, true);
        
        return 'ellipse(' + [cx, cy, rx, ry].join(', ') + ')';
    };
    
    EllipseEditor.prototype.toggleFreeTransform = function(){
        
        // make a clone to avoid compound tranforms
        var coordsClone = (JSON.parse(JSON.stringify(this.coords))),
            scope = this;
        
        function _transformPoints(){
            var matrix = scope.shapeClone.transform().localMatrix;
            
            scope.coords.cx = matrix.x(coordsClone.cx, coordsClone.cy);
            scope.coords.cy = matrix.y(coordsClone.cx, coordsClone.cy);
            scope.coords.rx = scope.transformEditor.attrs.scale.x * coordsClone.rx;
            scope.coords.ry = scope.transformEditor.attrs.scale.y * coordsClone.ry;
            
            scope.draw();
        }
        
        if (this.transformEditor){
            this.shapeClone.remove();
            this.transformEditor.unplug();
            delete this.transformEditor;
            
            return;
        }
        
        // using a phantom shape because we already redraw the path by the transformed coordinates.
        // using the same path would result in double transformations for the shape
        this.shapeClone = this.shape.clone().attr('stroke', 'none');
        
        this.transformEditor = Snap.freeTransform(this.shapeClone, {
            draw: ['bbox'],
            drag: ['self','center'],
            keepRatio: ['bboxCorners'],
            rotate: [], // ellipses do not rotate
            scale: ['bboxCorners','bboxSides'],
            distance: '0.6'
        }, _transformPoints);
    };
    
    
    EllipseEditor.prototype.draw = function(){
        // draw the ellipse shape
        this.shape.attr(this.coords);
        
        this.trigger('shapechange', this);
    };
    
    return EllipseEditor;
});

/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define */

define('RectangleEditor',['Editor','CSSUtils', 'snap'], function(Editor, CSSUtils, Snap){
    
    
    var _defaults = {
        path: {
            stroke: 'black',
            fill: 'rgba(0,0,0,0)' // tricks transform editor to accept self-drag
        },
        xUnit: 'px',
        yUnit: 'px',
        wUnit: 'px',
        hUnit: 'px',
        rxUnit: 'px',
        ryUnit: 'px'
    };
    
    function RectangleEditor(target, value, options){
        Editor.apply(this, arguments);
        
        // coordinates for rectangle: x,y for origin, with, height and units
        this.coords = null;
        
        // TODO: extend with options
        this.config = _defaults;
        
        this.setup();
        this.applyOffsets();
        this.draw();
        
        this.toggleFreeTransform();
    }
    
    RectangleEditor.prototype = Object.create(Editor.prototype);
    RectangleEditor.prototype.constructor = RectangleEditor;

    RectangleEditor.prototype.setup = function(){
        // Sets up: this.holder, this.paper, this.snap, this.offsets
        Editor.prototype.setup.call(this);
        
        this.coords = this.parseShape(this.value);
        
        if (!this.coords){
            this.coords = this.inferShapeFromElement(this.target);
        }
        
        this.shape = this.paper.rect().attr(this.config.path);
        
        // TODO: throttle sensibly
        window.addEventListener('resize', this.refresh.bind(this));
    };
    
    RectangleEditor.prototype.refresh = function(){
        this.removeOffsets();
        this.setupOffsets();
        this.applyOffsets();
        this.draw();
    };
    
    /*
        Add the element's offsets to the rectangle origin coordinates
        
        The editor surface covers 100% of the viewport and we're working 
        with absolute units while editing.
        
        @see RectangleEditor.removeOffsets()
    */
    RectangleEditor.prototype.applyOffsets = function(){
        var x = this.coords.x + this.offsets.left,
            y = this.coords.y + this.offsets.top;
        
        this.coords.x = x;
        this.coords.y = y;
    };
    
    /*
        Subtract the element's offsets from the rectangle origin coordinates
        
        @see RectangleEditor.applyOffsets()
    */
    RectangleEditor.prototype.removeOffsets = function(){
        var x = this.coords.x - this.offsets.left,
            y = this.coords.y - this.offsets.top;
        
        this.coords.x = x;
        this.coords.y = y;
    };
    
    /*
        Parse rectangle string into object with coordinates for origin, dimensions, borer-radius and units
        Returns undefined if cannot parse shape.
        
        @example:
        {
            x: 0,          // x of origin (top-left corner)
            xUnit: 'px',
            y: 0,          // y of origin (top-left corner)
            yUnit: 'px',
            w: 50,         // rectangle width
            wUnit: '%',
            h: 50,         // rectangle height
            hUnit: '%'
            rx: 5,        // [optional] horizontal radius for rounded corners
            rxUnit: '%'
            ry: 5,        // [optional] vertical radius for rounded corners
            ryUnit: '%'
        }
        
        @param {String} shape CSS rectangle function shape
        
        @return {Object | undefined}
    */
    RectangleEditor.prototype.parseShape = function(shape){
        var element = this.target,
            coords,
            infos,
            args;

        // superficial check for rectangle declaration
        if (typeof shape !== 'string' || !/^rectangle\(.*?\)/i.test(shape.trim())){

            // remove editor DOM saffolding
            this.remove();

            throw new Error('No rectangle() function definition in provided value');
        }
        
        infos = /rectangle\s*\(((\s*[-+0-9.]+[a-z%]*\s*,*\s*){4,6})\s*\)/i.exec(shape.trim());
        
        if (infos){
            if (!infos[1]){
                return;
            }
            
            args = infos[1].replace(/\s+/g, '').split(',');
            
            // incomplete rectangle definition
            if (args.length < 4){
                return;
            }
            
            args = args.map(function(arg, i){
                var isHeightRelated = (i === 0) ? 0 : 1;
                return CSSUtils.convertToPixels(arg, element, isHeightRelated);
            });
            
            coords = {
                x: args[0].value,
                xUnit: args[0].unit,
                y: args[1].value,
                yUnit: args[1].unit,
                w: args[2].value,
                wUnit: args[2].unit,
                h: args[3].value,
                hUnit: args[3].unit
            };
            
            if (args[4]){
                coords.rx = args[4].value;
                coords.rxUnit = args[4].unit;
                
                if (!args[5]){
                    // only one radius defined, use same for both rx and ry
                    coords.ry = args[4].value;
                    coords.ryUnit = args[4].unit;
                }
                else{
                    // special radius defined for ry, use that.
                    coords.ry = args[5].value;
                    coords.ryUnit = args[5].unit;
                }
            }
        } 
        
        return coords;
    };
    
    /*
        Attempt to infer the coordinates for a rectangle that fits within the element.
        The origin is the element's top-left corner. 
        The width is the element's width; likewise the height.
        
        @throws Error if the element has no width or height.
        
        @param {HTMLElement} element Element from which to infer the shape.
        @return {Object} coordinates for rectangle. @see RectangleEditor.parseShape()
    */
    RectangleEditor.prototype.inferShapeFromElement = function(element){
        if (!(element instanceof HTMLElement)){
            throw new TypeError('inferShapeFromElement() \n Expected HTMLElement, got: ' + typeof element + ' ' + element);
        }
        
        var box = CSSUtils.getContentBoxOf(element);

        if (!box.height || !box.width){
            throw new Error('inferShapeFromElement() \n Cannot infer shape from element because it has no width or height');
        }
        
        // TODO: also infer unit values
        return {
            x: 0,
            xUnit: this.config.xUnit,
            y: 0,
            yUnit: this.config.yUnit,
            w: box.width,
            wUnit: this.config.wUnit,
            h: box.height,
            hUnit: this.config.hUnit
        };
    };
    
    RectangleEditor.prototype.getCSSValue = function(){
        var c = this.coords,
            x, y, w, h, args;

        x = CSSUtils.convertFromPixels(c.x - this.offsets.left, c.xUnit, this.target, false);
        y = CSSUtils.convertFromPixels(c.y - this.offsets.top, c.yUnit, this.target, false);
        w = CSSUtils.convertFromPixels(c.w, c.wUnit, this.target, true);
        h = CSSUtils.convertFromPixels(c.h, c.hUnit, this.target, true);
        // TODO: figure out how to convert border-radius

        args = [x, y, w, h];
        
        if (c.rx){
            args.push( [c.rx, c.rxUnit].join('') );
        }
        
        if (c.ry){
            args.push( [c.ry, c.ryUnit].join('') );
        }
        
        return 'rectangle(' + args.join(', ') + ')';
    };
    
    RectangleEditor.prototype.toggleFreeTransform = function(){
        
        // make a clone to avoid compound tranforms
        var coordsClone = (JSON.parse(JSON.stringify(this.coords))),
            scope = this;
        
        function _transformPoints(){
            var matrix = scope.shapeClone.transform().localMatrix;
            
            scope.coords.x = matrix.x(coordsClone.x, coordsClone.y);
            scope.coords.y = matrix.y(coordsClone.x, coordsClone.y);
            scope.coords.w = scope.transformEditor.attrs.scale.x * coordsClone.w;
            scope.coords.h = scope.transformEditor.attrs.scale.y * coordsClone.h;
            
            scope.draw();
        }
        
        if (this.transformEditor){
            this.shapeClone.remove();
            this.transformEditor.unplug();
            delete this.transformEditor;
            
            return;
        }
        
        // using a phantom shape because we already redraw the path by the transformed coordinates.
        // using the same path would result in double transformations for the shape
        this.shapeClone = this.shape.clone().attr('stroke', 'none');
        
        this.transformEditor = Snap.freeTransform(this.shapeClone, {
            draw: ['bbox'],
            drag: ['self','center'],
            keepRatio: ['bboxCorners'],
            rotate: [], // rectangles do not rotate, polygons do.
            scale: ['bboxCorners','bboxSides'],
            distance: '0.6'
        }, _transformPoints);
    };
    
    RectangleEditor.prototype.draw = function(){
        
        // draw the rectangle
        this.shape.attr({
            x: this.coords.x,
            y: this.coords.y,
            width: this.coords.w,
            height: this.coords.h,
            rx : this.coords.rx || 0,
            ry : this.coords.rx || 0
        });
        
        this.trigger('shapechange', this);
    };
    
    return RectangleEditor;
});

/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define */

define('CSSShapesEditor',['PolygonEditor', 'CircleEditor', 'EllipseEditor', 'RectangleEditor'], function(PolygonEditor, CircleEditor, EllipseEditor, RectangleEditor){
    
    
    
    function CSSShapesEditor(target, value, options){
        
        // ensure omitting 'new' is harmless
        if (!(this instanceof CSSShapesEditor)){
            return new CSSShapesEditor(target, value, options);
        }
        
        if (value.indexOf('(') < 0) {
            throw new TypeError('Value does not contain a shape function');
        }
        
        var shape = value.split('(')[0].trim(),
            Factory;
        
        switch (shape) {
        case 'polygon':
            Factory = PolygonEditor;
            break;
            
        case 'circle':
            Factory = CircleEditor;
            break;
            
        case 'ellipse':
            Factory = EllipseEditor;
            break;
            
        case 'rectangle':
            Factory = RectangleEditor;
            break;
            
        default:
            throw new TypeError('Value does not contain a valid shape function');
        }
        
        return new Factory(target, value, options);
    }
    
    return CSSShapesEditor;
});

/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, require */

require.config({
    // baseUrl: './', // infered from data-main on <script>
    paths: {
        'eve': 'third-party/eve/eve',
        'snap': 'third-party/snap/snap.svg-min',
        'snap.plugins': 'third-party/snap.plugins/snap.plugins',
        'snap.freeTransform': 'third-party/snap.freetransform/snap.freetransform'
    }
});

define('main', ['CSSShapesEditor'], function(editor){
    
    
    
    return editor;
});    //The modules for your project will be inlined above
    //this snippet. Ask almond to synchronously require the
    //module value for 'main' here and return it as the
    //value to use for the public API for the built file.
    
    // intentional implicit global var to expose API
    CSSShapesEditor = require('main');
}));
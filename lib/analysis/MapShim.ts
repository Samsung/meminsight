/*!
 * https://github.com/paulmillr/es6-shim
 * @license es6-shim Copyright 2013-2014 by Paul Miller (http://paulmillr.com)
 * and contributors, MIT License
 * es6-shim: v0.20.2
 * see https://github.com/paulmillr/es6-shim/blob/master/LICENSE
 * Details and documentation:
 * https://github.com/paulmillr/es6-shim/
 */

/**
 * modified by Manu Sridharan to extract just the aspects of the Map
 * module that we need and to fit into our TypeScript build system
 */

declare var Symbol: any;

module ___LoggingAnalysis___ {

    var _toString = Object.prototype.toString;
    var _defineProperty = Object.defineProperty;

    var TypeIsObject = function (x) {
        /* jshint eqnull:true */
        // this is expensive when it returns false; use this function
        // when you expect it to return true in the common case.
        return x != null && Object(x) === x;
    };

    var IsCallable = function (x) {
        return typeof x === 'function' &&
                // some versions of IE say that typeof /abc/ === 'function'
            _toString.call(x) === '[object Function]';
    };

    var isNaN = function (value) {
        // NaN !== NaN, but they are identical.
        // NaNs are the only non-reflexive value, i.e., if x !== x,
        // then x is NaN.
        // isNaN is broken: it converts its argument to number, so
        // isNaN('foo') => true
        return value !== value;
    };

    var SameValueZero = function (a, b) {
        // same as SameValue except for SameValueZero(+0, -0) == true
        return (a === b) || (isNaN(a) && isNaN(b));
    };

    var SameValue = function (a, b) {
        if (a === b) {
            // 0 === -0, but they are not identical.
            if (a === 0) { return 1 / a === 1 / b; }
            return true;
        }
        return isNaN(a) && isNaN(b);
    };


    var defineProperty = function (object, name, value, force) {
        if (!force && name in object) {
            return;
        }
        _defineProperty(object, name, {
            configurable: true,
            enumerable: false,
            writable: true,
            value: value
        });
    };

    // Define configurable, writable and non-enumerable props
    // if they don’t exist.
    var defineProperties = function (object, map) {
        Object.keys(map).forEach(function (name) {
            var method = map[name];
            defineProperty(object, name, method, false);
        });
    };


    var emulateES6construct = function (o) {
        if (!TypeIsObject(o)) { throw new TypeError('bad object'); }
        // es5 approximation to es6 subclass semantics: in es6, 'new Foo'
        // would invoke Foo.@@create to allocation/initialize the new object.
        // In es5 we just get the plain object.  So if we detect an
        // uninitialized object, invoke o.constructor.@@create
        if (!o._es6construct) {
            if (o.constructor && IsCallable(o.constructor['@@create'])) {
                o = o.constructor['@@create'](o);
            }
            defineProperties(o, { _es6construct: true });
        }
        return o;
    };

    var emptyObject = function emptyObject() {
        // accomodate some older not-quite-ES5 browsers
        return Object.create ? Object.create(null) : {};
    };

    // Simple shim for Object.create on ES3 browsers
    // (unlike real shim, no attempt to support `prototype === null`)
    var create = Object.create || function (prototype, properties) {
            function Type() {}
            Type.prototype = prototype;
            var object = new Type();
            if (typeof properties !== 'undefined') {
                defineProperties(object, properties);
            }
            return object;
        };

    // Map and Set require a true ES5 environment
    // Their fast path also requires that the environment preserve
    // property insertion order, which is not guaranteed by the spec.
    var testOrder = function (a) {
        var b = Object.keys(a.reduce(function (o, k) {
            o[k] = true;
            return o;
        }, {}));
        return a.join(':') === b.join(':');
    };

    var preservesInsertionOrder = testOrder(['z', 'a', 'bb']);
    // some engines (eg, Chrome) only preserve insertion order for string keys
    var preservesNumericInsertionOrder = testOrder(['z', 1, 'a', '3', 2]);


    var fastkey = function fastkey(key) {
        if (!preservesInsertionOrder) {
            return null;
        }
        var type = typeof key;
        if (type === 'string') {
            return '$' + key;
        } else if (type === 'number') {
            // note that -0 will get coerced to "0" when used as a property key
            if (!preservesNumericInsertionOrder) {
                return 'n' + key;
            }
            return key;
        }
        return null;
    };

    var emptyObject = function emptyObject() {
        // accomodate some older not-quite-ES5 browsers
        return Object.create ? Object.create(null) : {};
    };

    var MyMap = (function () {

        var empty = {};

        function MapEntry(key, value) {
            this.key = key;
            this.value = value;
            this.next = null;
            this.prev = null;
        }

        MapEntry.prototype.isRemoved = function () {
            return this.key === empty;
        };

        function MapIterator(map, kind) {
            this.head = map._head;
            this.i = this.head;
            this.kind = kind;
        }

        MapIterator.prototype = {
            next: function () {
                var i = this.i, kind = this.kind, head = this.head, result;
                if (typeof this.i === 'undefined') {
                    return { value: void 0, done: true };
                }
                while (i.isRemoved() && i !== head) {
                    // back up off of removed entries
                    i = i.prev;
                }
                // advance to next unreturned element.
                while (i.next !== head) {
                    i = i.next;
                    if (!i.isRemoved()) {
                        if (kind === 'key') {
                            result = i.key;
                        } else if (kind === 'value') {
                            result = i.value;
                        } else {
                            result = [i.key, i.value];
                        }
                        this.i = i;
                        return { value: result, done: false };
                    }
                }
                // once the iterator is done, it is done forever.
                this.i = void 0;
                return { value: void 0, done: true };
            }
        };
//        addIterator(MapIterator.prototype);

        function Map() {
            var map = this;
            map = emulateES6construct(map);
            if (!map._es6map) {
                throw new TypeError('bad map');
            }

            var head = new MapEntry(null, null);
            // circular doubly-linked list.
            head.next = head.prev = head;

            defineProperties(map, {
                _head: head,
                _storage: emptyObject(),
                _size: 0
            });

            return map;
        }
        var Map$prototype = Map.prototype;
        defineProperties(Map, {
            '@@create': function (obj) {
                var constructor = this;
                var prototype = constructor.prototype || Map$prototype;
                obj = obj || create(prototype);
                defineProperties(obj, { _es6map: true });
                return obj;
            }
        });

        _defineProperty(Map.prototype, 'size', {
            configurable: true,
            enumerable: false,
            get: function () {
                if (typeof this._size === 'undefined') {
                    throw new TypeError('size method called on incompatible Map');
                }
                return this._size;
            }
        });

        defineProperties(Map.prototype, {
            get: function (key) {
                var fkey = fastkey(key);
                if (fkey !== null) {
                    // fast O(1) path
                    var entry = this._storage[fkey];
                    if (entry) {
                        return entry.value;
                    } else {
                        return;
                    }
                }
                var head = this._head, i = head;
                while ((i = i.next) !== head) {
                    if (SameValueZero(i.key, key)) {
                        return i.value;
                    }
                }
                return;
            },

            has: function (key) {
                var fkey = fastkey(key);
                if (fkey !== null) {
                    // fast O(1) path
                    return typeof this._storage[fkey] !== 'undefined';
                }
                var head = this._head, i = head;
                while ((i = i.next) !== head) {
                    if (SameValueZero(i.key, key)) {
                        return true;
                    }
                }
                return false;
            },

            set: function (key, value) {
                var head = this._head, i = head, entry;
                var fkey = fastkey(key);
                if (fkey !== null) {
                    // fast O(1) path
                    if (typeof this._storage[fkey] !== 'undefined') {
                        this._storage[fkey].value = value;
                        return this;
                    } else {
                        entry = this._storage[fkey] = new MapEntry(key, value);
                        i = head.prev;
                        // fall through
                    }
                }
                while ((i = i.next) !== head) {
                    if (SameValueZero(i.key, key)) {
                        i.value = value;
                        return this;
                    }
                }
                entry = entry || new MapEntry(key, value);
                if (SameValue(-0, key)) {
                    entry.key = +0; // coerce -0 to +0 in entry
                }
                entry.next = this._head;
                entry.prev = this._head.prev;
                entry.prev.next = entry;
                entry.next.prev = entry;
                this._size += 1;
                return this;
            },

            'delete': function (key) {
                var head = this._head, i = head;
                var fkey = fastkey(key);
                if (fkey !== null) {
                    // fast O(1) path
                    if (typeof this._storage[fkey] === 'undefined') {
                        return false;
                    }
                    i = this._storage[fkey].prev;
                    delete this._storage[fkey];
                    // fall through
                }
                while ((i = i.next) !== head) {
                    if (SameValueZero(i.key, key)) {
                        i.key = i.value = empty;
                        i.prev.next = i.next;
                        i.next.prev = i.prev;
                        this._size -= 1;
                        return true;
                    }
                }
                return false;
            },

            clear: function () {
                this._size = 0;
                this._storage = emptyObject();
                var head = this._head, i = head, p = i.next;
                while ((i = p) !== head) {
                    i.key = i.value = empty;
                    p = i.next;
                    i.next = i.prev = head;
                }
                head.next = head.prev = head;
            },

            keys: function () {
                return new MapIterator(this, 'key');
            },

            values: function () {
                return new MapIterator(this, 'value');
            },

            entries: function () {
                return new MapIterator(this, 'key+value');
            },

            forEach: function (callback) {
                var context = arguments.length > 1 ? arguments[1] : null;
                var it = this.entries();
                for (var entry = it.next(); !entry.done; entry = it.next()) {
                    callback.call(context, entry.value[1], entry.value[0], this);
                }
            }
        });
        return Map;
    })();

    export function allocMap<K,V>(): Map<K,V> {
        if (typeof Map !== 'undefined') {
            return new Map<K,V>();
        } else {
            return new (<any>MyMap)();
        }
    }

}

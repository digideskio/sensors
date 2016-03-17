"use strict";
(function (exports) {
    function queueATask(fn) {
        setTimeout(fn, 0);
    }
    function Sensor() {
        if (this.constructor === Sensor) {
            throw new TypeError("Illegal constructor");
        }
        var eventTarget = document.createDocumentFragment();
        function addEventListener(type, listener, useCapture, wantsUntrusted) {
            return eventTarget.addEventListener(type, listener, useCapture, wantsUntrusted);
        }

        function dispatchEvent(event) {
            var methodName = "on" + event.type;
            if (typeof this[methodName] == "function") {
                this[methodName](event);
            }
            return eventTarget.dispatchEvent(event);
        }

        function removeEventListener(type, listener, useCapture) {
            return eventTarget.removeEventListener(type, listener, useCapture);
        }

        this.addEventListener = addEventListener;
        this.dispatchEvent = dispatchEvent;
        this.removeEventListener = removeEventListener;
    }
    
    function SensorReading() {
    }
    
    function SensorReadingEvent(type, options) {
        var event = new Event(type, options);
        event.reading = options.reading;
        event.constructor = SensorReadingEvent;
        return event;
    }
    
    var _geolocationSensor = (function() {
        var self = {};
        var SUPPORTED_REPORTING_MODES = ["auto"];
        var currentReportingMode = "auto";
        var associatedSensors = new Set();
        var state = "idle"; // one of idle, activating, active, primed,
        var currentReading = null;
        var cachedReading = null;
        var _watchId = null;
        var _timeout = null;
        function _calculateAccuracy() {
            var accuracy = "low";
            associatedSensors.forEach(function(sensor) {
                if (getSlot(sensor, "options").accuracy == "high") {
                    accuracy = "high";
                }
            });
            return accuracy;
        }
        
        var _options = null;
        
        function getOptions() {
            return {
                accuracy: _calculateAccuracy()
            };
        }
        
        function haveOptionsChanged(opt) {
            if (!_options) return true;
            if (_options.accuracy !== opt.accuracy) return true;
            return false;
        }

        function canEmitCachedReading(sensor) {
            if (!currentReading) return false;
            var maxAge = getSlot(sensor, "options").maxAge;
            if (maxAge == null) {
                return true;
            }
            var age = performance.now() - currentReading.timeStamp;
            return age <= maxAge;
        }
        
        function register(sensor) {
            associatedSensors.add(sensor);
            console.log("registrar", Array.from(associatedSensors))
            var opt = getOptions();
            var optChanged = haveOptionsChanged(opt);
            _options = opt;
            var currentState = state;
            if (currentState == "idle") {
                state = "activating";
                activate(opt);
            } else if (currentState == "activating") {
                activate(opt);
                if (canEmitCachedReading(sensor)) {
                    updateReadingFromCache(sensor, currentReading);
                }
            } else if (currentState == "active") {
                if (optChanged) {
                    activate(opt);
                }
                if (canEmitCachedReading(sensor)) {
                    updateReading(sensor, currentReading);
                }
            }
        }
        
        function deregister(sensor) {
            associatedSensors.delete(sensor);
            console.log("registrar", Array.from(associatedSensors))
            if (associatedSensors.size == 0) {
                state = "idle";
                _timeout = setTimeout(function() {
                    currentReading = null;
                }, 20 * 1000)
                navigator.geolocation.clearWatch(_watchId);
                _watchId = null;
            }
        }
        
        function ondata(position) {
            var coords = position.coords;
            var reading = currentReading = new GeolocationSensorReading({
                accuracy        : coords.accuracy,
                altitude        : coords.altitude,
                altitudeAccuracy: coords.altitudeAccuracy,
                heading         : coords.heading,
                latitude        : coords.latitude,
                longitude       : coords.longitude,
                speed           : coords.speed,
                // watch out for the diff casing, here.
                timeStamp       : position.timestamp - performance.timing.navigationStart
            });
            if (state == "activating") {
                state = "active";
            }
            Array.from(associatedSensors).forEach(function(sensor) {
                updateReading(sensor, reading)
            });
        }
        
        function onerror(err) {
            Array.from(associatedSensors).forEach(function(sensor) {
                emitError(sensor, err)
            });
        }
        
        function activate(options) {
            if (_timeout) {
                clearTimeout(_timeout);
                _timeout = null;
            }
            if (_watchId) {
                navigator.geolocation.clearWatch(_watchId);
            }
            _watchId = navigator.geolocation.watchPosition(ondata, onerror, {
                enableHighAccuracy: options.accuracy == "high",
                maximumAge: 0, 
                timeout: Infinity
            });
        }
  
        self.register = register;
        self.deregister = deregister;
        return self;
    }());
    
    var GeolocationSensorReading = (function() {
        function GeolocationSensorReading(dict) {
            this.accuracy         = dict.accuracy;
            this.altitude         = dict.altitude;
            this.altitudeAccuracy = dict.altitudeAccuracy;
            this.heading          = dict.heading;
            this.latitude         = dict.latitude;
            this.longitude        = dict.longitude;
            this.speed            = dict.speed;
            this.timeStamp        = dict.timeStamp;
        }
        GeolocationSensorReading.prototype = Object.create(SensorReading.prototype, {
            // This probably needs to be changed to setters and getters, but can do for now.
            accuracy: {
                value: null,
                writable: true,
                configurable: true,
                enumerable: true
            },
            altitude: {
                value: null,
                writable: true,
                configurable: true,
                enumerable: true
            },
            altitudeAccuracy: {
                value: null,
                writable: true,
                configurable: true,
                enumerable: true
            },
            heading: {
                value: null,
                writable: true,
                configurable: true,
                enumerable: true
            },
            latitude: {
                value: null,
                writable: true,
                configurable: true,
                enumerable: true
            },
            longitude: {
                value: null,
                writable: true,
                configurable: true,
                enumerable: true
            },
            speed: {
                value: null,
                writable: true,
                configurable: true,
                enumerable: true
            }
        });
        GeolocationSensorReading.prototype.constructor = GeolocationSensorReading;
        return GeolocationSensorReading;
    })();

    var privateData = new WeakMap();
    function setSlot(self, name, value) {
        var priv = privateData.get(self) || {};
        priv[name] = value;
        privateData.set(self, priv);
        console.log("setSlot", name, JSON.stringify(value));
    
    }
    function getSlot(self, name) {
        var priv = privateData.get(self) || {};
        console.log("getSlot", name,  JSON.stringify(priv[name]))
        return priv[name];
    }
    
    function updateReadingFromCache(sensor, reading) {
        setSlot(sensor, "reading", reading);
        queueATask(function() {
            var event = new SensorReadingEvent("reading", {
                reading: reading
            });
            sensor.dispatchEvent(event);
        })
    }
    
    function updateReading(sensor, reading) {
        setSlot(sensor, "reading", reading);
        if (sensor.state == "activating") {
            var resolve = getSlot(sensor, "_startPromiseResolve");
            updateState(sensor, "active");
            setSlot(sensor, "_startPromiseResolve", null);
            setSlot(sensor, "_startPromiseReject", null);
            resolve();
        }
        queueATask(function() {
            var event = new SensorReadingEvent("reading", {
                reading: reading
            });
            sensor.dispatchEvent(event);
        });
    }
    
    function emitError(sensor, err) {
        setSlot(sensor, "reading", null);
        if (sensor.state == "activating") {
            var reject = getSlot(sensor, "_startPromiseReject");
            updateState(sensor, "idle");
            setSlot(sensor, "_startPromiseResolve", null);
            setSlot(sensor, "_startPromiseReject", null);
            reject(err);
        }
        queueATask(function() {
            var errEvent = new ErrorEvent("error", {
                message:  err.message,
                filename: err.filename,
                lineno:   err.lineno,
                colno:    err.colno,
                error:    err
            });
            sensor.dispatchEvent(errEvent);
        });
    }
    
    function updateState(sensor, state) {
        setSlot(sensor, "state", state);
        queueATask(function() {
            var event = new Event("statechange");
            sensor.dispatchEvent(event);
        });
    }

    var GeolocationSensor = (function () {
        
        function GeolocationSensor(options) {
            setSlot(this, "options", options || {});
            setSlot(this, "state", "idle");
            setSlot(this, "reading", "null");
            Sensor.call(this);
        }
        GeolocationSensor.prototype = Object.create(Sensor.prototype, {
            state: {
                get: function() {
                    return getSlot(this, "state");
                }
            },
            reading: {
                get: function() {
                    return getSlot(this, "reading");
                }
            }
        });
        GeolocationSensor.prototype.constructor = GeolocationSensor;
    
        GeolocationSensor.prototype.start = function() {
            var self = this;
            return new Promise(function(resolve, reject) {
                if (self.state != "idle") {
                    throw new DOMException("Sensor already started.", "InvalidStateError");
                }
                updateState(self, "activating");
                setSlot(self, "_startPromiseResolve", resolve);
                setSlot(self, "_startPromiseReject", reject);
                _geolocationSensor.register(self);
            });
        };
    
        GeolocationSensor.prototype.stop = function() {
            console.log("stop")
            var state = this.state;
            if (state == "idle") {
                return;
            }
            updateState(this, "idle");
            _geolocationSensor.deregister(this);
            if (state == "activating") {
                emitError(this, new Error("abort"));
            }
        };
        return GeolocationSensor;
    })();
    
    exports.Sensor                   = exports.Sensor                   || Sensor;
    exports.SensorReading            = exports.SensorReading            || SensorReading;
    exports.SensorReadingEvent       = exports.SensorReadingEvent       || SensorReadingEvent;
    exports.GeolocationSensorReading = exports.GeolocationSensorReading || GeolocationSensorReading;
    exports.GeolocationSensor        = exports.GeolocationSensor        || GeolocationSensor;

})(window);





//window.GeolocationSensor.requestData = function(options) {
//    return new Promise(function(resolve, reject) {
//        function onsuccess(position) {
//            resolve({
//                latitude: position.coords.latitude,
//                longitude: position.coords.longitude,
//                accuracy: position.coords.accuracy
//            });
//        }
//        
//        function onerror(err) {
//            if (err.code === err.TIMEOUT) {
//                resolve(null);
//            } else {
//                reject(err);
//            }
//        }
//        var timeout = Infinity;
//        if ("timeout" in options) timeout = options.timeout;
//        if (options.fromCache) timeout = 0; // instant timeout to only get data from the cache
//        
//        navigator.geolocation.getCurrentPosition(onsuccess, onerror, {
//            enableHighAccuracy: options.accuracy == "high", 
//            maximumAge: options.maximumAge == null ? Infinity : options.maximumAge,
//            timeout: timeout
//        });
//    });
//}

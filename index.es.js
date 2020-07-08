var toString = Object.prototype.toString;
var isValidData = function (data) {
    if (data === null || data === undefined || data === "") {
        return false;
    }
    return true;
};
var isArray = "isArray" in Array
    ? Array.isArray
    : function (obj) { return toString.call(obj) === "[object Array]"; };
export var each = function (list, hander) {
    var type = typeof list;
    if (isArray(list)) {
        var arr = list;
        for (var i = 0, len = arr.length; i < len; i++) {
            hander(arr[i], i);
        }
    }
    else if (type === "object") {
        var obj = list;
        for (var prop in obj) {
            hander(list[prop], prop);
        }
    }
};
export var DataLevel;
(function (DataLevel) {
    DataLevel["normal"] = "normal";
    DataLevel["middle"] = "middle";
    DataLevel["high"] = "high";
})(DataLevel || (DataLevel = {}));
export var FailAction;
(function (FailAction) {
    FailAction["recovery"] = "recovery";
    FailAction["stuff"] = "stuff";
    FailAction["discard"] = "discard";
})(FailAction || (FailAction = {}));
export var SwallowStrategyMode;
(function (SwallowStrategyMode) {
    SwallowStrategyMode["delayTime"] = "delayTime";
    SwallowStrategyMode["intervalTime"] = "intervalTime";
    SwallowStrategyMode["intervalCount"] = "intervalCount";
    SwallowStrategyMode["event"] = "event";
    SwallowStrategyMode["eventCount"] = "eventCount";
})(SwallowStrategyMode || (SwallowStrategyMode = {}));
var fireFailAction = function (list, squirrel) {
    if (typeof squirrel.options.failAction === "function") {
        var handler = squirrel.options.failAction;
        handler(list, squirrel);
    }
    else {
        var action = squirrel.options.failAction;
        switch (action) {
            case FailAction.recovery:
                {
                    each(list, function (item) {
                        if (item.enabled !== false) {
                            squirrel.stuff(item.data, item.level, true, item.index);
                        }
                    });
                }
                break;
            case FailAction.stuff:
                {
                    each(list, function (item) {
                        if (item.enabled !== false) {
                            squirrel.stuff(item.data, item.level);
                        }
                    });
                }
                break;
        }
    }
};
var sendData = function (list, squirrel) {
    var res = typeof squirrel.options.adapter === "function"
        ? squirrel.options.adapter(list)
        : false;
    if (typeof res === "object" && "catch" in res) {
        res.catch(function () {
            fireFailAction(list, squirrel);
        });
    }
    else if (res === false) {
        fireFailAction(list, squirrel);
    }
    return res;
};
var intervalSwallow = function (squirrel, time) {
    var spec = squirrel.getStrategySpec();
    if (!spec.intervalTimeValues ||
        spec.intervalTimeValues.indexOf(time) === -1) {
        return;
    }
    if (spec.intervalTime && spec.intervalTime.indexOf(time) !== -1) {
        squirrel.swallow();
    }
    each(DataLevel, function (val, prop) {
        if (spec[DataLevel[prop]]) {
            var levelSpec = spec[DataLevel[prop]];
            if (levelSpec.intervalTime &&
                levelSpec.intervalTime.indexOf(time) !== -1) {
                squirrel.swallow(null, DataLevel[prop]);
            }
        }
    });
};
var merge = function (target) {
    var sourceList = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        sourceList[_i - 1] = arguments[_i];
    }
    each(sourceList, function (item) {
        each(item, function (val, prop) {
            if (typeof val === "object" && val) {
                if (typeof target[prop] !== "object") {
                    target[prop] = isArray(val) ? [] : {};
                }
                else {
                    if (isArray(val) && !isArray(target[prop])) {
                        target[prop] = [];
                    }
                    if (isArray(target[prop]) && !isArray(val)) {
                        target[prop] = {};
                    }
                }
                target[prop] = merge(target[prop], val);
            }
            else {
                target[prop] = val;
            }
        });
    });
    return target;
};
var Squirrel = /** @class */ (function () {
    function Squirrel(options) {
        this.eventState = {};
        this.delayTimer = {};
        var pocket;
        if (options && options.getStorage) {
            pocket = options.getStorage();
        }
        if (typeof pocket !== "object" || pocket === null) {
            pocket = {};
        }
        each(DataLevel, function (value, prop) {
            pocket[DataLevel[prop]] = isArray(pocket[DataLevel[prop]])
                ? pocket[DataLevel[prop]].filter(function (item) { return isValidData(item); })
                : [];
        });
        this.pocket = pocket;
        this.setOptions(options);
    }
    Squirrel.prototype.setOptions = function (options) {
        var _this = this;
        var oldStrategy = this.options && typeof this.options.strategy === "function"
            ? this.options.strategy
            : this.options && this.options.strategy
                ? JSON.stringify(this.options.strategy)
                : "";
        var ops = merge({}, Squirrel.defaultOptions, this.options || {}, typeof options === "object" ? options : {});
        this.options = ops;
        var newStrategy = typeof this.options.strategy === "function"
            ? this.options.strategy
            : this.options.strategy
                ? JSON.stringify(this.options.strategy)
                : "";
        if (newStrategy !== oldStrategy) {
            delete this.cacheSpec;
            // 处理定时器类型的上报策略
            this.intervalTimer &&
                each(this.intervalTimer, function (item) {
                    clearInterval(item);
                });
            delete this.intervalTimer;
            var spec = this.getStrategySpec();
            spec.intervalTimeValues &&
                each(spec.intervalTimeValues, function (time) {
                    if (!_this.intervalTimer) {
                        _this.intervalTimer = [];
                    }
                    time = parseFloat(time + "");
                    _this.intervalTimer.push(setInterval(function () {
                        intervalSwallow(_this, time);
                    }, time));
                });
        }
        this.trigger("setOptions");
    };
    Squirrel.prototype.getStrategySpec = function () {
        if (this.cacheSpec) {
            return this.cacheSpec;
        }
        var spec = {
            storageEnabled: !!this.options.setStorage,
        };
        var loop = function (strategy, level) {
            if (strategy) {
                if (isArray(strategy)) {
                    each(strategy, function (val, index) {
                        loop(val, level);
                    });
                }
                else if (typeof strategy === "object") {
                    if (DataLevel.normal in strategy) {
                        loop(strategy[DataLevel.normal], DataLevel.normal);
                    }
                    if (DataLevel.middle in strategy) {
                        loop(strategy[DataLevel.middle], DataLevel.middle);
                    }
                    if (DataLevel.high in strategy) {
                        loop(strategy[DataLevel.high], DataLevel.high);
                    }
                    if ("mode" in strategy && strategy.enabled !== false) {
                        strategy = strategy;
                        if (level && !spec[level]) {
                            spec[level] = {};
                        }
                        var specItem_1 = level ? spec[level] : spec;
                        switch (strategy.mode) {
                            case SwallowStrategyMode.delayTime:
                                {
                                    specItem_1[SwallowStrategyMode.delayTime] =
                                        strategy.value >= 0
                                            ? strategy.value
                                            : 0;
                                }
                                break;
                            case SwallowStrategyMode.intervalCount:
                                {
                                    if (strategy.value) {
                                        specItem_1[SwallowStrategyMode.intervalCount] = strategy.value;
                                    }
                                }
                                break;
                            case SwallowStrategyMode.intervalTime:
                                {
                                    if (strategy.value >= 0) {
                                        if (!specItem_1[SwallowStrategyMode.intervalTime]) {
                                            specItem_1[SwallowStrategyMode.intervalTime] = [];
                                        }
                                        if (!spec.intervalTimeValues) {
                                            spec.intervalTimeValues = [];
                                        }
                                        if (spec.intervalTimeValues.indexOf(strategy.value) === -1) {
                                            spec.intervalTimeValues.push(strategy.value);
                                        }
                                        specItem_1[SwallowStrategyMode.intervalTime].push(strategy.value);
                                    }
                                }
                                break;
                            case SwallowStrategyMode.event:
                                {
                                    if (isValidData(strategy.value)) {
                                        if (!specItem_1[SwallowStrategyMode.event]) {
                                            specItem_1[SwallowStrategyMode.event] = [];
                                        }
                                        specItem_1[SwallowStrategyMode.event].push(strategy.value);
                                    }
                                }
                                break;
                            case SwallowStrategyMode.eventCount:
                                {
                                    if (isArray(strategy.value)) {
                                        each(strategy.value, function (item) {
                                            if (!specItem_1[SwallowStrategyMode
                                                .eventCount]) {
                                                specItem_1[SwallowStrategyMode.eventCount] = [];
                                            }
                                            specItem_1[SwallowStrategyMode
                                                .eventCount].push({
                                                name: item.name,
                                                count: item.count || 0,
                                            });
                                        });
                                    }
                                    else if (typeof strategy.value === "object" &&
                                        strategy.value &&
                                        "name" in strategy.value) {
                                        if (!specItem_1[SwallowStrategyMode.eventCount]) {
                                            specItem_1[SwallowStrategyMode.eventCount] = [];
                                        }
                                        specItem_1[SwallowStrategyMode.eventCount].push({
                                            name: strategy.value.name,
                                            count: strategy.value.count || 0,
                                        });
                                    }
                                }
                                break;
                        }
                    }
                }
            }
        };
        loop(this.options.strategy);
        this.cacheSpec = spec;
        return spec;
    };
    Squirrel.prototype.snapshot = function () {
        var _this = this;
        if (this.options.setStorage) {
            try {
                var res = this.options.setStorage(JSON.parse(JSON.stringify(this.pocket)));
                if (typeof res === "object" && "catch" in res) {
                    res.catch(function () {
                        _this.trigger("storageError");
                    });
                }
                else if (res === false) {
                    this.trigger("storageError");
                }
            }
            catch (error) {
                this.trigger("storageError");
            }
        }
    };
    /**
     * 塞入数据
     * @param data 数据
     * @param level 此项数据的优先级
     * @param fireStrategy 是否触发策略检测
     */
    Squirrel.prototype.stuff = function (data, level, fireStrategy, index) {
        if (level === void 0) { level = DataLevel.normal; }
        if (fireStrategy === void 0) { fireStrategy = true; }
        if (index === void 0) { index = -1; }
        index =
            index === -1
                ? this.pocket[level || DataLevel.normal].length
                : index;
        this.pocket[level || DataLevel.normal].splice(index, 0, data);
        this.trigger("stuff");
        this.snapshot();
    };
    /**
     * 吞入数据（调用上报函数将数据上报），如果不传递任何参数或参数皆为空，则吞入所有优先级的数据，如果传递的数据为空，但是存在优先级，则会吞入该优先级下的所有数据
     * @param data 数据
     * @param level 此项数据的优先级
     */
    Squirrel.prototype.swallow = function (data, level) {
        var list;
        if (!level || (!data && level) || (!data && !level)) {
            list = this.getLevalDataList(level, true);
        }
        else {
            list = [
                {
                    data: data,
                    level: DataLevel.normal,
                    index: this.pocket[DataLevel.normal].length,
                },
            ];
        }
        if (list.length) {
            return sendData(list, this);
        }
    };
    Squirrel.prototype.destory = function () {
        this.intervalTimer &&
            each(this.intervalTimer, function (item) {
                clearInterval(item);
            });
        delete this.intervalTimer;
        each(this.delayTimer, function (value) {
            clearTimeout(value);
        });
        this.snapshot();
    };
    Squirrel.prototype.clearEventState = function () {
        this.eventState = {};
    };
    Squirrel.prototype.trigger = function (eventName, eventData) {
        var _this = this;
        if (!this.eventState[eventName]) {
            this.eventState[eventName] = {
                count: 0,
            };
        }
        this.eventState[eventName].count++;
        this.eventState[eventName].lastData = eventData;
        var fullSpec = this.getStrategySpec();
        var check = function (spec, level) {
            if (!spec)
                return;
            if (eventName === "stuff" && spec.intervalCount) {
                var dataCount_1 = 0;
                if (level) {
                    dataCount_1 = _this.pocket[level].length;
                }
                else {
                    each(DataLevel, function (val, prop) {
                        dataCount_1 += _this.pocket[DataLevel[prop]].length;
                    });
                }
                if (dataCount_1 % spec.intervalCount === 0) {
                    _this.swallow(null, level);
                }
            }
            if (eventName === "stuff" &&
                SwallowStrategyMode.delayTime in spec) {
                if (!_this.delayTimer[level || "common"]) {
                    _this.delayTimer[level || "common"] = setTimeout(function () {
                        _this.swallow(null, level);
                    }, spec[SwallowStrategyMode.delayTime]);
                }
            }
            if (spec.event && spec.event.indexOf(eventName) !== -1) {
                _this.swallow(null, level);
            }
            if (spec.eventCount &&
                spec.eventCount.some(function (item) {
                    return item.name === eventName &&
                        _this.eventState[eventName].count >= item.count;
                })) {
                _this.swallow(null, level);
            }
        };
        check(fullSpec);
        each(DataLevel, function (val, prop) {
            check(fullSpec[DataLevel[prop]], DataLevel[prop]);
        });
    };
    Squirrel.prototype.getLevalDataList = function (level, remove) {
        var _this = this;
        if (remove === void 0) { remove = false; }
        var list = [];
        if (level) {
            each(this.pocket[level], function (data, index) {
                if (isValidData(data)) {
                    list.push({
                        data: data,
                        level: level,
                        index: index,
                    });
                }
            });
            if (remove) {
                this.pocket[level] = [];
            }
        }
        else {
            each(this.pocket, function (value, prop) {
                each(value, function (data, index) {
                    if (isValidData(data)) {
                        list.push({
                            data: data,
                            level: DataLevel[prop],
                            index: index,
                        });
                    }
                });
                if (remove) {
                    _this.pocket[prop] = [];
                }
            });
        }
        if (remove) {
            this.snapshot();
        }
        return list;
    };
    Squirrel.DataLevel = DataLevel;
    Squirrel.FailAction = FailAction;
    Squirrel.StrategyMode = SwallowStrategyMode;
    // 默认配置
    Squirrel.defaultOptions = {
        adapter: function () { },
        failAction: FailAction.recovery,
        strategy: {
            mode: SwallowStrategyMode.delayTime,
            value: 500,
        },
    };
    return Squirrel;
}());
export { Squirrel };

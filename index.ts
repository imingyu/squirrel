interface EachHandler<T> {
    (value: T, prop: number | string): void;
}

const toString = Object.prototype.toString;
const isValidData = (data) => {
    if (data === null || data === undefined || data === "") {
        return false;
    }
    return true;
};

const isArray =
    "isArray" in Array
        ? Array.isArray
        : (obj: any): boolean => toString.call(obj) === "[object Array]";
export const each = <T>(list: Array<T> | object, hander: EachHandler<T>) => {
    const type = typeof list;
    if (isArray(list)) {
        const arr: Array<T> = list as Array<T>;
        for (let i = 0, len = arr.length; i < len; i++) {
            hander(arr[i], i);
        }
    } else if (type === "object") {
        const obj: object = list as object;
        for (let prop in obj) {
            hander(list[prop], prop);
        }
    }
};
export enum DataLevel {
    normal = "normal",
    middle = "middle",
    high = "high",
}
export enum FailAction {
    recovery = "recovery", // 将失败的数据，原样插入到对应优先级的队列中，并保持索引一致
    stuff = "stuff", // 将失败的数据当中新数据塞入对应优先级的队列中
    discard = "discard", // 丢弃失败的数据
}
export enum SwallowStrategyMode {
    delayTime = "delayTime", // 延迟xx时间后，延迟时间内多次吞入会重新计时，单位ms
    intervalTime = "intervalTime", // 每间隔xx时间，单位ms
    intervalCount = "intervalCount", // 每间隔xx条数据
    event = "event", // 当发生某事件时，需调用Squirrel实例的trigger方法进行事件触发
    eventCount = "eventCount", // 当发生某事件xx次后，需调用Squirrel实例的trigger方法进行事件触发
}
export interface SwallowStrategyDetail {
    mode: SwallowStrategyMode;
    value: EventSpec[] | any;
    enabled?: boolean;
}
export interface EventState {
    [eventName: string]: number;
}
export type SwallowStrategy =
    | SwallowStrategyDetail
    | Array<SwallowStrategyDetail>
    | SwallowStrategyCustom;
export interface LevelSwallowStrategy {
    [DataLevel.normal]: SwallowStrategy;
    [DataLevel.middle]: SwallowStrategy;
    [DataLevel.high]: SwallowStrategy;
}
export interface SwallowDatItem {
    data: any;
    level: DataLevel;
    index: number;
    enabled?: boolean;
}
export interface EventSpec {
    name: string;
    count: number;
}
export interface StrategySpecDetail {
    storageEnabled: boolean;
    [SwallowStrategyMode.delayTime]?: number;
    [SwallowStrategyMode.intervalCount]?: number;
    [SwallowStrategyMode.intervalTime]?: number[];
    [SwallowStrategyMode.event]?: string[];
    [SwallowStrategyMode.eventCount]?: EventSpec[];
}
export interface StrategySpec extends StrategySpecDetail {
    intervalTimeValues?: number[];
    [DataLevel.normal]?: StrategySpecDetail;
    [DataLevel.middle]?: StrategySpecDetail;
    [DataLevel.high]?: StrategySpecDetail;
}
export interface LevelStrategySpec {
    [DataLevel.normal]: SwallowStrategy;
    [DataLevel.middle]: SwallowStrategy;
    [DataLevel.high]: SwallowStrategy;
}
export interface FailActionCustom {
    (failDataList: SwallowDatItem[], squirrel: Squirrel);
}
interface SwallowStrategyCustom {
    (list: SwallowDatItem[], squirrel: Squirrel);
}
export interface SquirrelOptions {
    adapter: Function; // 发送数据时调用的函数，返回false或者reject状态的promise则认为此次数据发送失败，需要根据failAction配置执行后续操作
    strategy: SwallowStrategy | LevelSwallowStrategy; // 上报策略
    failAction: FailAction | FailActionCustom; // 如果发送数据失败了，该做什么？
    getStorage?: Function; // 初始化Squirrel实例时从持久化介质中获取数据
    setStorage?: Function; // 将数据持久化的函数
}

const fireFailAction = (list: SwallowDatItem[], squirrel: Squirrel) => {
    if (typeof squirrel.options.failAction === "function") {
        const handler = squirrel.options.failAction as FailActionCustom;
        handler(list, squirrel);
    } else {
        const action = squirrel.options.failAction as FailAction;
        switch (action) {
            case FailAction.recovery:
                {
                    each(list, (item) => {
                        if (item.enabled !== false) {
                            squirrel.stuff(
                                item.data,
                                item.level,
                                true,
                                item.index
                            );
                        }
                    });
                }
                break;
            case FailAction.stuff:
                {
                    each(list, (item) => {
                        if (item.enabled !== false) {
                            squirrel.stuff(item.data, item.level);
                        }
                    });
                }
                break;
        }
    }
};
const sendData = (list: SwallowDatItem[], squirrel: Squirrel) => {
    let res =
        typeof squirrel.options.adapter === "function"
            ? squirrel.options.adapter(list)
            : false;
    if (typeof res === "object" && "catch" in res) {
        res.catch(() => {
            fireFailAction(list, squirrel);
        });
    } else if (res === false) {
        fireFailAction(list, squirrel);
    }
    return res;
};
const intervalSwallow = (squirrel: Squirrel, time: number) => {
    const spec = squirrel.getStrategySpec();
    if (
        !spec.intervalTimeValues ||
        spec.intervalTimeValues.indexOf(time) === -1
    ) {
        return;
    }
    if (spec.intervalTime && spec.intervalTime.indexOf(time) !== -1) {
        squirrel.swallow();
    }
    each(DataLevel, (val, prop) => {
        if (spec[DataLevel[prop]]) {
            let levelSpec: StrategySpecDetail = spec[
                DataLevel[prop]
            ] as StrategySpecDetail;
            if (
                levelSpec.intervalTime &&
                levelSpec.intervalTime.indexOf(time) !== -1
            ) {
                squirrel.swallow(null, DataLevel[prop]);
            }
        }
    });
};
const merge = (target: object, ...sourceList: object[]) => {
    each(sourceList, (item) => {
        each(item, (val, prop) => {
            if (typeof val === "object" && val) {
                if (typeof target[prop] !== "object") {
                    target[prop] = isArray(val) ? [] : {};
                } else {
                    if (isArray(val) && !isArray(target[prop])) {
                        target[prop] = [];
                    }
                    if (isArray(target[prop]) && !isArray(val)) {
                        target[prop] = {};
                    }
                }
                target[prop] = merge(target[prop], val);
            } else {
                target[prop] = val;
            }
        });
    });
    return target;
};
export class Squirrel {
    static DataLevel = DataLevel;
    static FailAction = FailAction;
    static StrategyMode = SwallowStrategyMode;
    // 默认配置
    static defaultOptions: SquirrelOptions = {
        adapter: () => {},
        failAction: FailAction.recovery,
        strategy: {
            mode: SwallowStrategyMode.delayTime,
            value: 500,
        },
    };
    cacheSpec: StrategySpec;
    eventState: EventState;
    intervalTimer?: any[];
    options: SquirrelOptions;
    delayTimer: {
        common?: any;
        [DataLevel.normal]?: any;
        [DataLevel.middle]?: any;
        [DataLevel.high]?: any;
    };
    pocket: {
        [DataLevel.normal]: any[];
        [DataLevel.middle]: any[];
        [DataLevel.high]: any[];
    };
    constructor(options?: SquirrelOptions) {
        this.eventState = {};
        this.delayTimer = {};
        let pocket;
        if (options && options.getStorage) {
            pocket = options.getStorage();
        }
        if (typeof pocket !== "object" || pocket === null) {
            pocket = {};
        }
        each(DataLevel, (value, prop) => {
            pocket[DataLevel[prop]] = isArray(pocket[DataLevel[prop]])
                ? pocket[DataLevel[prop]].filter((item) => isValidData(item))
                : [];
        });
        this.pocket = pocket;
        this.setOptions(options);
    }
    setOptions(options: SquirrelOptions) {
        const oldStrategy =
            this.options && typeof this.options.strategy === "function"
                ? this.options.strategy
                : this.options && this.options.strategy
                ? JSON.stringify(this.options.strategy)
                : "";
        let ops = merge(
            {},
            Squirrel.defaultOptions,
            this.options || {},
            typeof options === "object" ? options : {}
        );
        this.options = ops as SquirrelOptions;
        const newStrategy =
            typeof this.options.strategy === "function"
                ? this.options.strategy
                : this.options.strategy
                ? JSON.stringify(this.options.strategy)
                : "";
        if (newStrategy !== oldStrategy) {
            delete this.cacheSpec;
            // 处理定时器类型的上报策略
            this.intervalTimer &&
                each(this.intervalTimer, (item) => {
                    clearInterval(item);
                });
            delete this.intervalTimer;
            const spec = this.getStrategySpec();
            spec.intervalTimeValues &&
                each(spec.intervalTimeValues, (time) => {
                    if (!this.intervalTimer) {
                        this.intervalTimer = [];
                    }
                    time = parseFloat(time + "");
                    this.intervalTimer.push(
                        setInterval(() => {
                            intervalSwallow(this, time);
                        }, time)
                    );
                });
        }
        this.trigger("setOptions");
    }
    getStrategySpec(): StrategySpec {
        if (this.cacheSpec) {
            return this.cacheSpec;
        }
        const spec: StrategySpec = {
            storageEnabled: !!this.options.setStorage,
        };
        const loop = (
            strategy: SwallowStrategy | LevelSwallowStrategy,
            level?: DataLevel
        ) => {
            if (strategy) {
                if (isArray(strategy)) {
                    each(strategy as SwallowStrategyDetail[], (val, index) => {
                        loop(val, level);
                    });
                } else if (typeof strategy === "object") {
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
                        strategy = strategy as SwallowStrategyDetail;
                        if (level && !spec[level]) {
                            spec[level] = {} as StrategySpecDetail;
                        }
                        const specItem = level ? spec[level] : spec;
                        switch (strategy.mode) {
                            case SwallowStrategyMode.delayTime:
                                {
                                    specItem[SwallowStrategyMode.delayTime] =
                                        strategy.value >= 0
                                            ? strategy.value
                                            : 0;
                                }
                                break;
                            case SwallowStrategyMode.intervalCount:
                                {
                                    if (strategy.value) {
                                        specItem[
                                            SwallowStrategyMode.intervalCount
                                        ] = strategy.value;
                                    }
                                }
                                break;
                            case SwallowStrategyMode.intervalTime:
                                {
                                    if (strategy.value >= 0) {
                                        if (
                                            !specItem[
                                                SwallowStrategyMode.intervalTime
                                            ]
                                        ) {
                                            specItem[
                                                SwallowStrategyMode.intervalTime
                                            ] = [];
                                        }
                                        if (!spec.intervalTimeValues) {
                                            spec.intervalTimeValues = [];
                                        }
                                        if (
                                            spec.intervalTimeValues.indexOf(
                                                strategy.value
                                            ) === -1
                                        ) {
                                            spec.intervalTimeValues.push(
                                                strategy.value
                                            );
                                        }
                                        specItem[
                                            SwallowStrategyMode.intervalTime
                                        ].push(strategy.value);
                                    }
                                }
                                break;
                            case SwallowStrategyMode.event:
                                {
                                    if (isValidData(strategy.value)) {
                                        if (
                                            !specItem[SwallowStrategyMode.event]
                                        ) {
                                            specItem[
                                                SwallowStrategyMode.event
                                            ] = [];
                                        }
                                        specItem[
                                            SwallowStrategyMode.event
                                        ].push(strategy.value);
                                    }
                                }
                                break;
                            case SwallowStrategyMode.eventCount:
                                {
                                    if (isArray(strategy.value)) {
                                        each(
                                            strategy.value as EventSpec[],
                                            (item) => {
                                                if (
                                                    !specItem[
                                                        SwallowStrategyMode
                                                            .eventCount
                                                    ]
                                                ) {
                                                    specItem[
                                                        SwallowStrategyMode.eventCount
                                                    ] = [];
                                                }
                                                specItem[
                                                    SwallowStrategyMode
                                                        .eventCount
                                                ].push({
                                                    name: item.name,
                                                    count: item.count || 0,
                                                });
                                            }
                                        );
                                    } else if (
                                        typeof strategy.value === "object" &&
                                        strategy.value &&
                                        "name" in strategy.value
                                    ) {
                                        if (
                                            !specItem[
                                                SwallowStrategyMode.eventCount
                                            ]
                                        ) {
                                            specItem[
                                                SwallowStrategyMode.eventCount
                                            ] = [];
                                        }
                                        specItem[
                                            SwallowStrategyMode.eventCount
                                        ].push({
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
    }
    snapshot() {
        if (this.options.setStorage) {
            try {
                const res = this.options.setStorage(
                    JSON.parse(JSON.stringify(this.pocket))
                );
                if (typeof res === "object" && "catch" in res) {
                    res.catch(() => {
                        this.trigger("storageError");
                    });
                } else if (res === false) {
                    this.trigger("storageError");
                }
            } catch (error) {
                this.trigger("storageError");
            }
        }
    }
    /**
     * 塞入数据
     * @param data 数据
     * @param level 此项数据的优先级
     * @param fireStrategy 是否触发策略检测
     */
    stuff(
        data: any,
        level: DataLevel = DataLevel.normal,
        fireStrategy = true,
        index: number = -1
    ) {
        index =
            index === -1
                ? this.pocket[level || DataLevel.normal].length
                : index;
        this.pocket[level || DataLevel.normal].splice(index, 0, data);
        this.trigger("stuff");
        this.snapshot();
    }
    /**
     * 吞入数据（调用上报函数将数据上报），如果不传递任何参数或参数皆为空，则吞入所有优先级的数据，如果传递的数据为空，但是存在优先级，则会吞入该优先级下的所有数据
     * @param data 数据
     * @param level 此项数据的优先级
     */
    swallow(data?: any, level?: DataLevel) {
        let list;
        if (!level || (!data && level) || (!data && !level)) {
            list = this.getLevalDataList(level, true);
        } else {
            list = [
                {
                    data,
                    level: DataLevel.normal,
                    index: this.pocket[DataLevel.normal].length,
                },
            ];
        }
        if (list.length) {
            return sendData(list, this);
        }
    }
    destory() {
        this.intervalTimer &&
            each(this.intervalTimer, (item) => {
                clearInterval(item);
            });
        delete this.intervalTimer;
        each(this.delayTimer, (value) => {
            clearTimeout(value as number);
        });
        this.snapshot();
    }
    clearEventState() {
        this.eventState = {};
    }
    trigger(eventName: string) {
        if (!this.eventState[eventName]) {
            this.eventState[eventName] = 0;
        }
        this.eventState[eventName]++;
        const fullSpec = this.getStrategySpec();
        const check = (spec: StrategySpecDetail, level?: DataLevel) => {
            if (!spec) return;
            if (eventName === "stuff" && spec.intervalCount) {
                let dataCount = 0;
                if (level) {
                    dataCount = this.pocket[level].length;
                } else {
                    each(DataLevel, (val, prop) => {
                        dataCount += this.pocket[DataLevel[prop]].length;
                    });
                }
                if (dataCount % spec.intervalCount === 0) {
                    this.swallow(null, level);
                }
            }
            if (
                eventName === "stuff" &&
                SwallowStrategyMode.delayTime in spec
            ) {
                if (!this.delayTimer[level || "common"]) {
                    this.delayTimer[level || "common"] = setTimeout(() => {
                        this.swallow(null, level);
                    }, spec[SwallowStrategyMode.delayTime]);
                }
            }
            if (spec.event && spec.event.indexOf(eventName) !== -1) {
                this.swallow(null, level);
            }
            if (
                spec.eventCount &&
                spec.eventCount.some(
                    (item) =>
                        item.name === eventName &&
                        this.eventState[eventName] >= item.count
                )
            ) {
                this.swallow(null, level);
            }
        };
        check(fullSpec);
        each(DataLevel, (val, prop) => {
            check(fullSpec[DataLevel[prop]], DataLevel[prop]);
        });
    }
    getLevalDataList(level?: DataLevel, remove = false) {
        const list: SwallowDatItem[] = [];
        if (level) {
            each(this.pocket[level], (data, index) => {
                if (isValidData(data)) {
                    list.push({
                        data,
                        level,
                        index: index as number,
                    });
                }
            });
            if (remove) {
                this.pocket[level] = [];
            }
        } else {
            each(this.pocket, (value, prop) => {
                each(value as any[], (data, index) => {
                    if (isValidData(data)) {
                        list.push({
                            data,
                            level: DataLevel[prop],
                            index: index as number,
                        });
                    }
                });
                if (remove) {
                    this.pocket[prop] = [];
                }
            });
        }
        if (remove) {
            this.snapshot();
        }
        return list;
    }
}

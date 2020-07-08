interface EachHandler<T> {
    (value: T, prop: number | string): void;
}
export declare const each: <T>(list: object | T[], hander: EachHandler<T>) => void;
export declare enum DataLevel {
    normal = "normal",
    middle = "middle",
    high = "high"
}
export declare enum FailAction {
    recovery = "recovery",
    stuff = "stuff",
    discard = "discard"
}
export declare enum SwallowStrategyMode {
    delayTime = "delayTime",
    intervalTime = "intervalTime",
    intervalCount = "intervalCount",
    event = "event",
    eventCount = "eventCount"
}
export interface SwallowStrategyDetail {
    mode: SwallowStrategyMode;
    value: EventSpec[] | any;
    enabled?: boolean;
}
export interface EventState {
    [eventName: string]: number;
}
export declare type SwallowStrategy = SwallowStrategyDetail | Array<SwallowStrategyDetail> | SwallowStrategyCustom;
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
    (failDataList: SwallowDatItem[], squirrel: Squirrel): any;
}
interface SwallowStrategyCustom {
    (list: SwallowDatItem[], squirrel: Squirrel): any;
}
export interface SquirrelOptions {
    adapter: Function;
    strategy: SwallowStrategy | LevelSwallowStrategy;
    failAction: FailAction | FailActionCustom;
    getStorage?: Function;
    setStorage?: Function;
}
export declare class Squirrel {
    static DataLevel: typeof DataLevel;
    static FailAction: typeof FailAction;
    static StrategyMode: typeof SwallowStrategyMode;
    static defaultOptions: SquirrelOptions;
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
    constructor(options?: SquirrelOptions);
    setOptions(options: SquirrelOptions): void;
    getStrategySpec(): StrategySpec;
    snapshot(): void;
    /**
     * 塞入数据
     * @param data 数据
     * @param level 此项数据的优先级
     * @param fireStrategy 是否触发策略检测
     */
    stuff(data: any, level?: DataLevel, fireStrategy?: boolean, index?: number): void;
    /**
     * 吞入数据（调用上报函数将数据上报），如果不传递任何参数或参数皆为空，则吞入所有优先级的数据，如果传递的数据为空，但是存在优先级，则会吞入该优先级下的所有数据
     * @param data 数据
     * @param level 此项数据的优先级
     */
    swallow(data?: any, level?: DataLevel): any;
    destory(): void;
    clearEventState(): void;
    trigger(eventName: string): void;
    getLevalDataList(level?: DataLevel, remove?: boolean): SwallowDatItem[];
}
export {};

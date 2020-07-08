# squirrel

[![Build Status](https://travis-ci.org/imingyu/squirrel.svg?branch=master)](https://travis-ci.org/imingyu/squirrel)
![image](https://img.shields.io/npm/l/squirrel-report.svg)
[![image](https://img.shields.io/npm/v/squirrel-report.svg)](https://www.npmjs.com/package/squirrel-report)
[![image](https://img.shields.io/npm/dt/squirrel-report.svg)](https://www.npmjs.com/package/squirrel-report)

小松鼠——适用于 JavaScript 平台的数据上报工具，可指定多种上报策略

## 使用场景
- 上报埋点数据
- 上报日志数据
- 上报异常数据

## 安装

```bash
npm i squirrel-report -S
```

## 使用

```javascript
import { Squirrel, DataLevel, SwallowStrategyMode } from "squirrel-report";
const reporter = new Squirrel({
    adapter: (list) => {
        // myAjax(list);
    },
    strategy: {
        // 设置上传策略为：每满10条上报一次
        mode: SwallowStrategyMode.intervalCount,
        value: 10,
    },
});

// 插入数据到队列池
reporter.stuff("data1...");
reporter.stuff("data2...", DataLevel.high);
.
.
.
reporter.stuff("data10..."); // 触发上报

// 也可以在任意时刻进行手动执行上报
reporter.swallow();
```

## 上报策略

```javascript
// 上报策略可选值
enum SwallowStrategyMode {
    delayTime = "delayTime", // 延迟xx时间后，延迟时间内多次吞入会重新计时，单位ms
    intervalTime = "intervalTime", // 每间隔xx时间，单位ms
    intervalCount = "intervalCount", // 每间隔xx条数据
    event = "event", // 当发生某事件时，需调用Squirrel实例的trigger方法进行事件触发
    eventCount = "eventCount", // 当发生某事件xx次后，需调用Squirrel实例的trigger方法进行事件触发
}
```

在使用构造函数`new Squirrel(options)`或者`squirrel.setOptions(options)`设置配置项时，可在`options`中传递`strategy`选项，用于指定上报策略；
`strategy`的值可以是单纯的对象，如：
```javascript
{ mode: SwallowStrategyMode.intervalCount, value: 10}
```

也可以在`strategy`对象上按照优先级设置上报策略，如：

```javascript
{
    [DataLevel.high]: {
        mode: SwallowStrategyMode.intervalCount,
        value: 10
    }
}
```

## API

### class Squirrel

-   `constructor(options:SquirrelOptions)`
    -   构造函数，可传入`options`，使用`this.setOptions`进行配置项解析
-   `setOptions(options:SquirrelOptions)`
    -   解析并应用配置
-   `stuff(data:any, level:DataLevel)`
    -   将数据按照优先级插入到队列池中
-   `swallow(data?:any, level?:DataLevel)`
    -   强制执行上报操作，如果不传递任何参数或参数皆为空，则上报所有优先级的数据，如果传递的数据为空，但是存在优先级，则会上报该优先级下的所有数据
-   `trigger(eventName)`

    -   触发事件，Squirrel 类本身会触发如下事件：
        -   `stuff`: 插入数据时触发
        -   `swallow`: 上报数据时触发
        -   `setOptions`: 设置配置项时触发
        -   `storageError`: 在配置项中指定了`setStorage`，并且在执行数据持久化调用`setStorage`后失败时触发

-   `destory()`
    -   销毁实例，如果上报策略中指定了与实际相关的策略时，请务必执行此函数以销毁定时器

### interface SquirrelOptions

```typescript
{
    adapter: Function; // 发送数据时调用的函数，返回false或者reject状态的promise则认为此次数据发送失败，需要根据failAction配置执行后续操作
    strategy: SwallowStrategy | LevelSwallowStrategy; // 上报策略
    failAction: FailAction | FailActionCustom; // 如果发送数据失败了，该做什么？
    getStorage?: Function; // 初始化Squirrel实例时从持久化介质中获取数据
    setStorage?: Function; // 将数据持久化的函数
}
```

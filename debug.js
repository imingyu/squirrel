const { Squirrel, SwallowStrategyMode } = require("./index.js");
const d1 = Date.now();
const s1 = new Squirrel({
    adapter: (list) => {
        debugger;
    },
    strategy: {
        mode: SwallowStrategyMode.delayTime,
        value: 1 * 1000
    }
});
s1.stuff('哈哈');
s1.stuff('哈哈2');
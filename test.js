const { assert } = require("chai");
const Mocha = require("mocha");
const { Squirrel, SwallowStrategyMode } = require("./index.js");

describe("Squirrel", () => {
    describe("constructor", () => {
        it("必要属性已正确初始化", () => {
            const s1 = new Squirrel();
            assert.isNotNull(s1.options);
            assert.isNotNull(s1.delayTimer);
            assert.isNotNull(s1.eventState);
            assert.isNotNull(s1.pocket);
            assert.hasAllKeys(s1.pocket, Object.keys(Squirrel.DataLevel));
        });
    });

    describe("options", () => {
        it("校验options有效性", () => {
            const s1 = new Squirrel(2);
            assert.isNotNull(s1.options);
            assert.equal(s1.options.adapter, Squirrel.defaultOptions.adapter);

            s1.setOptions(3);
            assert.equal(s1.options.adapter, Squirrel.defaultOptions.adapter);
        });

        it('检测options正确设置', () => {
            const adapter = () => { };
            let getStorageIsExec;
            const getStorage = () => {
                getStorageIsExec = 1;
            }
            const s1 = new Squirrel({
                adapter,
                failAction: Squirrel.FailAction.recovery,
                getStorage: getStorage,
                strategy: {
                    mode: Squirrel.StrategyMode.delayTime,
                    value: 2 * 1000
                }
            });
            assert.isNotNull(s1.options);
            assert.equal(s1.options.adapter, adapter);
            assert.equal(s1.options.getStorage, getStorage);
            assert.equal(1, getStorageIsExec);
            assert.equal(s1.options.failAction, Squirrel.FailAction.recovery);
            let spec = s1.getStrategySpec();
            assert.equal(spec.storageEnabled, false);
            assert.equal(spec.delayTime, 2 * 1000);

            s1.setOptions({
                strategy: [
                    {
                        mode: Squirrel.StrategyMode.delayTime,
                        value: 1 * 1000
                    }
                ]
            });
            spec = s1.getStrategySpec();
            assert.equal(spec.delayTime, 1 * 1000);

            const adapter2 = () => { };
            s1.setOptions({
                adapter: adapter2,
                failAction: adapter2,
                getStorage,
                strategy: [
                    {
                        mode: Squirrel.StrategyMode.delayTime,
                        value: 3 * 1000
                    },
                    {
                        mode: Squirrel.StrategyMode.intervalTime,
                        value: 1 * 1000
                    }
                ]
            });
            spec = s1.getStrategySpec();
            assert.equal(s1.options.adapter, adapter2);
            assert.equal(s1.options.getStorage, getStorage);
            assert.equal(1, getStorageIsExec);
            assert.equal(s1.options.failAction, adapter2);
            assert.equal(spec.storageEnabled, false);
            assert.equal(spec.delayTime, 3 * 1000);
            assert.equal(spec.intervalTime.indexOf(1 * 1000) !== -1, true);

            s1.setOptions({
                strategy: {
                    mode: Squirrel.StrategyMode.event,
                    value: 'test',
                    [Squirrel.DataLevel.normal]: [
                        {
                            mode: Squirrel.StrategyMode.event,
                            value: 'test2'
                        },
                        {
                            mode: Squirrel.StrategyMode.delayTime,
                            value: 3 * 1000
                        },
                    ]
                }
            });
            spec = s1.getStrategySpec();
            assert.equal(spec.event.indexOf('test') !== -1, true);
            assert.equal(spec[Squirrel.DataLevel.normal].event.indexOf('test2') !== -1, true);
            assert.equal(spec[Squirrel.DataLevel.normal].delayTime, 3 * 1000);

            s1.destory();
        })
    });

    describe('上报策略', () => {
        it('delayTime', done => {
            const d1 = Date.now();
            const s1 = new Squirrel({
                adapter: (list) => {
                    assert.equal(2, list.length);
                    assert.equal(list.map(item => item.data).join(','), '哈哈,哈哈2');
                    assert.isTrue(Date.now() - d1 >= 1 * 1000);
                    done();
                },
                strategy: {
                    mode: SwallowStrategyMode.delayTime,
                    value: 1 * 1000
                }
            });
            s1.stuff('哈哈');
            s1.stuff('哈哈2');
        });

        it('intervalTime', function (done) {
            this.timeout(5 * 1000);
            const d1 = Date.now();
            let count = 0;
            const callback = () => {
                assert.isTrue(Date.now() - d1 >= 3 * 1000);
                assert.equal('intervalTimer' in s1, false);
                done();
            }
            const s1 = new Squirrel({
                adapter: (list) => {
                    if (!count) {
                        assert.equal(2, list.length);
                        assert.equal(list.map(item => item.data).join(','), '哈哈,哈哈2');
                        assert.isTrue(Date.now() - d1 >= 1 * 1000);
                        count++;
                        s1.stuff('哈哈3');
                    } else if (count === 1) {
                        assert.equal(1, list.length);
                        assert.equal(list.map(item => item.data).join(','), '哈哈3');
                        assert.isTrue(Date.now() - d1 >= 2 * 1000);
                        count++;
                        s1.destory();
                        setTimeout(() => {
                            callback();
                        }, 1 * 1000)
                    } else {
                        assert.isTrue(false);
                    }
                },
                strategy: {
                    mode: SwallowStrategyMode.intervalTime,
                    value: 1 * 1000
                }
            });
            s1.stuff('哈哈');
            s1.stuff('哈哈2');
        });

        it('intervalCount', function (done) {
            const d1 = Date.now();
            let count = 0;
            const callback = () => {
                assert.isTrue(Date.now() - d1 >= 1 * 1000);
                done();
            }
            const s1 = new Squirrel({
                adapter: (list) => {
                    if (!count) {
                        assert.equal(2, list.length);
                        assert.equal(list.map(item => item.data).join(','), '哈哈,哈哈2');
                        count++;
                        s1.stuff('哈哈3');
                        s1.stuff('哈哈4');
                    } else if (count === 1) {
                        assert.equal(2, list.length);
                        assert.equal(list.map(item => item.data).join(','), '哈哈3,哈哈4');
                        count++;
                        s1.destory();
                        setTimeout(() => {
                            callback();
                        }, 1 * 1000)
                    } else {
                        assert.isTrue(false);
                    }
                },
                strategy: {
                    mode: SwallowStrategyMode.intervalCount,
                    value: 2
                }
            });
            s1.stuff('哈哈');
            s1.stuff('哈哈2');
        });

        it('event', function (done) {
            const d1 = Date.now();
            let count = 0;
            const callback = () => {
                assert.isTrue(Date.now() - d1 >= 1 * 1000);
                done();
            }
            const s1 = new Squirrel({
                adapter: (list) => {
                    if (!count) {
                        assert.equal(2, list.length);
                        assert.equal(list.map(item => item.data).join(','), '哈哈,哈哈2');
                        count++;
                        s1.stuff('哈哈3');
                        s1.stuff('哈哈4');
                        s1.trigger('test');
                    } else if (count === 1) {
                        assert.equal(2, list.length);
                        assert.equal(list.map(item => item.data).join(','), '哈哈3,哈哈4');
                        count++;
                        s1.destory();
                        setTimeout(() => {
                            callback();
                        }, 1 * 1000)
                    } else {
                        assert.isTrue(false);
                    }
                },
                strategy: {
                    mode: SwallowStrategyMode.event,
                    value: 'test'
                }
            });
            s1.stuff('哈哈');
            s1.stuff('哈哈2');
            s1.trigger('test')
        })

        it('eventCount', function (done) {
            const d1 = Date.now();
            let count = 0;
            const callback = () => {
                assert.isTrue(Date.now() - d1 >= 1 * 1000);
                done();
            }
            const s1 = new Squirrel({
                adapter: (list) => {
                    if (!count) {
                        assert.equal(4, list.length);
                        assert.equal(list.map(item => item.data).join(','), '哈哈,哈哈2,哈哈3,哈哈4');
                        count++;
                        s1.stuff('哈哈5');
                        s1.trigger('test');
                    } else if (count === 1) {
                        assert.equal(1, list.length);
                        assert.equal(list.map(item => item.data).join(','), '哈哈5');
                        count++;
                        s1.destory();
                        setTimeout(() => {
                            callback();
                        }, 1 * 1000)
                    } else {
                        assert.isTrue(false);
                    }
                },
                strategy: {
                    mode: SwallowStrategyMode.eventCount,
                    value: {
                        name: 'test',
                        count: 2
                    }
                }
            });
            s1.stuff('哈哈');
            s1.stuff('哈哈2');
            s1.trigger('test');
            s1.stuff('哈哈3');
            s1.stuff('哈哈4');
            s1.trigger('test');
        })
    })
});

/**
 * mathEngine.js - 智能数学题目生成与心算判定引擎
 * 支持小学 1~6 年级多梯度分阶、无负数、防死题、连击与技能触发
 */

export class MathEngine {
    constructor(difficultyConfig = 'grade1_2') {
        this.setConfig(difficultyConfig);
        this.currentQuestion = null;
        this.combo = 0;
        this.maxCombo = 0;
        this.correctCount = 0;
        this.totalAttempted = 0;
        this.roundQuestions = []; // 记录本局每一道题目的做题轨迹与对错
        this.superChargeActive = false; // 超载暴击状态
        this.superChargeTimer = 0;
    }

    // 重置本局做题统计数据
    resetRoundStats() {
        this.combo = 0;
        this.maxCombo = 0;
        this.correctCount = 0;
        this.totalAttempted = 0;
        this.roundQuestions = [];
        this.superChargeActive = false;
        this.superChargeTimer = 0;
    }

    setConfig(configOrKey) {
        if (typeof configOrKey === 'string') {
            this.config = {
                mode: 'preset',
                presetGrade: configOrKey,
                operations: configOrKey === 'grade1_2' ? ['add', 'sub'] :
                            configOrKey === 'grade3_4' ? ['mul', 'div', 'add', 'sub'] : ['add', 'sub', 'mul', 'div'],
                range: configOrKey === 'grade1_2' ? 20 : configOrKey === 'grade3_4' ? 100 : 1000,
                maxMultiplier: configOrKey === 'grade1_2' ? 5 : 9,
                allowCarryBorrow: true,
                allowFillBlank: true
            };
        } else if (configOrKey && typeof configOrKey === 'object') {
            this.config = {
                mode: configOrKey.mode || 'custom',
                presetGrade: configOrKey.presetGrade || 'grade1_2',
                operations: (configOrKey.operations && configOrKey.operations.length > 0) ? configOrKey.operations : ['add'],
                range: Number(configOrKey.range) || 20,
                maxMultiplier: Number(configOrKey.maxMultiplier) || (Number(configOrKey.range) <= 25 ? 5 : 9),
                allowCarryBorrow: configOrKey.allowCarryBorrow !== false,
                allowFillBlank: configOrKey.allowFillBlank !== false
            };
        }
        this.difficultyKey = this.config.presetGrade || 'grade1_2';
        this.combo = 0;
    }

    setDifficulty(keyOrConfig) {
        this.setConfig(keyOrConfig);
        this.nextQuestion();
    }

    static formatSummary(cfg) {
        if (!cfg) return '20以内加减法';
        if (cfg.mode === 'preset') {
            if (cfg.presetGrade === 'grade1_2') return '🌱 1~2年级 (20以内加减)';
            if (cfg.presetGrade === 'grade3_4') return '⚡ 3~4年级 (乘除与心算)';
            if (cfg.presetGrade === 'grade5_6') return '🔥 5~6年级 (四则与高阶)';
        }
        const opNames = [];
        const ops = cfg.operations || ['add'];
        if (ops.includes('add')) opNames.push('加');
        if (ops.includes('sub')) opNames.push('减');
        if (ops.includes('mul')) opNames.push('乘');
        if (ops.includes('div')) opNames.push('除');
        const opStr = opNames.length > 0 ? opNames.join('') : '加法';
        const mulLimitStr = (ops.includes('mul') || ops.includes('div')) ? ` (${cfg.maxMultiplier || 5}以内乘除)` : '';
        return `${cfg.range || 20}以内${opStr}法${mulLimitStr}`;
    }

    // 获取当前难度易读标签
    getDifficultySummary() {
        return MathEngine.formatSummary(this.config);
    }

    // 生成下一道题目
    nextQuestion() {
        let q;
        if (this.config && this.config.mode === 'custom') {
            q = this.generateCustomQuestion();
        } else {
            switch (this.difficultyKey) {
                case 'grade1_2':
                    q = this.generateGrade1_2();
                    break;
                case 'grade3_4':
                    q = this.generateGrade3_4();
                    break;
                case 'grade5_6':
                    q = this.generateGrade5_6();
                    break;
                default:
                    q = this.generateCustomQuestion();
            }
        }
        this.currentQuestion = q;
        return q;
    }

    // 基于用户个性化选项动态生成算式 (支持加减乘除任意组合、数值范围与填空)
    // 生成高质量加法（精准支持20以内凑十法进位、100以内进位与不进位模式）
    generateAddition(range, allowCarry, isFillBlank = false) {
        let a, b, hint = '';
        // 开启进位退位时，75% 概率高频出现真正的进位加法攻坚题，25% 为不进位基础巩固题
        const shouldCarry = allowCarry && (Math.random() < 0.75);

        if (range <= 10) {
            // 10以内加法（结果 <= 10，自然不存在跨十进位）
            a = Math.floor(Math.random() * 8) + 1; // 1~8
            b = Math.floor(Math.random() * (10 - a)) + 1; // 1~(10-a)
            hint = '10以内加法';
        } else if (range <= 20) {
            if (shouldCarry) {
                // 20以内进位加法（小学经典凑十法：单数加单数，个位相加 >= 10，和为 11~18）
                a = Math.floor(Math.random() * 8) + 2; // 2~9
                const minB = 11 - a; // 保证 a + b >= 11 (跨十进位)
                const maxB = 9;      // 保证 b 为一位数
                b = Math.floor(Math.random() * (maxB - minB + 1)) + minB;
                hint = '20以内进位加法 (凑十法)';
            } else {
                // 20以内不进位加法（严格保证个位相加 < 10）
                if (Math.random() < 0.4) {
                    // 10以内不进位：如 3 + 5 = 8
                    a = Math.floor(Math.random() * 7) + 1;
                    b = Math.floor(Math.random() * (9 - a)) + 1;
                } else {
                    // 十几加几不进位：如 12 + 5 = 17, 14 + 3 = 17
                    a = Math.floor(Math.random() * 8) + 11; // 11~18
                    const maxB = 9 - (a % 10); // 保证个位相加 < 10
                    b = Math.floor(Math.random() * Math.max(1, maxB)) + 1;
                }
                hint = '20以内不进位加法';
            }
        } else if (range <= 100) {
            if (shouldCarry) {
                // 100以内进位加法（两位数加一位数进位，或两位数加两位数进位）
                if (Math.random() < 0.45) {
                    // 两位数加一位数进位：例如 28 + 7 = 35, 45 + 8 = 53
                    const aTens = Math.floor(Math.random() * (Math.floor(range / 10) - 2)) + 1; // 10, 20...
                    const aOnes = Math.floor(Math.random() * 8) + 2; // 2~9
                    a = aTens * 10 + aOnes;
                    const minB = 10 - aOnes; // 保证个位相加 >= 10
                    const maxB = Math.min(9, range - a);
                    b = Math.floor(Math.random() * (maxB - minB + 1)) + minB;
                    hint = '两位数加一位数 (进位)';
                } else {
                    // 两位数加两位数进位：例如 28 + 35 = 63, 37 + 46 = 83
                    const maxTensSum = Math.floor(range / 10) - 2;
                    const aTens = Math.floor(Math.random() * Math.max(1, maxTensSum - 1)) + 1;
                    const aOnes = Math.floor(Math.random() * 8) + 2; // 2~9
                    a = aTens * 10 + aOnes;
                    
                    const minBTens = 1;
                    const maxBTens = Math.max(1, maxTensSum - aTens);
                    const bTens = Math.floor(Math.random() * (maxBTens - minBTens + 1)) + minBTens;
                    const minBOnes = 10 - aOnes;
                    const maxBOnes = 9;
                    const bOnes = Math.floor(Math.random() * (maxBOnes - minBOnes + 1)) + minBOnes;
                    b = bTens * 10 + bOnes;
                    hint = '100以内进位加法';
                }
            } else {
                // 100以内不进位加法（严格保证个位相加 < 10）
                const aTens = Math.floor(Math.random() * (Math.floor(range / 10) - 3)) + 1;
                const aOnes = Math.floor(Math.random() * 8) + 1;
                a = aTens * 10 + aOnes;
                const maxBTens = Math.floor(range / 10) - 1 - aTens;
                const bTens = Math.floor(Math.random() * Math.max(1, maxBTens));
                const maxBOnes = 9 - aOnes;
                const bOnes = Math.floor(Math.random() * (maxBOnes + 1));
                b = bTens * 10 + bOnes;
                if (b === 0) b = 1;
                hint = '100以内不进位加法';
            }
        } else {
            // 千以内加法心算
            a = Math.floor(Math.random() * 450) + 50;
            b = Math.floor(Math.random() * (1000 - a - 20)) + 20;
            hint = '千以内加法心算';
        }

        const sum = a + b;
        let expr = '';
        let answer = sum;

        if (isFillBlank) {
            if (Math.random() > 0.5) {
                expr = `${a} + ( ? ) = ${sum}`;
                answer = b;
            } else {
                expr = `( ? ) + ${b} = ${sum}`;
                answer = a;
            }
            hint += ' (填空)';
        } else {
            expr = `${a} + ${b} = ?`;
        }

        return { expr, answer, hint, a, b, sum, isCarry: (a % 10) + (b % 10) >= 10, type: 'add' };
    }

    // 生成高质量减法（精准支持20以内破十法退位、100以内退位与不退位模式）
    generateSubtraction(range, allowCarry, isFillBlank = false) {
        let a, b, hint = '';
        // 开启进位退位时，75% 概率高频出现真正的退位减法攻坚题，25% 为不退位基础巩固题
        const shouldBorrow = allowCarry && (Math.random() < 0.75);

        if (range <= 10) {
            // 10以内减法（不退位）
            a = Math.floor(Math.random() * 9) + 2; // 2~10
            b = Math.floor(Math.random() * (a - 1)) + 1;
            hint = '10以内减法';
        } else if (range <= 20) {
            if (shouldBorrow) {
                // 20以内退位减法（小学经典破十法：十几减几，个位不够减，差为一位数，如 15 - 8 = 7）
                a = Math.floor(Math.random() * 8) + 11; // 11~18
                const ones = a % 10;
                const minB = ones + 1; // 保证个位不够减，必须破十退位
                const maxB = 9;
                b = Math.floor(Math.random() * (maxB - minB + 1)) + minB;
                hint = '20以内退位减法 (破十法)';
            } else {
                // 20以内不退位减法
                if (Math.random() < 0.4) {
                    // 10以内减法：如 9 - 4 = 5
                    a = Math.floor(Math.random() * 8) + 2;
                    b = Math.floor(Math.random() * (a - 1)) + 1;
                } else {
                    // 十几减几不退位：如 17 - 4 = 13, 18 - 5 = 13 (个位够减)
                    a = Math.floor(Math.random() * 8) + 11; // 11~18
                    b = Math.floor(Math.random() * (a % 10)) + 1;
                }
                hint = '20以内不退位减法';
            }
        } else if (range <= 100) {
            if (shouldBorrow) {
                // 100以内退位减法（两位数减一位数退位，或两位数减两位数退位）
                if (Math.random() < 0.45) {
                    // 两位数减一位数退位：如 34 - 7 = 27, 52 - 8 = 44, 40 - 6 = 34
                    const aTens = Math.floor(Math.random() * (Math.floor(range / 10) - 2)) + 2; // 20..90
                    const aOnes = Math.floor(Math.random() * 9); // 0~8
                    a = aTens * 10 + aOnes;
                    const minB = aOnes + 1; // 保证个位不够减
                    const maxB = 9;
                    b = Math.floor(Math.random() * (maxB - minB + 1)) + minB;
                    hint = '两位数减一位数 (退位)';
                } else {
                    // 两位数减两位数退位：如 62 - 37 = 25, 71 - 45 = 26
                    const aTens = Math.floor(Math.random() * (Math.floor(range / 10) - 3)) + 3; // 30..90
                    const aOnes = Math.floor(Math.random() * 9); // 0~8
                    a = aTens * 10 + aOnes;
                    
                    const bTens = Math.floor(Math.random() * (aTens - 2)) + 1;
                    const minBOnes = aOnes + 1;
                    const maxBOnes = 9;
                    const bOnes = Math.floor(Math.random() * (maxBOnes - minBOnes + 1)) + minBOnes;
                    b = bTens * 10 + bOnes;
                    hint = '100以内退位减法';
                }
            } else {
                // 100以内不退位减法（个位够减，十位够减）
                const aTens = Math.floor(Math.random() * (Math.floor(range / 10) - 2)) + 2;
                const aOnes = Math.floor(Math.random() * 8) + 2;
                a = aTens * 10 + aOnes;
                const bTens = Math.floor(Math.random() * (aTens - 1)) + 1;
                const bOnes = Math.floor(Math.random() * (aOnes - 1)) + 1;
                b = bTens * 10 + bOnes;
                hint = '100以内不退位减法';
            }
        } else {
            // 千以内减法速算
            a = Math.floor(Math.random() * 700) + 150;
            b = Math.floor(Math.random() * (a - 50)) + 30;
            hint = '千以内减法速算';
        }

        const diff = a - b;
        let expr = '';
        let answer = diff;

        if (isFillBlank) {
            if (Math.random() > 0.5) {
                expr = `${a} - ( ? ) = ${diff}`;
                answer = b;
            } else {
                expr = `( ? ) - ${b} = ${diff}`;
                answer = a;
            }
            hint += ' (填空)';
        } else {
            expr = `${a} - ${b} = ?`;
        }

        return { expr, answer, hint, a, b, diff, isBorrow: (a % 10) < (b % 10), type: 'sub' };
    }

    // 基于用户个性化选项动态生成算式 (支持加减乘除任意组合、数值范围与填空)
    generateCustomQuestion() {
        const cfg = this.config || {};
        const ops = (cfg.operations && cfg.operations.length > 0) ? cfg.operations : ['add'];
        const range = Number(cfg.range) || 20;
        const allowFillBlank = cfg.allowFillBlank !== false;
        const allowCarry = cfg.allowCarryBorrow !== false;

        const op = ops[Math.floor(Math.random() * ops.length)];
        const isFillBlank = allowFillBlank && Math.random() < 0.28;

        if (op === 'add') {
            return this.generateAddition(range, allowCarry, isFillBlank);
        } else if (op === 'sub') {
            return this.generateSubtraction(range, allowCarry, isFillBlank);
        } else if (op === 'mul') {
            let expr = '';
            let answer = 0;
            let hint = '';
            const limit = Math.max(2, Math.min(9, Number(cfg.maxMultiplier) || (range <= 25 ? 5 : 9)));
            if (range <= 100 || cfg.maxMultiplier) {
                // 表内乘法（严格遵守因数 <= limit，最大算式为 limit × limit）
                const a = Math.floor(Math.random() * (limit - 1)) + 2;
                const b = Math.floor(Math.random() * (limit - 1)) + 2;
                answer = a * b;
                if (isFillBlank) {
                    if (Math.random() > 0.5) {
                        expr = `${a} × ( ? ) = ${answer}`;
                        answer = b;
                    } else {
                        expr = `( ? ) × ${b} = ${answer}`;
                        answer = a;
                    }
                    hint = `${limit}以内乘法填空`;
                } else {
                    expr = `${a} × ${b} = ?`;
                    hint = `${limit}以内乘法口诀`;
                }
            } else {
                if (Math.random() > 0.5) {
                    const a = Math.floor(Math.random() * 30) + 11;
                    const b = Math.floor(Math.random() * 7) + 2;
                    answer = a * b;
                    expr = `${a} × ${b} = ?`;
                    hint = '两位数乘一位数';
                } else {
                    const a = (Math.floor(Math.random() * 8) + 2) * 10;
                    const b = Math.floor(Math.random() * 8) + 2;
                    answer = a * b;
                    expr = `${a} × ${b} = ?`;
                    hint = '整十数乘法';
                }
            }
            return { expr, answer, hint, type: 'mul' };
        } else if (op === 'div') {
            let expr = '';
            let answer = 0;
            let hint = '';
            const limit = Math.max(2, Math.min(9, Number(cfg.maxMultiplier) || (range <= 25 ? 5 : 9)));
            if (range <= 100 || cfg.maxMultiplier) {
                const b = Math.floor(Math.random() * (limit - 1)) + 2; // 除数 <= limit
                const ans = Math.floor(Math.random() * (limit - 1)) + 2; // 商 <= limit
                const a = b * ans; // 被除数 <= limit * limit
                answer = ans;
                if (isFillBlank) {
                    expr = `${a} ÷ ( ? ) = ${ans}`;
                    answer = b;
                    hint = `${limit}以内除法填空`;
                } else {
                    expr = `${a} ÷ ${b} = ?`;
                    hint = `${limit}以内表内除法`;
                }
            } else {
                const b = Math.floor(Math.random() * 8) + 2;
                const ans = (Math.floor(Math.random() * 15) + 3) * 10;
                const a = b * ans;
                expr = `${a} ÷ ${b} = ?`;
                answer = ans;
                hint = '整十整百除法';
            }
            return { expr, answer, hint, type: 'div' };
        }

        return this.generateAddition(range, allowCarry, isFillBlank);
    }

    // 生成小学1-2年级题目（以20以内进位加法与退位减法为核心高频攻坚，兼顾填空与整十巩固）
    generateGrade1_2() {
        const allowCarry = this.config?.allowCarryBorrow !== false;
        const allowFill = this.config?.allowFillBlank !== false;
        const roll = Math.random();

        if (roll < 0.40) {
            // 40% 20以内加法 (高频进位凑十法)
            const res = this.generateAddition(20, allowCarry, false);
            res.type = 'grade1_2';
            return res;
        } else if (roll < 0.80) {
            // 40% 20以内减法 (高频退位破十法)
            const res = this.generateSubtraction(20, allowCarry, false);
            res.type = 'grade1_2';
            return res;
        } else if (roll < 0.90 && allowFill) {
            // 10% 进退位凑数填空题 (8 + ? = 15 或 13 - ? = 6)
            const isAdd = Math.random() > 0.5;
            const res = isAdd ? this.generateAddition(20, allowCarry, true) : this.generateSubtraction(20, allowCarry, true);
            res.type = 'grade1_2';
            return res;
        } else {
            // 10% 整十数速算巩固 (如 20 + 30 = 50, 70 - 40 = 30)
            const a = (Math.floor(Math.random() * 8) + 1) * 10;
            const b = (Math.floor(Math.random() * 8) + 1) * 10;
            if (Math.random() > 0.5) {
                return { expr: `${a} + ${b} = ?`, answer: a + b, hint: '整十速算 (加)', type: 'grade1_2' };
            } else {
                const maxVal = Math.max(a, b);
                const minVal = Math.min(a, b);
                return { expr: `${maxVal} - ${minVal} = ?`, answer: maxVal - minVal, hint: '整十速算 (减)', type: 'grade1_2' };
            }
        }
    }

    // 生成小学3-4年级题目
    generateGrade3_4() {
        const subType = Math.floor(Math.random() * 4);
        let expr = '';
        let answer = 0;
        let hint = '';

        if (subType === 0) {
            // 九九乘法表
            const a = Math.floor(Math.random() * 8) + 2; // 2~9
            const b = Math.floor(Math.random() * 8) + 2; // 2~9
            expr = `${a} × ${b} = ?`;
            answer = a * b;
            hint = '乘法口诀';
        } else if (subType === 1) {
            // 表内除法 (整除)
            const b = Math.floor(Math.random() * 8) + 2; // 2~9 (除数)
            const ans = Math.floor(Math.random() * 8) + 2; // 2~9 (商)
            const a = b * ans; // 被除数
            expr = `${a} ÷ ${b} = ?`;
            answer = ans;
            hint = '表内除法';
        } else if (subType === 2) {
            // 两位数乘一位数速算 (如 12 × 4)
            const a = Math.floor(Math.random() * 15) + 11; // 11~25
            const b = Math.floor(Math.random() * 4) + 2;   // 2~5
            expr = `${a} × ${b} = ?`;
            answer = a * b;
            hint = '多位数乘法';
        } else {
            // 百以内加减两步混合或填空 (如 45 + ? = 82)
            const isMulFill = Math.random() > 0.5;
            if (isMulFill) {
                const a = Math.floor(Math.random() * 8) + 2;
                const ans = Math.floor(Math.random() * 8) + 2;
                expr = `( ? ) × ${a} = ${a * ans}`;
                answer = ans;
                hint = '乘除填空';
            } else {
                const a = Math.floor(Math.random() * 40) + 20;
                const b = Math.floor(Math.random() * 30) + 15;
                expr = `${a} + ${b} = ?`;
                answer = a + b;
                hint = '两位数心算';
            }
        }

        return { expr, answer, hint, type: 'grade3_4' };
    }

    // 生成小学5-6年级题目
    generateGrade5_6() {
        const subType = Math.floor(Math.random() * 4);
        let expr = '';
        let answer = 0;
        let hint = '';

        if (subType === 0) {
            // 四则混合运算 (乘除优先或带括号)
            const a = Math.floor(Math.random() * 20) + 5;
            const b = Math.floor(Math.random() * 8) + 2;
            const c = Math.floor(Math.random() * 7) + 2;
            if (Math.random() > 0.5) {
                expr = `${a} + ${b} × ${c} = ?`;
                answer = a + (b * c);
            } else {
                const mul = b * c;
                expr = `${mul} ÷ ${b} + ${a} = ?`;
                answer = c + a;
            }
            hint = '四则混合';
        } else if (subType === 1) {
            // 带括号简易运算 ( (a + b) × c )
            const a = Math.floor(Math.random() * 8) + 3;
            const b = Math.floor(Math.random() * 8) + 2;
            const c = Math.floor(Math.random() * 5) + 2;
            expr = `(${a} + ${b}) × ${c} = ?`;
            answer = (a + b) * c;
            hint = '优先括号运算';
        } else if (subType === 2) {
            // 最大公因数 / 最小公倍数趣味题
            const pairs = [
                { a: 6, b: 8, gcd: 2, lcm: 24 },
                { a: 12, b: 18, gcd: 6, lcm: 36 },
                { a: 8, b: 12, gcd: 4, lcm: 24 },
                { a: 15, b: 20, gcd: 5, lcm: 60 },
                { a: 9, b: 12, gcd: 3, lcm: 36 },
                { a: 14, b: 21, gcd: 7, lcm: 42 }
            ];
            const chosen = pairs[Math.floor(Math.random() * pairs.length)];
            const askGcd = Math.random() > 0.5;
            if (askGcd) {
                expr = `${chosen.a} 和 ${chosen.b} 的最大公因数是?`;
                answer = chosen.gcd;
                hint = '公因数心算';
            } else {
                expr = `${chosen.a} 和 ${chosen.b} 的最小公倍数是?`;
                answer = chosen.lcm;
                hint = '公倍数心算';
            }
        } else {
            // 巧算速算 (如 25 × 12 = 300, 15 × 15 = 225)
            const tricks = [
                { expr: '25 × 12 = ?', ans: 300 },
                { expr: '25 × 16 = ?', ans: 400 },
                { expr: '15 × 15 = ?', ans: 225 },
                { expr: '125 × 8 = ?', ans: 1000 },
                { expr: '35 × 4 = ?', ans: 140 },
                { expr: '45 × 4 = ?', ans: 180 },
                { expr: '99 + 88 = ?', ans: 187 }
            ];
            const chosen = tricks[Math.floor(Math.random() * tricks.length)];
            expr = chosen.expr;
            answer = chosen.ans;
            hint = '简便巧算';
        }

        return { expr, answer, hint, type: 'grade5_6' };
    }

    // 生成怪兽数学弱点护盾题目 (严格契合用户选择的运算法则、乘法上限与数值范围)
    generateShieldWeakness() {
        const cfg = this.config || {};
        const ops = (cfg.operations && cfg.operations.length > 0) ? cfg.operations : ['add'];
        const op = ops[Math.floor(Math.random() * ops.length)];
        const range = Number(cfg.range) || 20;
        const maxMul = Math.max(2, Math.min(9, Number(cfg.maxMultiplier) || (range <= 25 ? 5 : 9)));
        const allowCarry = cfg.allowCarryBorrow !== false;

        let expr = '';
        let answer = 0;
        let hint = '';

        if (op === 'add') {
            const addRes = this.generateAddition(range, allowCarry, Math.random() > 0.4);
            expr = addRes.expr.replace(/\( \? \)/g, '?');
            answer = addRes.answer;
            hint = `${range}以内加法护盾`;
        } else if (op === 'sub') {
            const subRes = this.generateSubtraction(range, allowCarry, Math.random() > 0.4);
            expr = subRes.expr.replace(/\( \? \)/g, '?');
            answer = subRes.answer;
            hint = `${range}以内减法护盾`;
        } else if (op === 'mul') {
            // 表内乘法：因数严格受到 maxMul 限制 (如选5则最大 5×5)
            const a = Math.floor(Math.random() * (maxMul - 1)) + 2;
            const b = Math.floor(Math.random() * (maxMul - 1)) + 2;
            const prod = a * b;
            if (Math.random() > 0.4) {
                expr = `${a} × ? = ${prod}`;
                answer = b;
            } else {
                expr = `${a} × ${b} = ?`;
                answer = prod;
            }
            hint = `${maxMul}以内乘法护盾`;
        } else if (op === 'div') {
            // 表内除法：除数与商均受 maxMul 限制
            const b = Math.floor(Math.random() * (maxMul - 1)) + 2;
            const ans = Math.floor(Math.random() * (maxMul - 1)) + 2;
            const a = b * ans;
            if (Math.random() > 0.4) {
                expr = `${a} ÷ ? = ${ans}`;
                answer = b;
            } else {
                expr = `${a} ÷ ${b} = ?`;
                answer = ans;
            }
            hint = `${maxMul}以内除法护盾`;
        }

        return {
            expr,
            answer,
            hint,
            opType: op,
            damageMultiplier: 3.5
        };
    }

    // 载入特定怪物的弱点算式题目
    loadCustomProblem(q) {
        this.currentQuestion = {
            expr: q.expr,
            answer: q.answer,
            hint: q.hint || '🎯 击破锁定怪物的弱点护盾！',
            isShieldNuke: !!q.isShieldNuke,
            enemyRef: q.enemyRef || null,
            type: 'weakness_shield'
        };
        return this.currentQuestion;
    }

    // 提交答案判定
    submitAnswer(inputVal) {
        this.totalAttempted++;
        const parsed = parseInt(String(inputVal).trim(), 10);
        if (isNaN(parsed)) {
            return { correct: false, reason: 'invalid_input' };
        }

        const isCorrect = (this.currentQuestion && parsed === this.currentQuestion.answer);
        const isShieldNuke = !!(this.currentQuestion && this.currentQuestion.isShieldNuke);
        const enemyRef = this.currentQuestion ? this.currentQuestion.enemyRef : null;

        // 记录做题明细轨迹（题干、正确答案、孩子输入、是否正确、是否破盾题）
        if (this.currentQuestion) {
            this.roundQuestions.push({
                id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                expr: this.currentQuestion.expr,
                answer: this.currentQuestion.answer,
                userAnswer: parsed,
                isCorrect: isCorrect,
                isShieldNuke: isShieldNuke,
                time: Date.now()
            });
        }

        if (isCorrect) {
            this.correctCount++;
            this.combo++;
            if (this.combo > this.maxCombo) {
                this.maxCombo = this.combo;
            }

            // 连击达到 5 的倍数时激活超载光环
            let fanfare = false;
            if (this.combo >= 5 && this.combo % 5 === 0) {
                this.superChargeActive = true;
                this.superChargeTimer = 8.0; // 持续8秒超载
                fanfare = true;
            }

            const res = {
                correct: true,
                combo: this.combo,
                superCharged: this.superChargeActive,
                fanfare: fanfare,
                goldGain: (isShieldNuke ? 30 : 15) + Math.min(this.combo * 2, 20),
                isShieldNuke: isShieldNuke,
                enemyRef: enemyRef
            };

            this.nextQuestion();
            return res;
        } else {
            this.combo = 0; // 连击中断
            return {
                correct: false,
                combo: 0,
                expected: this.currentQuestion ? this.currentQuestion.answer : null
            };
        }
    }

    update(dt) {
        if (this.superChargeActive) {
            this.superChargeTimer -= dt;
            if (this.superChargeTimer <= 0) {
                this.superChargeActive = false;
            }
        }
    }
}

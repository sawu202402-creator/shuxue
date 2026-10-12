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
    generateCustomQuestion() {
        const cfg = this.config || {};
        const ops = (cfg.operations && cfg.operations.length > 0) ? cfg.operations : ['add'];
        const range = Number(cfg.range) || 20;
        const allowFillBlank = cfg.allowFillBlank !== false;
        const allowCarry = cfg.allowCarryBorrow !== false;

        const op = ops[Math.floor(Math.random() * ops.length)];
        const isFillBlank = allowFillBlank && Math.random() < 0.28;

        let expr = '';
        let answer = 0;
        let hint = '';

        if (op === 'add') {
            if (range <= 10) {
                const a = Math.floor(Math.random() * 8) + 1;
                const b = Math.floor(Math.random() * (10 - a)) + 1;
                answer = a + b;
                if (isFillBlank) {
                    if (Math.random() > 0.5) {
                        expr = `${a} + ( ? ) = ${answer}`;
                        answer = b;
                    } else {
                        expr = `( ? ) + ${b} = ${answer}`;
                        answer = a;
                    }
                    hint = '10以内凑数填空';
                } else {
                    expr = `${a} + ${b} = ?`;
                    hint = '10以内加法';
                }
            } else if (range <= 20) {
                let a, b;
                if (allowCarry && Math.random() > 0.4) {
                    a = Math.floor(Math.random() * 8) + 3;
                    b = Math.floor(Math.random() * (20 - a - 2)) + Math.max(1, 10 - a + 1);
                    b = Math.min(b, 20 - a);
                } else {
                    a = Math.floor(Math.random() * 11) + 2;
                    b = Math.floor(Math.random() * (range - a)) + 1;
                }
                answer = a + b;
                if (isFillBlank) {
                    expr = `${a} + ( ? ) = ${answer}`;
                    answer = b;
                    hint = '20以内填空';
                } else {
                    expr = `${a} + ${b} = ?`;
                    hint = '20以内口算';
                }
            } else if (range <= 100) {
                if (Math.random() < 0.35) {
                    const a = (Math.floor(Math.random() * 8) + 1) * 10;
                    const maxB = Math.floor((range - a) / 10);
                    const b = (Math.floor(Math.random() * Math.max(1, maxB)) + 1) * 10;
                    expr = `${a} + ${b} = ?`;
                    answer = a + b;
                    hint = '整十快速加';
                } else {
                    const a = Math.floor(Math.random() * (range - 15)) + 10;
                    const b = Math.floor(Math.random() * (range - a - 2)) + 2;
                    answer = a + b;
                    expr = `${a} + ${b} = ?`;
                    hint = `${range}以内加法`;
                }
            } else {
                const a = Math.floor(Math.random() * 450) + 50;
                const b = Math.floor(Math.random() * (1000 - a - 20)) + 20;
                answer = a + b;
                expr = `${a} + ${b} = ?`;
                hint = '千以内加法心算';
            }
        } else if (op === 'sub') {
            if (range <= 10) {
                const a = Math.floor(Math.random() * 9) + 2;
                const b = Math.floor(Math.random() * (a - 1)) + 1;
                answer = a - b;
                if (isFillBlank) {
                    expr = `${a} - ( ? ) = ${answer}`;
                    answer = b;
                    hint = '10以内减法填空';
                } else {
                    expr = `${a} - ${b} = ?`;
                    hint = '10以内减法';
                }
            } else if (range <= 20) {
                let a, b;
                if (allowCarry && Math.random() > 0.4) {
                    a = Math.floor(Math.random() * 8) + 11;
                    b = Math.floor(Math.random() * (a - 10)) + (a % 10 + 1);
                    b = Math.min(b, 9);
                } else {
                    a = Math.floor(Math.random() * 15) + 5;
                    b = Math.floor(Math.random() * (a - 1)) + 1;
                }
                answer = a - b;
                if (isFillBlank) {
                    expr = `${a} - ( ? ) = ${answer}`;
                    answer = b;
                    hint = '20以内减法填空';
                } else {
                    expr = `${a} - ${b} = ?`;
                    hint = '20以内减法';
                }
            } else if (range <= 100) {
                const a = Math.floor(Math.random() * (range - 15)) + 15;
                const b = Math.floor(Math.random() * (a - 5)) + 5;
                answer = a - b;
                expr = `${a} - ${b} = ?`;
                hint = `${range}以内减法`;
            } else {
                const a = Math.floor(Math.random() * 700) + 150;
                const b = Math.floor(Math.random() * (a - 50)) + 30;
                answer = a - b;
                expr = `${a} - ${b} = ?`;
                hint = '千以内减法速算';
            }
        } else if (op === 'mul') {
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
        } else if (op === 'div') {
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
        }

        return {
            expr,
            answer,
            hint: hint || '小学心算',
            type: op
        };
    }


    // 生成小学1-2年级题目
    generateGrade1_2() {
        const subType = Math.floor(Math.random() * 4);
        let expr = '';
        let answer = 0;
        let hint = '';

        if (subType === 0) {
            // 20以内加法
            const a = Math.floor(Math.random() * 11) + 2; // 2~12
            const b = Math.floor(Math.random() * 10) + 1; // 1~10
            expr = `${a} + ${b} = ?`;
            answer = a + b;
            hint = '加法口算';
        } else if (subType === 1) {
            // 20以内减法（保证结果 > 0）
            const a = Math.floor(Math.random() * 12) + 7; // 7~18
            const b = Math.floor(Math.random() * (a - 1)) + 1;
            expr = `${a} - ${b} = ?`;
            answer = a - b;
            hint = '减法口算';
        } else if (subType === 2) {
            // 100以内整十数加减
            const isAdd = Math.random() > 0.5;
            const a = (Math.floor(Math.random() * 8) + 1) * 10;
            const b = (Math.floor(Math.random() * 8) + 1) * 10;
            if (isAdd) {
                expr = `${a} + ${b} = ?`;
                answer = a + b;
            } else {
                const maxVal = Math.max(a, b);
                const minVal = Math.min(a, b);
                expr = `${maxVal} - ${minVal} = ?`;
                answer = maxVal - minVal;
            }
            hint = '整十速算';
        } else {
            // 填空加法 (8 + ? = 15)
            const a = Math.floor(Math.random() * 9) + 2;
            const ans = Math.floor(Math.random() * 9) + 1;
            const total = a + ans;
            expr = `${a} + ( ? ) = ${total}`;
            answer = ans;
            hint = '凑数填空';
        }

        return { expr, answer, hint, type: 'grade1_2' };
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
            if (range <= 10) {
                const a = Math.floor(Math.random() * 8) + 1;
                const b = Math.floor(Math.random() * (10 - a)) + 1;
                const sum = a + b;
                if (Math.random() > 0.4) {
                    expr = `${a} + ? = ${sum}`;
                    answer = b;
                } else {
                    expr = `${a} + ${b} = ?`;
                    answer = sum;
                }
                hint = '10以内加法护盾';
            } else if (range <= 20) {
                let a, b;
                if (allowCarry && Math.random() > 0.4) {
                    a = Math.floor(Math.random() * 8) + 3;
                    b = Math.floor(Math.random() * (20 - a - 2)) + Math.max(1, 10 - a + 1);
                    b = Math.min(b, 20 - a);
                } else {
                    a = Math.floor(Math.random() * 11) + 2;
                    b = Math.floor(Math.random() * (range - a)) + 1;
                }
                const sum = a + b;
                if (Math.random() > 0.4) {
                    expr = `${a} + ? = ${sum}`;
                    answer = b;
                } else {
                    expr = `${a} + ${b} = ?`;
                    answer = sum;
                }
                hint = '20以内加法护盾';
            } else {
                const a = Math.floor(Math.random() * (range - 15)) + 10;
                const b = Math.floor(Math.random() * (range - a - 2)) + 2;
                const sum = a + b;
                if (Math.random() > 0.5) {
                    expr = `${a} + ? = ${sum}`;
                    answer = b;
                } else {
                    expr = `${a} + ${b} = ?`;
                    answer = sum;
                }
                hint = `${range}以内加法护盾`;
            }
        } else if (op === 'sub') {
            if (range <= 10) {
                const a = Math.floor(Math.random() * 9) + 2;
                const b = Math.floor(Math.random() * (a - 1)) + 1;
                const diff = a - b;
                if (Math.random() > 0.4) {
                    expr = `${a} - ? = ${diff}`;
                    answer = b;
                } else {
                    expr = `${a} - ${b} = ?`;
                    answer = diff;
                }
                hint = '10以内减法护盾';
            } else if (range <= 20) {
                let a, b;
                if (allowCarry && Math.random() > 0.4) {
                    a = Math.floor(Math.random() * 8) + 11;
                    b = Math.floor(Math.random() * (a - 10)) + (a % 10 + 1);
                    b = Math.min(b, 9);
                } else {
                    a = Math.floor(Math.random() * 15) + 5;
                    b = Math.floor(Math.random() * (a - 1)) + 1;
                }
                const diff = a - b;
                if (Math.random() > 0.4) {
                    expr = `${a} - ? = ${diff}`;
                    answer = b;
                } else {
                    expr = `${a} - ${b} = ?`;
                    answer = diff;
                }
                hint = '20以内减法护盾';
            } else {
                const a = Math.floor(Math.random() * (range - 15)) + 15;
                const b = Math.floor(Math.random() * (a - 5)) + 5;
                const diff = a - b;
                if (Math.random() > 0.5) {
                    expr = `${a} - ? = ${diff}`;
                    answer = b;
                } else {
                    expr = `${a} - ${b} = ?`;
                    answer = diff;
                }
                hint = `${range}以内减法护盾`;
            }
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

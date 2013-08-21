
var assert = require('assert');
var diff = require('diff');
var chardiff = require('../');

function _reformatResult(diffArray) {
    var i = 0;
    while (i < diffArray.length){
        if (diffArray[i].added) {
            // Added or Changed
            if (diffArray[i+1] && diffArray[i+1].removed) {
                // Changed
                diffArray[i] = [diffArray[i+1].value, diffArray[i].value];
                diffArray[i+1] = null;
                i += 2;
            } else {
                // Added
                diffArray[i] = [1, diffArray[i].value];
                i++;
            }
        } else if (diffArray[i].removed) {
            // Removed
            diffArray[i] = [0, diffArray[i].value];
            i++;
        } else {
            // Unchanged
            diffArray[i] = diffArray[i].value;
            i++;
        }
    }
    return diffArray;
}

// Returns line length ignoring ANSI color sequences in the line.
function _lineLength(str) {
    // The number of actual characters counted.
    var ct = 0;
    // Whether we are inside a color sequence.
    var inSeq = false;

    for (var i = 0; i < str.length; i++) {
        if (str[i] === '\x1B') {
            inSeq = true;
        } else if (inSeq) {
            if (str[i] === 'm') {
                inSeq = false;
            }
        } else {
            ct++;
        }
    }

    return ct;
}

if (require.main === module) {
    var a = '{\n' +
            '  "a": 3,\n' +
            '  "b": 6,\n' +
            '   "c": [\n' +
            '    1,\n' +
            '    2,\n' +
            '    3\n' +
            '  ]\n' +
            '}\n',
        b = '{\n' +
            '  "a": 3,\n' +
            '  "b": {\n' +
            '    "x": 5\n' +
            '  },\n' +
            '  "c": [\n' +
            '    1,\n' +
            '    2\n' +
            '  ]\n' +
            '}\n',
        result = chardiff(a, b),
        result2 = _reformatResult(diff.diffChars(a, b)),
        result3 = _reformatResult(diff.diffLines(a, b)),
        res = [],
        res2 = [],
        res3 = [],
        i, j, k,
        change, chg, arr, ln, len, str;

    var red = '\x1B[31m',
        green = '\x1B[32m',
        cyan = '\x1B[36m',
        clear = '\x1B[0m';

    for (i = 0; i < result.length; i++) {
        change = result[i];

        if (change.type === '=') {
            res.push(change.value);
        } else if (change.type === '-') {
            res.push(red + change.left.replace(/ /g, '\u2423') + clear);
        } else if (change.type === '+') {
            res.push(green + change.right.replace(/ /g, '\u2423') + clear);
        } else {
            ln = '';
            for (j = 0; j < change.diff.length; j++) {
                chg = change.diff[j];

                if (chg.type === '=') {
                    ln += chg.value;
                } else if (chg.type === '-') {
                    ln += red + chg.left.replace(/ /g, '\u2423') + clear;
                } else if (chg.type === '+') {
                    ln += green + chg.right.replace(/ /g, '\u2423') + clear;
                } else {
                    ln += red + chg.left.replace(/ /g, '\u2423') + clear;
                    ln += green + chg.right.replace(/ /g, '\u2423') + clear;
                }
            }
            res.push(ln);
        }
    }

    ln = '';
    for (i = 0; i < result2.length; i++) {
        change = result2[i];
        if (change === null) { continue; }

        var strs = [];
        var prefixes = ['', red, green];
        var suffices = ['', clear, clear];

        if (typeof change === 'string') {
            strs[0] = change;
        } else if (typeof change[0] === 'number') {
            if (change[0]) {
                strs[2] = change[1].replace(/ /g, '\u2423');
            } else {
                strs[1] = change[1].replace(/ /g, '\u2423');
            }
        } else {
            strs[1] = change[0].replace(/ /g, '\u2423');
            strs[2] = change[1].replace(/ /g, '\u2423');
        }

        for (j = 0; j < 3; j++) {
            if (strs[j]) {
                arr = strs[j].split('\n');
                for (k = 0; k < arr.length; k++) {
                    ln += prefixes[j] + arr[k] + suffices[j];
                    if (k < arr.length - 1) {
                        res2.push(ln);
                        ln = '';
                    }
                }
            }
        }
    }
    if (ln) {
        res2.push(ln);
    }

    for (i = 0; i < result3.length; i++) {
        change = result3[i];
        if (change === null) { continue; }

        if (typeof change === 'string') {
            arr = change.split('\n');
            arr.pop();
            res3 = res3.concat(arr);
        } else if (typeof change[0] === 'number') {
            arr = change[1].split('\n');
            arr.pop();
            for (j = 0; j < arr.length; j++) {
                arr[j] = (change[0] ? green : red) + arr[j] + clear;
            }
            res3 = res3.concat(arr);
        } else {
            arr = change[0].split('\n');
            arr.pop();
            for (j = 0; j < arr.length; j++) {
                arr[j] = red + arr[j] + clear;
            }
            res3 = res3.concat(arr);

            arr = change[1].split('\n');
            arr.pop();
            for (j = 0; j < arr.length; j++) {
                arr[j] = green + arr[j] + clear;
            }
            res3 = res3.concat(arr);
        }
    }

    // Display the results side by side
    var indents = [2, 18, 34, 53, 72],
        operands = [a.split('\n'), b.split('\n'), res3, res2, res];

    operands[0].unshift(red + 'Operand 1:' + clear);
    operands[1].unshift(green + 'Operand 2:' + clear);
    operands[2].unshift(cyan + 'diff.diffLines():' + clear);
    operands[3].unshift(cyan + 'diff.diffChars():' + clear);
    operands[4].unshift(cyan + 'chardiff():' + clear);

    var maxLen = 0;
    for (i = 0; i < 5; i++) {
        if (operands[i].length > maxLen) {
            maxLen = operands[i].length;
        }
    }

    console.log('\n');
    for (i = 0; i < maxLen; i++) {
        ln = '';
        len = 0;

        for (j = 0; j < 5; j++) {
            // Ensure indentation
            ln += new Array(indents[j] - len + 1).join(' ');
            len = indents[j];
            if (i !== 0) {
                ln += '|';
                len++;
            }
            // Add line content if existed.
            str = operands[j][i];
            if (str) {
                // Remove '\n'
                str = str.replace(/\n+/g, '');
                ln += str;
                len += _lineLength(str);
            }
        }

        console.log(ln);
    }
    console.log('\n');
}

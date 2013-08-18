
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

if (require.main === module) {
    var a = "if (change.type === '=' || change.type === '*') {\n" +
            "    if (!(curLineLeft === target[idx][0] && curLineRight === target[idx][1])) {\n" +
            "        return false;\n" +
            "    }\n" +
            "    curLineLeft++;\n" +
            "    curLineRight++;\n" +
            "    idx++;\n" +
            "} else if (change.type === '-') {\n" +
            "    curLineLeft++;\n" +
            "} else {\n" +
            "    curLineRight++;\n" +
            "}",
        b = "if (change.type === '=') {     // Unchanged\n" +
            "    if (!(curLineLeft === target[idx][0] && curLineRight === target[idx][1])) {\n" +
            "        return false;\n" +
            "    }\n" +
            "    curLineLeft += 1;\n" +
            "    curLineRight += 1;\n" +
            "    idx += 1;\n" +
            "} else if (change.type === '+') {  // Added\n" +
            "    curLineRight += 1;\n" +
            "} else if (change.type === '-') {  // Removed\n" +
            "    curLineLeft += 1;\n" +
            "} else {       // Changed\n" +
            "    if (!(curLineLeft === target[idx][0] && curLineRight === target[idx][1])) {\n" +
            "        return false;\n" +
            "    }\n" +
            "    curLineLeft += 1;\n" +
            "    curLineRight += 1;\n" +
            "    idx += 1;\n" +
            "}",
        result = chardiff(a, b),
        result2 = _reformatResult(diff.diffChars(a, b)),
        res = [],
        res2 = [],
        i, j,
        change, chg;

    var red = '\x1B[31m',
        green = '\x1B[32m',
        cyan = '\x1B[36m',
        clear = '\x1B[0m';

    for (i = 0; i < result.length; i++) {
        change = result[i];

        if (change.type === '=') {
            res.push(change.value);
        } else if (change.type === '-') {
            res.push(red + change.left + clear);
        } else if (change.type === '+') {
            res.push(green + change.right + clear);
        } else {
            for (j = 0; j < change.diff.length; j++) {
                chg = change.diff[j];

                if (chg.type === '=') {
                    res.push(chg.value);
                } else if (chg.type === '-') {
                    res.push(red + chg.left + clear);
                } else if (chg.type === '+') {
                    res.push(green + chg.right + clear);
                } else {
                    res.push(red + chg.left + clear);
                    res.push(green + chg.right + clear);
                }
            }
        }
    }

    for (i = 0; i < result2.length; i++) {
        change = result2[i];
        if (change === null) { continue; }

        if (typeof change === 'string') {
            res2.push(change);
        } else if (typeof change[0] === 'number') {
            if (change[0]) {
                res2.push(green + change[1] + clear);
            } else {
                res2.push(red + change[1] + clear);
            }
        } else {
            res2.push(red + change[0] + clear);
            res2.push(green + change[1] + clear);
        }
    }

    console.log(cyan + 'Diff operand 1:' + clear);
    console.log(a);
    console.log();

    console.log(cyan + 'Diff operand 2:' + clear);
    console.log(b);
    console.log();

    console.log(cyan + 'Result by jsdiff:' + clear);
    console.log(res2.join(''));
    console.log();

    console.log(cyan + 'Result by us:' + clear);
    console.log(res.join(''));
    console.log();
}

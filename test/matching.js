/* global describe, it */
var assert = require('assert');
var chardiff = require('../');

function _checkOneLine(value, isLastLine) {
    if (typeof value !== 'string') { return false; }

    var lines = value.split('\n');
    if (lines.length === 2 && lines[1] === '') {
        return true;
    } else if (lines.length === 1 && isLastLine) {
        return true;
    }

    return false;
}

// Checks whether each entry in the resulted changes array contains exactly
// one line, with a '\n' character at the end (except perhaps the last line).
function checkOneLine(result) {
    var isLeftLastLine = true,
        isRightLastLine = true;

    for (var i = result.length - 1; i >= 0 ; i--) {
        var change = result[i];

        if (change.type === '=') {
            if (!_checkOneLine(change.value, isLeftLastLine && isRightLastLine)) { return false; }
            isLeftLastLine = isRightLastLine = false;
        } else if (change.type === '-') {
            if (!_checkOneLine(change.left, isLeftLastLine)) { return false; }
            isLeftLastLine = false;
        } else if (change.type === '+') {
            if (!_checkOneLine(change.right, isRightLastLine)) { return false; }
            isRightLastLine = false;
        } else {
            if (!_checkOneLine(change.left, isLeftLastLine)) { return false; }
            if (!_checkOneLine(change.right, isRightLastLine)) { return false; }
            isLeftLastLine = isRightLastLine = false;
        }
    }

    return true;
}

// Checks whether we made the correct decisions (specified in `target`) when
// matching lines.
function checkMatchings(result, target) {
    var curLineLeft = 0,
        curLineRight = 0,
        idx = 0;

    for (var i = 0; i < result.length; i++) {
        var change = result[i];

        if (change.type === '=' || change.type === '*') {
            if (!(curLineLeft === target[idx][0] && curLineRight === target[idx][1])) {
                return false;
            }
            curLineLeft++;
            curLineRight++;
            idx++;
        } else if (change.type === '-') {
            curLineLeft++;
        } else {
            curLineRight++;
        }
    }

    if (idx !== target.length) {
        return false;
    }

    return true;
}

// Checks whether the result contains contradictions.
function checkConsistency(result) {
    for (var i = 0; i < result.length; i++) {
        var change = result[i];

        if (change.type === '*') {
            if (!change.left || !change.right || change.left === change.right) {
                return false;
            }
        } else if (change.type === '-') {
            if (!change.left) {
                return false;
            }
        } else if (change.type === '+') {
            if (!change.right) {
                return false;
            }
        } else {
            if (change.value === undefined) {
                return false;
            }
        }
    }
    return true;
}

// Checks whether we faithfully preserved the content of the two operands.
function checkNoMod(a, b, result) {
    var myA = '',
        myB = '';

    for (var i = 0; i < result.length; i++) {
        var change = result[i];

        if (change.type === '*') {
            myA += change.left;
            myB += change.right;
        } else if (change.type === '-') {
            myA += change.left;
        } else if (change.type === '+') {
            myB += change.right;
        } else {
            myA += change.value;
            myB += change.value;
        }
    }
    return (a === myA) && (b === myB);
}

describe('Matching of lines:', function(){
    describe('result of test 1', function(){
        var a = 'abcde\n222333\nsdk;g;sdgh',
            b = 'abcde\nabcde\n2267833\n3254364768\nsdk;dgh\nsdfsdfdf',
            result = chardiff(a, b);
        var target = [[0, 0], [1, 2], [2, 4]];

        it('should have exactly one line in each entry', function() {
            assert(checkOneLine(result));
        });
        it('should generate correct matchings', function() {
            assert(checkMatchings(result, target));
        });
        it('should be consistent', function() {
            assert(checkConsistency(result));
        });
        it('should not modify content of the input', function() {
            assert(checkNoMod(a, b, result));
        });
    });

    describe('result of test 2', function(){
        var a = '',
            b = '',
            result = chardiff(a, b);
        var target = [[0, 0]];

        it('should have exactly one line in each entry', function() {
            assert(checkOneLine(result));
        });
        it('should generate correct matchings', function() {
            assert(checkMatchings(result, target));
        });
        it('should be consistent', function() {
            assert(checkConsistency(result));
        });
        it('should not modify content of the input', function() {
            assert(checkNoMod(a, b, result));
        });
    });

    describe('result of test 3', function(){
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
            result = chardiff(a, b);
        var target = [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7, 9], [8, 10], [10, 16], [11, 18]];

        it('should have exactly one line in each entry', function() {
            assert(checkOneLine(result));
        });
        it('should generate correct matchings', function() {
            assert(checkMatchings(result, target));
        });
        it('should be consistent', function() {
            assert(checkConsistency(result));
        });
        it('should not modify content of the input', function() {
            assert(checkNoMod(a, b, result));
        });
    });
});

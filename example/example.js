
var diff = require('../');

var text1 = 'The quick brown\nfox jumps over\nthe lazy dog\n';
var text2 = 'The fast, brown,\nclever, lovely animal\n' +
            'people say is a fox\njumps over something,\nwhat is it?\n';

// Diff two blocks of text, get an array of line changes.
var changeset = diff(text1, text2);
// Count the number of lines in each block of text.
var lineCount1 = 0,
    lineCount2 = 0;
// ANSI color codes used to colorize the diff for printing.
var red = '\x1B[31m',
    green = '\x1B[32m',
    cyan = '\x1B[36m',
    clear = '\x1B[0m';
// Holds the colorized diff.
var result = '';

// Each change in the set contains one line, either an added line, a removed
// line, a changed line, or an unchanged line.
for (var i = 0; i < changeset.length; i++) {
    var change = changeset[i];

    if (change.type === '=') {
        // This is an unchanged line.
        result += change.value;
        lineCount1++;
        lineCount2++;
    } else if (change.type === '-') {
        // This is a removed line.
        result += red + change.left + clear;
        lineCount1++;
    } else if (change.type === '+') {
        // This is an added line.
        result += green + change.right + clear;
        lineCount2++;
    } else {    // change.type === '*'
        // This is a changed line.
        // This entry has a property `diff` that holds char-level diffs in
        // this line.
        for (var j = 0; j < change.diff.length; j++) {
            var chg = change.diff[j];

            if (chg.type === '=') {
                // These are unchanged chars.
                result += chg.value;
            } else if (chg.type === '-') {
                // These are removed chars.
                result += red + chg.left + clear;
            } else if (chg.type === '+') {
                // These are added chars.
                result += green + chg.right + clear;
            } else {
                // These are changed chars.
                result += red + chg.left + clear;
                result += green + chg.right + clear;
            }
        }
        lineCount1++;
        lineCount2++;
    }
}

// Print text1, text2 and their respective line counts.
console.log(cyan + 'text1 (%s lines):' + clear, lineCount1);
console.log(text1);
console.log();

console.log(cyan + 'text2 (%s lines):' + clear, lineCount2);
console.log(text2);
console.log();

// Print the colorized diff.
console.log(cyan + 'Diff genereated by chardiff:' + clear);
console.log(result);
console.log();

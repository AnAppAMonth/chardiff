
var stringDiff = require('diff');

var types = ['-', '+'],
    props = ['left', 'right'];

/**
 * This function reformats the result returned by the `diff` library to make
 * it easier to use.
 *
 * @param {Array} diffArray - result returned by methods in the `diff` library.
 * @returns {Array} reformatted array.
 * @private
 */
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

// This function converts the result returned by the `diff` library to our own
// format.
function _convertResult(diffArray) {
    // First make it easier to deal with.
    diffArray = _reformatResult(diffArray);
    var result = [],
        obj;

    for (var i = 0; i < diffArray.length; i++) {
        var change = diffArray[i];
        if (change === null) { continue; }

        if (typeof change === 'string') {
            // Unchanged.
            result.push({
                type: '=',
                value: change
            });
        } else if (typeof change[0] === 'number') {
            // Added or removed.
            obj = {};
            obj.type = types[change[0]];
            obj[props[change[0]]] = change[1];
            result.push(obj);
        } else {
            // Changed.
            obj = {};
            obj.type = '*';
            obj[props[0]] = change[0];
            obj[props[1]] = change[1];
            result.push(obj);
        }
    }

    return result;
}

// Calculates the similarity score between two strings.
function _getScore(a, b) {
    // Remove the trailing line break if existed.
    if (a[a.length - 1] === '\n') {
        a = a.substring(0, a.length - 1);
    }
    if (b[b.length - 1] === '\n') {
        b = b.substring(0, b.length - 1);
    }

    // Handle special cases.
    if (a === '') {
        return b === '' ? 1 : 0;
    }

    var diffArray = stringDiff.diffChars(a, b),
        len1 = 0,
        len2 = 0,
        matched = 0,
        parts = 0,
        length, score;

    for (var i = 0; i < diffArray.length; i++) {
        length = diffArray[i].value.length;
        if (diffArray[i].added) {
            // Added.
            len2 += length;
        } else if (diffArray[i].removed) {
            // Removed.
            len1 += length;
        } else {
            // Unchanged.
            parts++;
            len1 += length;
            len2 += length;
            matched += length;
        }
    }

    // The score is basically the ratio in Python's difflib, but we try to penalize
    // fragmented matches, so that if two diffs have the same number of matched chars,
    // the one with fewer (and thus individually longer) matched blocks wins.
    if (parts > 1000) {
        parts = 1000;
    }
    // We use a `Number` object so that we can attach additional information to be
    // used by `_aboveThreshold()`.
    /* jshint -W053 */
    score = new Number(matched * 2 / (len1 + len2) * (1000 - parts) / 1000);
    score.matched = matched;
    score.len1 = len1;
    score.len2 = len2;
    return score;
}

// Determines whether a score is above the threshold.
function _aboveThreshold(score) {
    if (score >= 0.45) {
        return true;
    } else if (score >= 0.25 && score.matched / Math.min(score.len1, score.len2) >= 0.75) {
        return true;
    }
    return false;
}

// Try to match the first line in `lines[t]` with lines in `touched[t]`.
function _match(result, lines, touched, t) {
    var i, idx, obj,
        score = 0,
        maxScore = -1,
        indices = Object.keys(touched[t]);

    for (i = 0; i < indices.length; i++) {
        score = _getScore(lines[t][0], lines[1-t][indices[i]]);
        if (score > maxScore) {
            maxScore = score;
            idx = indices[i];
        }
    }
    if (maxScore > 0 && _aboveThreshold(maxScore)) {
        // Lines `lines[1-t][idx]` and `lines[t][0]` are matched, remove these
        // two lines and all lines preceding them.
        for (i = 0; i < idx; i++) {
            obj = {};
            obj.type = types[1-t];
            obj[props[1-t]] = lines[1-t].shift();
            result.push(obj);
        }
        obj = {};
        obj.type = '*';
        obj[props[0]] = lines[0].shift();
        obj[props[1]] = lines[1].shift();
        // Calculate char-level diffs.
        obj.diff = _convertResult(stringDiff.diffChars(obj[props[0]], obj[props[1]]));
        result.push(obj);
    } else {
        // No match found, remove `lines[t][0]`.
        obj = {};
        obj.type = types[t];
        obj[props[t]] = lines[t].shift();
        result.push(obj);
    }
}

function chardiff(a, b) {
    var i, j, k,
        t, obj, arr,
        result = [];

    // First diff the lines
    var lineChanges = _reformatResult(stringDiff.diffLines(a, b));

    for (i = 0; i < lineChanges.length; i++) {
        var lineChg = lineChanges[i];
        if (lineChg === null) { continue; }

        if (typeof lineChg === 'string') {
            // Unchanged. Split it into single line entries.
            arr = lineChg.match(/\n|.+\n?/g) || [''];
            for (j = 0; j < arr.length; j++) {
                result.push({
                    type: '=',
                    value: arr[j]
                });
            }
        } else if (typeof lineChg[0] === 'number') {
            // Added or removed.
            t = lineChg[0];
            obj = {};
            obj.type = types[t];
            obj[props[t]] = lineChg[1];
            result.push(obj);
        } else {
            // Changed, further comparison needed.
            //
            // The core of this algorithm is matching lines. Once lines are matched,
            // `stringDiff.diffChars()` is called on them to retrieve char-based
            // diffs between them.
            //
            // If the two operands contain M and N lines, respectively, and line
            // lengths are L, the naive method of matching lines has O(M*N*L)
            // complexity, and the result isn't necessarily good. We try to do
            // better.
            //
            // The reason why we write this library at all is because the `diff`
            // library's `diffLines()` method doesn't do char-level diffs, and
            // its `diffChars()` method doesn't respect line boundaries. However,
            // each block of text in the result of `diffLines()` is consisted of
            // one or more full lines, in other words, they always begin at line
            // boundaries. Therefore, `diffChars()` tends to be relatively good
            // at matching the first line of either operand. We utilize this fact
            // in the algorithm: basically we let `diffChars()` help us match the
            // first line, remove that line and its match (and any preceding lines),
            // and repeat this process.
            var textLeft = lineChg[0],
                textRight = lineChg[1],
                lines = [textLeft.match(/\n|.+\n?/g), textRight.match(/\n|.+\n?/g)],
                pos, matches, done;

            while(1) {
                // Each cycle of the loop is a round that may or may not find two
                // lines that match, but always remove at least a line from at least
                // one operand before proceeding to the next round. The loop ends when
                // at least one operand doesn't contain any more lines. The remaining
                // lines in the other operand, if any, are processed after the loop.
                var changes = _reformatResult(stringDiff.diffChars(textLeft, textRight)),
                    curLine = [0, 0],
                    touched = [{}, {}];

                for (j = 0; 1; j++) {
                    // Each cycle of the loop processes one change in `changes`, either
                    // a '=', a '+', a '-', or a '*'. If the first change is a '+' or a
                    // '-', and that change contains line breaks, these preceding lines
                    // are directly added to `result` without attempts to match. After
                    // that, or otherwise, the loop ends when we have found the first
                    // line break in both operands. We take the line break that appears
                    // "later" (in change count, not character count), and try to match
                    // that line (L) against all lines it "touched" in the other operand.
                    // By saying two lines "touched" each other we mean there is at least
                    // one sequence match found between them, or in other words, at least
                    // one '=' entry in `changes` involving them. If a match if found,
                    // we add these two matched lines and all preceding lines in either
                    // operand to `result`; otherwise, we only add line L to `result`.
                    // In either case, we end this round and if both operands are not
                    // empty, we proceed to the next round with the remaining lines.

                    var chg = changes[j];

                    if (chg === null) { continue; }

                    if (chg === undefined) {
                        // This simply causes the first line in one operand to be matched
                        // with lines in its touched list.
                        chg = '\n';
                    }

                    if (typeof chg === 'string') {
                        // Unchanged.
                        pos = chg.search(/\n/);
                        if (pos !== 0) {
                            // Here is the only place where touching happens.
                            touched[0][curLine[1]] = 1;
                            touched[1][curLine[0]] = 1;
                        }
                        if (pos >= 0) {
                            // Try to match the first line in `lines[t]` with lines in
                            // `touched[t]`.
                            t = curLine[0] <= curLine[1] ? 0 : 1;
                            _match(result, lines, touched, t);
                            break;
                        }
                    } else if (typeof chg[0] === 'number') {
                        // Added or removed.
                        if (j === 0) {
                            matches = chg[1].match(/\n/g);
                            if (matches) {
                                for (k = 0; k < matches.length; k++) {
                                    t = chg[0];
                                    obj = {};
                                    obj.type = types[t];
                                    obj[props[t]] = lines[t].shift();
                                    result.push(obj);
                                }
                            }
                        } else {
                            // Search for the first line break in chg[1].
                            matches = chg[1].match(/\n/g);
                            if (matches) {
                                // See if the other side has already seen a line break.
                                t = chg[0];
                                if (curLine[1-t] > 0) {
                                    // Try to match the first line in `lines[t]` with
                                    // lines in `touched[t]`.
                                    _match(result, lines, touched, t);
                                    break;
                                } else {
                                    curLine[t] += matches.length;
                                }
                            }
                        }
                    } else {
                        // Changed.
                        // Search for the first line break in both chg[0] and chg[1].
                        // Obviously at most one of them can contain line break(s).
                        done = false;
                        for (t = 0; t <= 1; t++) {
                            matches = chg[t].match(/\n/g);
                            if (matches) {
                                // See if the other side has already seen a line break.
                                if (curLine[1-t] > 0) {
                                    // Try to match the first line in `lines[t]` with
                                    // lines in `touched[t]`.
                                    _match(result, lines, touched, t);
                                    done = true;
                                } else {
                                    curLine[t] += matches.length;
                                }
                                break;
                            }
                        }
                        if (done) {
                            break;
                        }
                    }
                }

                // This round is done, see if we need to do the next round.
                if (lines[0].length > 0 && lines[1].length > 0) {
                    textLeft = lines[0].join('');
                    textRight = lines[1].join('');
                } else {
                    break;
                }
            }

            // Process the remaining lines
            for (t = 0; t <= 1; t++) {
                for (j = 0; j < lines[t].length; j++) {
                    obj = {};
                    obj.type = types[t];
                    obj[props[t]] = lines[t][j];
                    result.push(obj);
                }
            }
        }
    }

    return result;
}

module.exports = chardiff;

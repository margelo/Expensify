const enEmojis = {};

const CHAR_CODE_A = 'a'.charCodeAt(0);
const ALPHABET_SIZE = 28;
const DELIMITER_CHAR_CODE = ALPHABET_SIZE - 2;

// TODO:
// make makeTree faster
// how to deal with unicode characters such as spanish ones?
// i think we need to support numbers as well

/**
 * Converts a string to an array of numbers representing the characters of the string.
 * The numbers are offset by the character code of 'a' (97).
 * - This is so that the numbers from a-z are in the range 0-25.
 * - 26 is for the delimiter character "{",
 * - 27 is for the end character "|".
 */
function stringToArray(input: string) {
    const res: number[] = [];
    for (let i = 0; i < input.length; i++) {
        const charCode = input.charCodeAt(i) - CHAR_CODE_A;
        if (charCode >= 0 && charCode < ALPHABET_SIZE) {
            res.push(charCode);
        }
    }
    return res;
}

const aToZRegex = /[^a-z]/gi;
// The character that separates the different options in the search string
const delimiterChar = '{';

type PrepareDataParams<T> = {
    data: T[];
    transform: (data: T) => string;
};

function prepareData<T>({data, transform}: PrepareDataParams<T>): [string, Array<T | undefined>] {
    const searchIndexList: Array<T | undefined> = [];
    const str = data
        .map((option) => {
            let searchStringForTree = transform(option);
            // Remove all none a-z chars:
            searchStringForTree = searchStringForTree.toLowerCase().replace(aToZRegex, '');

            if (searchStringForTree.length > 0) {
                // We need to push an array that has the same length as the length of the string we insert for this option:
                const indexes = Array.from({length: searchStringForTree.length}, () => option);
                // Note: we add undefined for the delimiter character
                searchIndexList.push(...indexes, undefined);
            } else {
                return undefined;
            }

            return searchStringForTree;
        })
        // slightly faster alternative to `.filter(Boolean).join(delimiterChar)`
        .reduce((acc: string, curr) => {
            if (!curr) {
                return acc;
            }

            if (acc === '') {
                return curr;
            }

            return `${acc}${delimiterChar}${curr}`;
        }, '');

    return [str, searchIndexList];
}

/**
 * Makes a tree from an input string
 * **Important:** As we only support an alphabet of 26 characters, the input string should only contain characters from a-z.
 * Thus, all input data must be cleaned before being passed to this function.
 * If you then use this tree for search you should clean your search input as well (so that a search query of "testuser@myEmail.com" becomes "testusermyemailcom").
 */
function makeTree<T>(compose: Array<PrepareDataParams<T>>) {
    const start1 = performance.now();
    const strings = [];
    const indexes: Array<Array<T | undefined>> = [];

    for (const {data, transform} of compose) {
        const [str, searchIndexList] = prepareData({data, transform});
        strings.push(str);
        indexes.push(searchIndexList);
    }

    console.log({strings, indexes});

    const stringToSearch = `${strings.join('')}|`; // End Character
    console.log('building search strings', performance.now() - start1);

    const a = stringToArray(stringToSearch);
    const N = 1000000; // TODO: i reduced this number from 1_000_000 down to this, for faster performance - however its possible that it needs to be bigger for larger search strings
    const start = performance.now();
    const t = Array.from({length: N}, () => Array(ALPHABET_SIZE).fill(-1) as number[]);
    const l = Array(N).fill(0) as number[];
    const r = Array(N).fill(0) as number[];
    const p = Array(N).fill(0) as number[];
    const s = Array(N).fill(0) as number[];
    const end = performance.now();
    console.log('Allocating memory took:', end - start, 'ms');

    let tv = 0;
    let tp = 0;
    let ts = 2;
    let la = 0;

    function initializeTree() {
        r.fill(a.length - 1);
        s[0] = 1;
        l[0] = -1;
        r[0] = -1;
        l[1] = -1;
        r[1] = -1;
        t[1].fill(0);
    }

    function processCharacter(c: number) {
        while (true) {
            if (r[tv] < tp) {
                if (t[tv][c] === -1) {
                    createNewLeaf(c);
                    continue;
                }
                tv = t[tv][c];
                tp = l[tv];
            }
            if (tp === -1 || c === a[tp]) {
                tp++;
            } else {
                splitEdge(c);
                continue;
            }
            break;
        }
        if (c === DELIMITER_CHAR_CODE) {
            resetTreeTraversal();
        }
    }

    function createNewLeaf(c: number) {
        t[tv][c] = ts;
        l[ts] = la;
        p[ts++] = tv;
        tv = s[tv];
        tp = r[tv] + 1;
    }

    function splitEdge(c: number) {
        l[ts] = l[tv];
        r[ts] = tp - 1;
        p[ts] = p[tv];
        t[ts][a[tp]] = tv;
        t[ts][c] = ts + 1;
        l[ts + 1] = la;
        p[ts + 1] = ts;
        l[tv] = tp;
        p[tv] = ts;
        t[p[ts]][a[l[ts]]] = ts;
        ts += 2;
        handleDescent(ts);
    }

    function handleDescent(ts: number) {
        tv = s[p[ts - 2]];
        tp = l[ts - 2];
        while (tp <= r[ts - 2]) {
            tv = t[tv][a[tp]];
            tp += r[tv] - l[tv] + 1;
        }
        if (tp === r[ts - 2] + 1) {
            s[ts - 2] = tv;
        } else {
            s[ts - 2] = ts;
        }
        tp = r[tv] - (tp - r[ts - 2]) + 2;
    }

    function resetTreeTraversal() {
        tv = 0;
        tp = 0;
    }

    function build() {
        initializeTree();
        for (la = 0; la < a.length; ++la) {
            const c = a[la];
            processCharacter(c);
        }
    }

    /**
     * Returns all occurrences of the given (sub)string in the input string.
     *
     * You can think of the tree that we create as a big string that looks like this:
     *
     * "banana{pancake{apple|"
     * The delimiter character '{' is used to separate the different strings.
     * The end character '|' is used to indicate the end of our search string.
     *
     * This function will return the index(es) of found occurrences within this big string.
     * So, when searching for "an", it would return [1, 4, 11].
     */
    function findSubstring(searchString: string) {
        const occurrences: number[] = [];

        function dfs(node: number, depth: number) {
            const leftRange = l[node];
            const rightRange = r[node];
            const rangeLen = node === 0 ? 0 : rightRange - leftRange + 1;

            for (let i = 0; i < rangeLen && depth + i < searchString.length; i++) {
                if (searchString.charCodeAt(depth + i) - CHAR_CODE_A !== a[leftRange + i]) {
                    return;
                }
            }

            let isLeaf = true;
            for (let i = 0; i < ALPHABET_SIZE; ++i) {
                if (t[node][i] !== -1) {
                    isLeaf = false;
                    dfs(t[node][i], depth + rangeLen);
                }
            }

            if (isLeaf && depth >= searchString.length) {
                occurrences.push(a.length - (depth + rangeLen));
            }
        }

        dfs(0, 0);
        return occurrences;
    }

    function findInSearchTree(searchInput: string) {
        const now = performance.now();
        const result = findSubstring(searchInput);
        console.log('FindSubstring index result for searchInput', searchInput, result);
        // Map the results to the original options

        const mappedResults: T[][] = Array.from({length: compose.length}, () => []);
        console.log({result});
        result.forEach((index) => {
            // const textInSearchString = searchString.substring(index, searchString.indexOf(delimiterChar, index));
            // console.log('textInSearchString', textInSearchString);

            // TODO: check with Hanno whether we restore the data correctly
            let offset = 0;
            for (let i = 0; i < indexes.length; i++) {
                const relativeIndex = index - offset + 1;
                if (relativeIndex < indexes[i].length && relativeIndex >= 0) {
                    const option = indexes[i][relativeIndex];
                    if (option) {
                        mappedResults[i].push(option);
                    }
                } else {
                    offset += indexes[i].length;
                }
            }
        });

        console.log('search', performance.now() - now);
        return mappedResults;
    }

    return {
        build,
        findSubstring,
        findInSearchTree,
    };
}

function performanceProfile<T>(input: PrepareDataParams<T>, search = 'sasha') {
    // TODO: For emojis we could precalculate the makeTree function during build time using a babel plugin
    // maybe babel plugin that just precalculates the result of function execution (so that it can be generic purpose plugin)
    const {build, findSubstring} = makeTree([input]);

    const buildStart = performance.now();
    build();
    const buildEnd = performance.now();
    console.log('Building time:', buildEnd - buildStart, 'ms');

    const searchStart = performance.now();
    const results = findSubstring(search);
    const searchEnd = performance.now();
    console.log('Search time:', searchEnd - searchStart, 'ms');
    console.log(results);

    return {
        buildTime: buildEnd - buildStart,
        recursiveSearchTime: searchEnd - searchStart,
    };
}

// Demo function testing the performance for emojis
/*function testEmojis() {
    const data = Object.values(enEmojis);
    return performanceProfile(
        {
            data,
            transform: ({keywords}) => {
                return `${keywords.join('')}{`;
            },
        },
        'smile',
    );
}*/

export {makeTree, prepareData};

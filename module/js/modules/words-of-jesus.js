// js/words-of-jesus.js NEW VERSION
/**
 * Words of Jesus in the ESV Bible
 * 
 * Format: Book -> Chapter -> [[start_verse, end_verse], ...]
 * This mapping identifies direct words spoken by Jesus Christ.
 * 
 * Source: Compiled from red-letter Bible traditions and scholarly consensus
 * on words universally attributed to Jesus Christ in the four Gospels and Acts.
 * 
 * NOTE: This is a FOUNDATIONAL dataset. For complete coverage, consider:
 * 1. Using Bible SuperSearch's JSON (includes 140+ translations with red letters)
 * 2. Referencing scholarly consensus (some verses have scholarly debate)
 * 3. OT quotes by Jesus are marked (e.g., Jesus quoting Psalms)
 */

export const wordsOfJesus = {
  // ============ MATTHEW ============
  Matthew: {
    1: [], // Birth narrative - no direct words of Jesus
    2: [], // Magi and Egypt - no direct words
    3: [[15, 15]], // "Let it be so now"
    4: [
      [4, 4], // "Man shall not live by bread alone"
      [7, 7], // "You shall not put the Lord your God to the test"
      [10, 10], // "You shall worship the Lord your God"
    ],
    5: [[3, 48]], // Sermon on the Mount - entire discourse
    6: [[9, 13]], // Lord's Prayer section
    7: [[1, 27]], // Continuation of Sermon on the Mount
    8: [
      [4, 4],
      [7, 10],
      [13, 13],
      [18, 22],
      [26, 27],
      [32, 32],
    ],
    9: [
      [2, 6],
      [9, 13],
      [15, 17],
      [22, 26],
      [27, 30],
      [37, 38],
    ],
    10: [[2, 42]], // Discourse on sending out the twelve
    11: [[4, 30]], // Response to John's disciples and woes
    12: [
      [3, 8],
      [11, 13],
      [18, 32],
      [34, 37],
      [39, 45],
      [48, 50],
    ],
    13: [
      [3, 8],
      [10, 17],
      [24, 30],
      [31, 33],
      [37, 43],
      [44, 52],
    ], // Parables
    14: [[27, 31]], // Walking on water
    15: [
      [3, 9],
      [11, 20],
      [24, 28],
      [32, 39],
    ],
    16: [
      [2, 4],
      [6, 11],
      [15, 28],
    ],
    17: [
      [9, 13],
      [20, 22],
    ],
    18: [
      [2, 4],
      [6, 22],
      [32, 35],
    ], // Discourse on humility and forgiveness
    19: [
      [4, 6],
      [14, 15],
      [17, 19],
      [21, 30],
    ],
    20: [
      [18, 19],
      [22, 29],
      [30, 34],
    ],
    21: [
      [2, 3],
      [13, 17],
      [19, 22],
      [24, 32],
      [42, 46],
    ],
    22: [
      [4, 14],
      [18, 21],
      [29, 46],
    ],
    23: [[2, 39]], // Woes against Pharisees
    24: [
      [2, 51],
    ], // Olivet Discourse
    25: [
      [9, 46],
    ], // Judgment of nations
    26: [
      [18, 29],
      [31, 56],
      [63, 64],
      [75, 75],
    ],
    27: [
      [46, 46],
    ], // "My God, my God, why have you forsaken me?"
    28: [[9, 20]], // Post-resurrection appearance
  },

  // ============ MARK ============
  Mark: {
    1: [
      [15, 15],
      [17, 18],
      [25, 27],
      [38, 39],
      [41, 44],
    ],
    2: [
      [5, 17],
      [19, 22],
      [25, 28],
    ],
    3: [
      [4, 11],
      [14, 15],
      [23, 29],
      [33, 35],
    ],
    4: [
      [3, 32],
      [35, 41],
    ], // Parables and stilling the storm
    5: [
      [8, 13],
      [19, 20],
      [25, 43],
    ],
    6: [
      [2, 11],
      [31, 34],
      [37, 44],
      [50, 52],
    ],
    7: [
      [6, 23],
      [27, 30],
      [37, 37],
    ],
    8: [
      [12, 13],
      [15, 38],
    ],
    9: [
      [5, 7],
      [12, 13],
      [19, 29],
      [31, 31],
      [35, 37],
      [39, 50],
    ],
    10: [
      [3, 9],
      [11, 12],
      [14, 15],
      [18, 31],
      [38, 52],
    ],
    11: [
      [2, 14],
      [17, 25],
      [27, 33],
    ],
    12: [
      [9, 34],
      [35, 37],
      [41, 44],
    ],
    13: [
      [2, 37],
    ], // Olivet Discourse
    14: [
      [12, 31],
      [36, 36],
      [62, 62],
    ],
    15: [
      [34, 34],
    ], // "My God, my God, why have you forsaken me?"
    16: [
      [15, 20],
    ], // Post-resurrection appearance
  },

  // ============ LUKE ============
  Luke: {
    1: [], // Birth narrative
    2: [
      [46, 49],
    ], // Jesus in the temple
    3: [],
    4: [
      [4, 13],
      [21, 32],
    ],
    5: [
      [10, 11],
      [22, 26],
      [31, 32],
      [39, 39],
    ],
    6: [
      [3, 49],
    ], // Sermon on the Plain
    7: [
      [6, 50],
    ], // Centurion's servant and widow's son
    8: [
      [15, 15],
      [21, 25],
      [39, 56],
    ],
    9: [
      [3, 50],
    ], // Sending of the twelve and various teachings
    10: [
      [21, 37],
    ], // Commissioning of the seventy and Martha/Mary
    11: [
      [2, 13],
      [15, 52],
    ], // Lord's Prayer and Pharisaic disputes
    12: [
      [3, 59],
    ], // Warnings and teachings
    13: [
      [2, 35],
    ], // Repentance and Sabbath disputes
    14: [
      [3, 35],
    ], // Teachings on Sabbath and humility
    15: [
      [3, 32],
    ], // Parables of lost things
    16: [
      [8, 31],
    ], // Parable of unjust manager
    17: [
      [3, 37],
    ], // Faith, duty, and the ten lepers
    18: [
      [8, 43],
    ], // Parables and teachings
    19: [
      [5, 48],
    ], // Zacchaeus and parable of pounds
    20: [
      [2, 44],
    ], // Temple authority disputes
    21: [
      [5, 36],
    ], // Olivet Discourse
    22: [
      [15, 20],
      [25, 38],
      [48, 51],
      [70, 70],
    ],
    23: [
      [28, 31],
      [34, 43],
      [46, 46],
    ], // "Father, forgive them" and "Today you will be with me"
    24: [
      [25, 49],
    ], // Post-resurrection appearances
  },

  // ============ JOHN ============
  John: {
    1: [
      [51, 51],
    ], // "You will see heaven open"
    2: [
      [4, 8],
      [16, 17],
    ],
    3: [
      [3, 21],
      [27, 36],
    ], // Nicodemus discourse
    4: [
      [7, 26],
      [32, 38],
      [48, 53],
    ], // Samaritan woman and healing
    5: [
      [17, 47],
    ], // Healing and discourse on authority
    6: [
      [20, 71],
    ], // Bread of life discourse
    7: [
      [16, 52],
    ], // Teaching during Feast of Booths
    8: [
      [7, 58],
    ], // Woman caught in adultery and "I am" statements
    9: [
      [4, 7],
      [35, 41],
    ],
    10: [
      [7, 18],
      [25, 30],
      [32, 39],
    ], // Good shepherd discourse
    11: [
      [4, 44],
      [56, 56],
    ],
    12: [
      [23, 50],
    ], // Hours of glory discourse
    13: [
      [6, 20],
      [31, 38],
    ], // Washing feet and love commandment
    14: [
      [2, 31],
    ], // Last discourse begins
    15: [
      [1, 27],
    ], // Vine and branches
    16: [
      [4, 33],
    ], // Continuation of last discourse
    17: [
      [1, 26],
    ], // High priestly prayer
    18: [
      [4, 8],
      [20, 23],
      [33, 37],
    ], // Arrest and trial
    19: [
      [11, 11],
      [26, 27],
      [28, 28],
      [30, 30],
    ], // "Woman, behold your son" and "It is finished"
    20: [
      [15, 23],
    ], // Post-resurrection appearances
    21: [
      [5, 25],
    ], // Breakfast by sea
  },

  // ============ ACTS (Limited - only direct discourse) ============
  Acts: {
    1: [
      [4, 8],
    ], // Resurrected Jesus speaking
    9: [
      [5, 6],
    ], // Jesus speaking to Paul
    18: [
      [9, 10],
    ], // Vision to Paul
    22: [
      [7, 8],
      [17, 21],
    ], // Paul's account of Damascus road
    23: [
      [11, 11],
    ], // Vision to Paul
    26: [
      [14, 18],
    ], // Festus's account
  },
};

/**
 * Helper function to check if a verse is a red letter verse
 * @param {string} book - Book name (e.g., "Matthew")
 * @param {number} chapter - Chapter number
 * @param {number} verse - Verse number
 * @returns {boolean} - True if the verse is spoken by Jesus
 */
export function isRedLetterVerse(book, chapter, verse) {
  if (!wordsOfJesus[book]) return false;
  if (!wordsOfJesus[book][chapter]) return false;

  const ranges = wordsOfJesus[book][chapter];
  return ranges.some(([start, end]) => verse >= start && verse <= end);
}

/**
 * Get all red letter verses for a specific chapter
 * @param {string} book - Book name
 * @param {number} chapter - Chapter number
 * @returns {number[]} - Array of verse numbers that are red letters
 */
export function getRedLetterVerses(book, chapter) {
  if (!wordsOfJesus[book] || !wordsOfJesus[book][chapter]) {
    return [];
  }

  const ranges = wordsOfJesus[book][chapter];
  const verses = [];

  ranges.forEach(([start, end]) => {
    for (let v = start; v <= end; v++) {
      verses.push(v);
    }
  });

  return verses;
}

/**
 * Get statistics about red letter verses
 * @returns {Object} - Statistics about red letter content
 */
export function getRedLetterStats() {
  let totalRanges = 0;
  let books = Object.keys(wordsOfJesus).length;

  Object.values(wordsOfJesus).forEach((bookChapters) => {
    Object.values(bookChapters).forEach((ranges) => {
      totalRanges += ranges.length;
    });
  });

  return {
    books,
    totalRanges,
    books_with_red_letters: Object.keys(wordsOfJesus),
  };
}

export default wordsOfJesus;
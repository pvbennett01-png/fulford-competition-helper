// ------------------------------------------------------------
// GLOBAL APPLICATION STATE
// ------------------------------------------------------------

window.State = {

  rawStableford: [],
  rawStablefordAll: [],
  rawMedal: [],
  rawMedalAll: [],
  rawMedalSingle: [],
  rawMedalSingleAll: [],
  rawTwosStableford: [],
  rawTwosMedal: [],

  // Two's prize funds (user-entered in Configure)
  twosStablefordFund: 0,
  twosMedalFund: 0,

  players: [],

  divisions: {
    div1: [],
    div2: [],
    div3: [],
    stableford: []
  },

  // Prize limits (user-editable in Configure)
  maxPrize: 30,
  minPrize: 7,

  prizeData: {
    div1: [],
    div2: [],
    div3: [],
    stableford: []
  },

  lockedRows: {
    div1: new Set(),
    div2: new Set(),
    div3: new Set(),
    stableford: new Set()
  },

  tieMethod: {
    div1: "B",
    div2: "B",
    div3: "B",
    stableford: "B"
  },

  boundaries: {
    d1min: -5,
    d1max: 8,
    d2min: 9,
    d2max: 14,
    d3min: 15,
    d3max: 54
  },

  entryFee: 4.00,
  retention: true,
  compName: "",
  compDate: "",
  manualNotes: "",

  results: {
    div1: [],
    div2: [],
    div3: [],
    stableford: []
  },

  prizeMode: {
    div1:       "auto",
    div2:       "auto",
    div3:       "auto",
    stableford: "auto"
  },

  medalDivisions: 3
};

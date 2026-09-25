/* SpotSafe 360 - configuration and wording. Data, not code.
   Positions are metres on the floor plane: x east positive, z south positive,
   origin at the room centre. Eye height 1.6.
   Each item carries a brief line (the fast teaching card) and the full
   what/why/control sentences behind the card's expand chevron.
   Run game.html with ?debug=1 for collider rings and the console table. */

const SCENE = {
  name: "Goods-in bay, constructed 3D"
};

const CONFIG = {
  scorePerHazard: 10,
  cardDismissSec: 8,
  beepEverySec: 6,
  /* Quick-check quiz: how many questions are drawn from the QUIZ pool at the
     end of a round, and what each correct answer is worth. Set quizCount to 0
     to skip the quiz entirely and go straight to the review. */
  quizCount: 3,
  quizPerCorrect: 5,
  difficulties: {
    simple:   { label: "Simple",   hintAfterSec: 15, attackSec: 120, penalty: 5 },
    standard: { label: "Standard", hintAfterSec: 20, attackSec: 90,  penalty: 5 },
    expert:   { label: "Expert",   hintAfterSec: 0,  attackSec: 60,  penalty: 8 }
  },
  bounds: { minX: -17, maxX: 17, minZ: -10.5, maxZ: 11 },
  eyeHeight: 1.6,
  /* List mode navigation: how far off the spot the camera stops, how long the
     walk takes, and how long the blue locator box and its banner stay up. */
  locate: { standoffM: 3.4, glideMs: 700, holdSec: 6 },
  colliders: [
    { what: "rack bay north",          x: -16,   z: -6,    r: 2.0 },
    { what: "rack bay middle",         x: -16,   z: 1,     r: 2.0 },
    { what: "rack bay south",          x: -16,   z: 8,     r: 2.0 },
    { what: "trailer at dock 6",       x: 6,     z: -8.4,  r: 1.8 },
    { what: "pallet stack west",       x: -6,    z: 2,     r: 1.1 },
    { what: "pallet stack north-west", x: -8,    z: -3,    r: 1.2 },
    { what: "pallet stack south-east", x: 8,     z: 8,     r: 1.1 },
    { what: "charging point",          x: -4,    z: 11,    r: 1.0 },
    { what: "mezzanine columns",       x: -6,    z: 10.4,  r: 1.6 },
    { what: "H1 stillages at fire exit", x: 16.2,   z: 2,    r: 1.3 },
    { what: "H3 forklift at blind corner", x: -13.5, z: -8.5, r: 1.7 },
    { what: "H6 damaged rack upright",   x: -15.4,  z: 3.3,  r: 1.0 },
    { what: "H7 boxes at extinguisher",  x: 16.8,   z: -2.5, r: 0.9 },
    { what: "H9 pallet stack, centre",   x: 2,      z: 4,    r: 1.5 }
  ]
};

const HAZARDS = [
  {
    id: "H1", name: "Blocked fire exit", category: "Fire and Emergency", difficulty: "Obvious",
    pos: { x: 16.2, z: 2 }, radius: 1.4,
    brief: {
      what: "Stillages block the fire exit door.",
      why: "Blocked exits trap people in a fire.",
      control: "Keep exits clear; store in marked bays."
    },
    what: "Stillages and a pallet are stacked straight in front of the fire exit door.",
    why: "A blocked exit turns a small fire into a trapped crowd; escape routes must be kept clear at all times.",
    control: "Keep exits and extinguishers clear at all times; housekeeping rounds; store stock in marked bays only.",
    hint: "East wall, the red door: look at what is stacked in front of it."
  },
  {
    id: "H2", name: "Pedestrian in the vehicle lane", category: "Vehicle and Pedestrian", difficulty: "Obvious",
    /* Clear of the barrier line. The posts stand at x 12.6 every 2 m from
       z -6, and at 13.8/-2 he lined up exactly behind one, so the post cut
       through his legs and he read as part of the railing rather than as a
       person on the wrong side of it. */
    pos: { x: 14.4, z: -3.1 }, radius: 0.9,
    brief: {
      what: "Dark-clothed walker inside the vehicle route.",
      why: "People and forklifts never share space.",
      control: "Use the barriered walkway; wear hi-vis."
    },
    what: "A worker in dark clothes, no hi-vis, is walking outside the barriered walkway, in the vehicle route.",
    why: "People and forklifts sharing space is one of the highest-risk situations in a warehouse; dark clothing removes the last warning.",
    control: "Use segregated pedestrian routes; barriers maintained; hi-vis mandatory in operational areas.",
    hint: "Near the dock doors, outside the yellow barrier: a person in dark clothes where vehicles move."
  },
  {
    id: "H3", name: "Forklift at the blind corner", category: "Vehicle and Pedestrian", difficulty: "Subtle, sound clue",
    pos: { x: -13.5, z: -8.5 }, radius: 1.8, soundClue: true,
    brief: {
      what: "Forklift reversing at the blind corner.",
      why: "At blind corners the ear warns first.",
      control: "Mirrors; keep people clear; horn at corners."
    },
    what: "A forklift is reversing out of the blind corner at the end of the racking, where anyone walking past cannot see it.",
    why: "At a blind corner neither the driver nor a pedestrian can see the other; the reversing alarm is often the only warning.",
    control: "Keep pedestrians out of reversing areas; convex mirrors at blind spots; horn at corners and doorways; site speed limit.",
    hint: "Follow the reversing beep to the north-west corner, where the racking ends."
  },
  {
    id: "H4", name: "Chemical spill on the floor", category: "Housekeeping", difficulty: "Obvious",
    pos: { x: 9, z: -7.5 }, radius: 1.5,
    brief: {
      what: "Tipped drum, spill spreading.",
      why: "Wet floors slip; chemicals burn.",
      control: "Cordon, check the label, spill kit."
    },
    what: "A drum has tipped over and a chemical spill is spreading across the open floor.",
    why: "Slips and trips are among the most common warehouse injuries, and an unidentified chemical adds burn and fume risk.",
    control: "Cordon the area, identify the substance from its label and safety data sheet, wear the PPE it specifies, use the spill kit and report it; store drums upright and bunded.",
    hint: "Open floor east of the racking: a dark puddle and a drum on its side."
  },
  {
    id: "H5", name: "Charging lead across the walkway", category: "Housekeeping", difficulty: "Subtle",
    pos: { x: 11.3, z: -4 }, radius: 1.1,
    brief: {
      what: "Cable stretched across the route.",
      why: "Ankle-height leads catch heels.",
      control: "Route leads overhead or covered."
    },
    what: "A charging lead is stretched across the pedestrian walkway at ankle height.",
    why: "A cable across a busy route trips pedestrians and trolleys, and a damaged lead adds shock risk.",
    control: "Charge away from routes; use cable covers or overhead routing; inspect leads.",
    hint: "The painted pedestrian lane near the docks: something thin and dark lying across it."
  },
  {
    id: "H6", name: "Forklift-damaged rack upright", category: "Stacking and Racking", difficulty: "Subtle",
    pos: { x: -15.4, z: 3.3 }, radius: 1.2,
    brief: {
      what: "Bent upright, dropped pallet.",
      why: "Damaged racks collapse loaded.",
      control: "Isolate, offload, engineer check."
    },
    what: "A rack upright is bent from a forklift impact, and a pallet lies dropped beside it.",
    why: "An upright weakened by impact can fail without warning under load; rack collapse is fatal.",
    control: "Report damage, offload and isolate the bay, and have a competent rack inspector classify it (BS EN 15635) before reuse; fit upright protectors.",
    hint: "East end of the middle rack bay: an upright that is not vertical, and stock on the floor."
  },
  {
    id: "H7", name: "Blocked fire extinguisher", category: "Fire and Emergency", difficulty: "Partially obscured",
    pos: { x: 16.8, z: -2.5 }, radius: 1.0,
    brief: {
      what: "Boxes hide the extinguisher.",
      why: "Lost seconds feed fires.",
      control: "Extinguishers visible and clear."
    },
    what: "Stacked boxes hide the fire extinguisher on the east wall; only part of it shows.",
    why: "A fire grows in seconds; hunting for a hidden extinguisher turns a small fire into a big one.",
    control: "Keep extinguishers visible, marked and unobstructed; housekeeping rounds.",
    hint: "East wall, north of the red fire door: something red peeking from behind stacked boxes."
  },
  {
    id: "H8", name: "Worker at the unguarded edge", category: "Working at Height", difficulty: "Obvious",
    pos: { x: -8.6, z: 9.2 }, radius: 1.2, aimY: 3.9,
    brief: {
      what: "No rails; worker at platform edge.",
      why: "A four-metre fall can kill.",
      control: "Guard rails and edge protection."
    },
    what: "A worker stands at the edge of the mezzanine platform with no guard rails, and a pallet sits near the edge.",
    why: "Falls from height kill; an unguarded edge plus a load that can be knocked off is two hazards stacked.",
    control: "Fixed guard rails and toe boards; edge protection; never stack stock at an unguarded edge.",
    hint: "Look up at the steel platform in the south-west: a person at its edge, with nothing to hold."
  },
  {
    id: "H9", name: "Worker standing on pallets", category: "Working at Height", difficulty: "Obvious",
    pos: { x: 2, z: 4 }, radius: 1.5, aimY: 2.6,
    brief: {
      what: "Worker standing on a pallet stack.",
      why: "Pallets are not work platforms.",
      control: "Use steps or an order picker."
    },
    what: "A worker is standing on top of a pallet stack to reach a high load, with no steps or order picker.",
    why: "Pallets are not work platforms; a fall from rack height is life changing, and climbing stock damages it.",
    control: "Use steps or order pickers; never climb racking or stand on pallets; report missing equipment.",
    hint: "Centre of the bay: someone is standing on top of the pallet stack, above eye line."
  }
];

const DISTRACTORS = [
  {
    id: "D1", name: "Worker on the correct route", category: "Good practice",
    pos: { x: 11, z: 6 }, radius: 0.9,
    brief: {
      what: "Hi-vis worker on the correct route.",
      why: "This is what safe looks like.",
      control: "Keep routes segregated and PPE correct."
    },
    what: "A worker in full hi-vis walking inside the barriered pedestrian walkway, exactly as the site requires.",
    why: "This is what safe looks like. It is not a hazard, so spotting it scores nothing and the penalty applies.",
    control: "Segregated routes and correct PPE, exactly as shown here, are the standard to keep.",
    hint: "Inside the yellow barrier, south end: a hi-vis worker walking the correct route."
  }
];

/* Phase 5: list mode. The bay described in words for keyboard and
   screen-reader users. Each entry gives the position and what is perceived
   there, without naming the hazard, so flagging stays a judgement call.
   The list navigates, it does not score: choosing a place walks the camera
   there and turns it to face the spot, and the call is then made in the bay
   with a click or the E key. */
const LISTINGS = {
  H1: { place: "East wall, middle of the bay",
        sense: "Metal pallet frames are parked in front of a door." },
  H2: { place: "North-east, just past the yellow walkway lines",
        sense: "A worker in dark clothes, no hi-vis, stepping into the vehicle lane." },
  H3: { place: "Far north-west corner, behind the racks",
        sense: "You hear a beeping reverse alarm. A forklift works where you cannot see it." },
  H4: { place: "North side, on the floor near the parked trailer",
        sense: "A dark puddle spreads beside a tipped-over drum." },
  H5: { place: "On the painted walkway, mid east side",
        sense: "A charging cable lies across the path people walk." },
  H6: { place: "West wall, at the middle rack bay",
        sense: "One orange upright leans and its base plate is bent." },
  H7: { place: "East wall, north of the exit door",
        sense: "Cardboard boxes are stacked against a red wall unit." },
  H8: { place: "South-west, on top of the raised platform",
        sense: "Someone stands at an open edge about four metres up. There are no rails." },
  H9: { place: "Centre of the bay",
        sense: "Someone stands on top of a three-high pallet stack." },
  D1: { place: "Inside the yellow walkway lane, south side",
        sense: "A worker in full hi-vis and hard hat walks the correct route." }
};

/* Quick-check quiz. CONFIG.quizCount questions are drawn at random from this
   pool at the end of a round, options shuffled, so a replay is never the same
   paper. The first option written here is the correct one: app.js records it
   before it shuffles, so answers can never drift out of step with the text.
   Each entry names the hazard it teaches, so the quiz and the bay stay in
   step when either is edited. */
const QUIZ = [
  {
    id: "Q1", ref: "H1",
    ask: "Stillages are stacked in front of the fire exit. What is the real cost of leaving them there?",
    options: [
      "In a fire, people cannot get out of the building.",
      "The stillages block the view of the yard.",
      "The door closer wears out faster."
    ],
    because: "Exit routes stay clear at all times. A blocked exit turns a small fire into a trapped crowd."
  },
  {
    id: "Q2", ref: "H2",
    ask: "A worker in dark clothes is walking in the vehicle lane. Why is this so dangerous?",
    options: [
      "A forklift driver may never see them in time to stop.",
      "They will walk further than by using the marked route.",
      "Dark clothing shows dust and dirt more easily."
    ],
    because: "People and forklifts never share space. Hi-vis and segregated walkways exist because a strike can be fatal."
  },
  {
    id: "Q3", ref: "H3",
    ask: "You hear a reversing alarm but you cannot see a forklift. What should that tell you?",
    options: [
      "A vehicle is working out of sight, so slow down and look before rounding the corner.",
      "The alarm is faulty and should be reported to maintenance.",
      "The forklift has finished and is parking up."
    ],
    because: "At blind corners the ear warns before the eye can. Mirrors, horns and keeping people out of reversing areas exist for exactly this moment."
  },
  {
    id: "Q4", ref: "H4",
    ask: "A drum has tipped and a chemical spill is spreading. What comes first?",
    options: [
      "Cordon the area so nobody walks into it, check what the substance is, then use the spill kit and report it.",
      "Fetch a mop and spread the spill thin so it dries faster.",
      "Leave it and warn people as they pass."
    ],
    because: "Slips and trips are among the most common warehouse injuries, and an unidentified chemical adds burn and fume risk. Cordon, identify, contain, report."
  },
  {
    id: "Q5", ref: "H5",
    ask: "A charging lead runs across the pedestrian walkway at ankle height. Which control actually fixes it?",
    options: [
      "Charge away from the route, and cover the lead or route it overhead.",
      "Put a warning cone beside the lead.",
      "Ask people to step over it carefully."
    ],
    because: "A control that removes the hazard beats one that relies on people noticing it. Signs and care are the weakest controls there are."
  },
  {
    id: "Q6", ref: "H6",
    ask: "A rack upright is bent from a forklift impact. What must happen to that bay?",
    options: [
      "Offload and isolate it, then have an engineer inspect it before it is used again.",
      "Keep using it, but load the lower beams only.",
      "Straighten the upright and carry on."
    ],
    because: "An upright weakened by impact can fail without warning under load, and a rack collapse is fatal. Damage is reported, never patched."
  },
  {
    id: "Q7", ref: "H7",
    ask: "Boxes are stacked against the fire extinguisher so only part of it shows. Why is that a hazard by itself?",
    options: [
      "A fire grows in seconds, and hunting for a hidden extinguisher loses those seconds.",
      "The boxes will absorb the extinguisher's pressure.",
      "The extinguisher needs daylight to stay in service."
    ],
    because: "Extinguishers are kept visible, marked and unobstructed. Lost seconds are what turn a small fire into a big one."
  },
  {
    id: "Q8", ref: "H8",
    ask: "A worker stands at the edge of a mezzanine with no guard rails. What is the correct control?",
    options: [
      "Fixed guard rails and toe boards, so the fall cannot happen at all.",
      "A warning sign at the foot of the stairs.",
      "Telling the worker to stay alert near the edge."
    ],
    because: "Falls from height kill. Edge protection removes the risk; a sign only asks people to be perfect every single time."
  },
  {
    id: "Q9", ref: "H9",
    ask: "Someone is standing on a pallet stack to reach a high load. What should they use instead?",
    options: [
      "Steps or an order picker, and report it if neither is available.",
      "A second pallet on top, for a wider footing.",
      "A colleague holding the stack steady."
    ],
    because: "Pallets are not work platforms. If the right equipment is missing the job stops, and the gap gets reported."
  },
  {
    id: "Q10", ref: "D1",
    ask: "A worker in full hi-vis is walking inside the barriered walkway. What is that?",
    options: [
      "Good practice: it is the standard the site wants to keep.",
      "A hazard, because pedestrians should stay out of the warehouse.",
      "A hazard, because hi-vis is only needed out in the yard."
    ],
    because: "Perception means committing only when you can name the hazard. Flagging everything that moves is not perception."
  }
];

/* Short UI strings. Long teaching sentences live on the items above. */
const STRINGS = {
  uiWhy: "Why:",
  uiControl: "Control:",
  cardPenaltyTitle: "Safe area",
  cardPenaltyBrief: "Clicking everything is not perception.",
  cardPenaltyWhy: "Clicking everything that shines is not perception. The penalty trains the eye to commit only when sure.",
  cardPenaltyControl: "Keep scanning; commit when you can name the hazard.",
  cardGoodTitle: "Good practice",
  allFoundTitle: "Every hazard found",
  allFoundLine: "The bay is safe.",

  /* Phase 4: portal and round flow wording */
  portalTagline: "Spot the hazard. Learn the fix. Keep the bay safe.",
  nameLabel: "Your name",
  namePlaceholder: "Enter your name...",
  avatarLabel: "Pick an avatar",
  modeTitle: "Choose a mode",
  modeTrainingTitle: "Training",
  modeTrainingLine: "No clock. Learn every hazard at your own pace.",
  modeAttackTitle: "Time Attack",
  modeAttackLine: "Find all nine before the clock runs out.",
  diffTitle: "Choose a difficulty",
  startBtn: "Start Game",
  howToBtn: "How to play",
  howToClose: "Got it",
  howToTitle: "How to play",
  leaderTitle: "Leaderboard",
  leaderEmpty: "No scores yet. Finish a round and the top five appear here.",
  privacyLine: "Runs entirely in your browser. Scores stay on this device in local storage. No accounts, no tracking, nothing is uploaded.",
  hintTraining: "Hints after ",
  hintNone: "No hints",
  roundLen: "Round ",
  missCost: "Wrong click minus ",
  pauseTitle: "Paused",
  resumeBtn: "Resume",
  restartBtn: "Restart round",
  menuBtn: "Main menu",
  pauseFine: "Press Esc to resume.",
  endFoundTitle: "All nine found",
  endTimeTitle: "Time up",
  againBtn: "Replay round",
  timeLeftTitle: "Time left",

  /* Phase 5: review, list mode, VR */
  reviewMapTitle: "Where everything was",
  reviewChipsTitle: "Your finds",
  wordMissed: "Missed",
  wordFound: "Found",
  wordSafe: "Safe",
  wordSpawn: "Start",
  wordNorth: "N",
  mapAria: "Top-down map of the bay with every hazard marked, green for found and red for missed",
  listTitle: "List mode",
  listBtnTitle: "List mode: the bay in words",
  listGo: "Take me there",
  listFlagged: "Flagged",
  listSafeCalled: "Called safe",
  listLocate: "Now facing: ",
  listLocateTip: "Flag it with a click, or aim the centre dot and press E - if you judge it a hazard.",
  listLocateDone: "You have already flagged this one.",
  listLocateSafe: "You have already called this one safe.",
  listFine: "Close with Esc. Taking you to a place walks you over and turns you to face it. Flagging still happens in the bay, with a click or the E key.",
  vrTitle: "VR mode",
  vrBtnTitle: "Enter VR",
  vrBody: "This browser reports no VR headset. To play in VR you need a WebXR browser: the Meta Quest browser, or a headset connected to Chrome or Edge on a PC. Without a headset the game is fully playable with mouse and keyboard: list mode walks you to any place in the bay with the keyboard alone, and E flags whatever you are facing.",
  vrClose: "Close",

  /* Quick-check quiz (A7): sits between the round and the review */
  quizTitle: "Quick check",
  quizIntro: "A few questions on what you just walked through. Each correct answer adds ",
  quizIntroTail: " points to your score.",
  quizProgress: "Question ",
  quizOf: " of ",
  quizRight: "Correct.",
  quizWrong: "Not quite.",
  quizNext: "Next question",
  quizFinish: "See your results",
  quizStatLabel: "Quiz",
  quizPhaseTag: "Quick check: answer the questions, then your review opens.",

  howTo: [
    { icon: "walk",     text: "Move with W A S D or the arrow keys." },
    { icon: "eye",      text: "Look around with the mouse. Drag if the pointer is free." },
    { icon: "mouse",    text: "Click a hazard to flag it." },
    { icon: "keyboard", text: "Or aim the centre dot at a hazard and press E. Best for high spots." },
    { icon: "sound",    text: "Listen. A beeping forklift hides in the north-west corner." },
    { icon: "warning",  text: "Never click the worker in full hi-vis on the walkway. That one is safe. Wrong clicks cost points." },
    { icon: "pause",    text: "Esc pauses the round." },
    { icon: "quiz",      text: "A short quick-check quiz follows the round. Correct answers add to your score." }
  ]
};

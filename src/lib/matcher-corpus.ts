/**
 * Pass U75 — standing matcher regression corpus.
 *
 * Every case is a real episode title observed in the catalogue together with
 * the link it must (or must not) produce. The corpus is data only: no per-show
 * exceptions live here, and no rule reads it. It is replayed by
 * `scripts/matcher-corpus.ts`, which is required evidence in every report for
 * the matcher evidence-hierarchy initiative (U55–U62).
 *
 * `owner` names the pass responsible for the case. Cases owned by passes that
 * have not shipped yet are expected to fail — that is the point of the corpus.
 */

export interface CorpusCase {
  /** Episode title exactly as stored. */
  episode: string;
  /** Show the title came from — context only, never used by the matcher. */
  show: string;
  /** Movie titles that must win (top candidate, at or above the threshold). */
  expect?: string[];
  /**
   * Pass U59 — movie titles that must all be suggested at or above the
   * threshold, in any order. Use this for an episode covering several films,
   * where no single candidate can be "the" winner.
   */
  expectAll?: string[];
  /** Movie titles that must not be suggested (must stay under the threshold). */
  forbid?: string[];
  /** True when the episode is not about a film at all: nothing may be suggested. */
  expectNoLink?: boolean;
  /** Pass U73 — the episode's publication date, when the case depends on it. */
  episodeReleasedAt?: string;
  /** Pass U73 — the release year the winning candidate must carry. */
  expectYear?: number;
  /**
   * Pass U72 — the films this show has *confirmed* before, by title. The runner
   * resolves each from the catalogue and builds the show's prior from them, so a
   * case can state the show's history without any per-show configuration.
   */
  profileFilms?: string[];
  /** Pass U72 — points the winning candidate must have lost to the show prior. */
  expectProfilePenalty?: number;
  /** Pass that owns this case. */
  owner: string;
  note?: string;
}

export const MATCHER_CORPUS: CorpusCase[] = [
  // ---- Pass U60: contextual content-type exclusion ----
  {
    show: "The Rewatchables",
    episode: "Bill's 50 Most Rewatchable Movies of the 21st Century",
    expectNoLink: true,
    owner: "U60",
    note: "list episode: no single film is the subject",
  },
  {
    show: "The Rewatchables",
    episode: "The Definitive Action Hero Ranking Pt. 2",
    expectNoLink: true,
    owner: "U60",
  },
  {
    show: "Deck the Hallmark",
    episode: "Gilmore Girls - S02E18 - Back in the Saddle Again",
    expectNoLink: true,
    owner: "U60",
    note: "compact episode designator",
  },
  {
    show: "You Are Good",
    episode: "Best in Show",
    expect: ["Best in Show"],
    owner: "U60",
    note: "positive control: a superlative in a real title is not a list episode",
  },


  // ---- Pass U58: sequel numbering and subtitle identity ----
  {
    show: "The Rewatchables",
    episode: "23: Mission: Impossible II",
    forbid: ["Ghostbusters II"],
    owner: "U58",
    note: "a shared \"II\" is not shared evidence",
  },
  {
    show: "The Rewatchables",
    episode: "3: Shrek 2",
    forbid: ["Deadpool 2"],
    owner: "U58",
  },
  {
    show: "The Rewatchables",
    episode: "176: The Rage: Carrie 2",
    forbid: ["Deadpool 2"],
    owner: "U58",
  },
  {
    show: "The Rewatchables",
    episode: "6: Transformers: Revenge of the Fallen",
    forbid: ["Revenge of the Nerds"],
    owner: "U58",
  },
  {
    show: "The Rewatchables",
    episode: "4: Pirates of the Caribbean: Dead Man's Chest",
    forbid: ["The Family Man"],
    owner: "U58",
  },

  // ---- Pass U73: temporal consistency (episode date vs film release) ----
  {
    show: "The Rewatchables",
    episode: "Mean Girls",
    episodeReleasedAt: "2019-04-02",
    expect: ["Mean Girls"],
    expectYear: 2004,
    owner: "U73",
    note: "a 2019 episode cannot be about the 2024 film",
  },
  {
    show: "The Rewatchables",
    episode: "Mean Girls",
    expect: ["Mean Girls"],
    owner: "U73",
    note: "no stored episode date — temporal rules must not change anything",
  },

  // ---- Pass U57: description title+year evidence and the year gate ----
  {
    show: "The Big Picture",
    episode: "82: My Blueberry Nights with David Sims",
    expect: ["My Blueberry Nights"],
    forbid: ["White Nights"],
    owner: "U57",
    note: "\"nights\" alone must not carry a match",
  },
  {
    show: "The Big Picture",
    episode: "63: What Planet Are You From?",
    expect: ["What Planet Are You From?"],
    owner: "U57",
  },
  {
    show: "The Rewatchables",
    episode: "π (1998)",
    forbid: ["Pokémon: The First Movie", "The Man in the Iron Mask", "The Truman Show"],
    owner: "U57",
    note: "a year alone is never evidence for a film",
  },

  // ---- You Are Good ----

  {
    show: "You Are Good",
    episode: "Rosemary's Baby w. Sarah Archer!",
    expect: ["Rosemary's Baby"],
    owner: "U55",
    note: "guest credit must not break the title",
  },
  {
    show: "You Are Good",
    episode: "Rosemary's Baby w. Sarah Archer!",
    forbid: ["She's Having a Baby"],
    owner: "U56",
    note: "\"baby\" alone is not identifying evidence",
  },
  {
    show: "You Are Good",
    episode: "Magnolia (Dads Can Be Very a Lot)",
    expect: ["Magnolia"],
    forbid: ["Can of Worms"],
    owner: "U56",
  },
  {
    show: "You Are Good",
    episode: "10 Things I Hate About You",
    expect: ["10 Things I Hate About You"],
    forbid: ["I, Robot"],
    owner: "U56",
  },
  {
    show: "You Are Good",
    episode: "A Beautiful Mind",
    expect: ["A Beautiful Mind"],
    forbid: ["Beautiful Disaster"],
    owner: "U56",
  },
  {
    show: "You Are Good",
    episode: "The Mummy [1999]",
    expect: ["The Mummy"],
    owner: "U57",
    note: "bracketed year must pick the 1999 film",
  },
  { show: "You Are Good", episode: "Clueless", expect: ["Clueless"], owner: "U55" },
  {
    show: "You Are Good",
    episode: "My Neighbor Totoro",
    expect: ["My Neighbor Totoro"],
    owner: "U55",
  },

  // ---- Horror Queers ----
  {
    show: "Horror Queers",
    episode: "Ready or Not 2: Here I Come (Patreon Clip)",
    forbid: ["Ready or Not"],
    owner: "U58",
    note: "sequel marker: the 2019 film is not the subject",
  },
  {
    show: "Horror Queers",
    episode: "Interview: Zoe Rose Smith on Aftermath",
    forbid: ["The Interview"],
    owner: "U55",
  },

  // ---- How Did This Get Made? ----
  {
    show: "How Did This Get Made?",
    episode: "Samurai Cop LIVE!",
    forbid: ["Kindergarten Cop"],
    owner: "U56",
  },
  {
    show: "How Did This Get Made?",
    episode: "Last Looks: Samurai Cop",
    forbid: ["The Last Song"],
    owner: "U75",
    note: "format prefix must not contribute title words",
  },
  {
    show: "How Did This Get Made?",
    episode: "Sharknado 3",
    forbid: ["Terrifier 3"],
    owner: "U58",
  },
  {
    show: "How Did This Get Made?",
    episode: "Monkeybone",
    forbid: ["Last Holiday", "The Last Song"],
    owner: "U56",
  },
  {
    show: "How Did This Get Made?",
    episode: "Last Looks: xXx & The Legend of Billie Jean",
    expect: ["xXx"],
    owner: "U59",
    note: "multi-title extraction",
  },
  {
    show: "How Did This Get Made?",
    episode: "Last Looks: xXx & The Legend of Billie Jean",
    expectAll: ["xXx", "The Legend of Billie Jean"],
    owner: "U59",
    note: "both films of a two-film episode are suggested independently",
  },
  {
    show: "Lady Parts",
    episode: "18. Waitress & Off the Menu: Getting the Food Right",
    expectAll: ["Waitress", "Off the Menu"],
    owner: "U59",
  },
  {
    show: "Lady Parts",
    episode: "30. Forever My Girl & The Road Less Traveled",
    expectAll: ["Forever My Girl", "The Road Less Traveled"],
    owner: "U59",
  },
  {
    show: "You Are Good",
    episode: "Harold and the Purple Crayon",
    expect: ["Harold and the Purple Crayon"],
    owner: "U59",
    note: "positive control: a real title containing \"and\" is never split",
  },

  // ---- Darren and Matt's 80s Adventure ----
  {
    show: "Darren and Matt's 80s Adventure",
    episode: "License to Drive (1988)",
    forbid: ["Drive"],
    owner: "U56",
  },
  {
    show: "Darren and Matt's 80s Adventure",
    episode: "Evil Dead 2 (1987)",
    expect: ["Evil Dead II"],
    owner: "U58",
  },
  {
    show: "Darren and Matt's 80s Adventure",
    episode: "Critters (1986)",
    expect: ["Critters"],
    owner: "U57",
  },

  // ---- Deck the Hallmark ----
  {
    show: "Deck the Hallmark",
    episode: "Gilmore Girls - Season 2 Episode 18 - Back in the Saddle Again",
    expectNoLink: true,
    owner: "U60",
    note: "episode designator means TV, not film",
  },
  {
    show: "Deck the Hallmark",
    episode: "Paris is Always a Good Idea - Episode 5 (Hallmark+ - 2026)",
    forbid: ["Always"],
    owner: "U60",
  },
  {
    show: "Deck the Hallmark",
    episode: "DTH Classic: Falling for You",
    forbid: ["Falling for Figaro"],
    owner: "U56",
  },
  {
    show: "Deck the Hallmark",
    episode: "Niall Matter Interview (Much About Love)",
    forbid: ["The Interview"],
    owner: "U60",
  },

  // ---- The Rewatchables ----
  {
    show: "The Rewatchables",
    episode: "'The Fugitive' With Bill Simmons, Chris Ryan, and Van Lathan",
    expect: ["The Fugitive"],
    forbid: ["Van Helsing"],
    owner: "U55",
  },
  {
    show: "The Rewatchables",
    episode: "'Friday Night Lights' With Bill Simmons and Van Lathan",
    forbid: ["Friday", "Van Helsing"],
    owner: "U56",
  },
  {
    show: "The Rewatchables",
    episode: "'Basic Instinct' Live From San Francisco",
    forbid: ["Maternal Instinct"],
    owner: "U56",
  },
  {
    show: "The Rewatchables",
    episode: "A 2026 Rewatchables Mailbag",
    expectNoLink: true,
    owner: "U60",
  },

  // ---- The Flop House ----
  {
    show: "The Flop House",
    episode: "Harold and the Purple Crayon",
    forbid: ["Purple Rain"],
    owner: "U56",
  },
  { show: "The Flop House", episode: "Trap", forbid: ["The Parent Trap"], owner: "U56" },
  {
    show: "The Flop House",
    episode: "Return to Silent Hill",
    forbid: ["Return of the Jedi"],
    owner: "U56",
  },
  {
    show: "The Flop House",
    episode: "FH Mini #150 - Best Stephen King Movies",
    expectNoLink: true,
    owner: "U60",
  },

  // ---- The Confused Breakfast ----
  {
    show: "The Confused Breakfast",
    episode: "BRUNCH: Nickelodeon GUTS",
    expectNoLink: true,
    owner: "U60",
    note: "game show, not a film",
  },
  {
    show: "The Confused Breakfast",
    episode: "BRUNCH: The Greatest Drinks in Movie History",
    expectNoLink: true,
    owner: "U60",
    note: "list episode",
  },

  // ---- Pass U72: podcast-profile priors (genre, rating, era) ----
  // A fictional throwback-horror show, described only by the films it has
  // confirmed. The prior may demote, never exclude.
  {
    show: "Throwback horror show (profile fixture)",
    episode: "Pretty Woman: our favourite makeover",
    profileFilms: [
      "A Nightmare on Elm Street",
      "Bram Stoker's Dracula",
      "Carrie",
      "Child's Play",
      "Christine",
      "Day of the Dead",
      "Dawn of the Dead",
      "Body Parts",
    ],
    expect: ["Pretty Woman"],
    expectProfilePenalty: 4,
    owner: "U72",
    note: "unusual genre for this show: demoted, still linkable",
  },
  {
    show: "Throwback horror show (profile fixture)",
    episode: "Bone Lake: the new slashers",
    profileFilms: [
      "A Nightmare on Elm Street",
      "Bram Stoker's Dracula",
      "Carrie",
      "Child's Play",
      "Christine",
      "Day of the Dead",
      "Dawn of the Dead",
      "Body Parts",
    ],
    expect: ["Bone Lake"],
    expectProfilePenalty: 3,
    owner: "U72",
    note: "outside this show's usual era: demoted, still linkable",
  },
  {
    show: "Throwback horror show (profile fixture)",
    episode: "Splitsville",
    profileFilms: [
      "A Nightmare on Elm Street",
      "Bram Stoker's Dracula",
      "Carrie",
      "Child's Play",
      "Christine",
      "Day of the Dead",
      "Dawn of the Dead",
      "Body Parts",
    ],
    expect: ["Splitsville"],
    expectProfilePenalty: 0,
    owner: "U72",
    note: "named exactly: the prior steps aside entirely",
  },
  {
    show: "Small-sample show (profile fixture)",
    episode: "Pretty Woman",
    profileFilms: ["Carrie", "Christine", "Child's Play"],
    expect: ["Pretty Woman"],
    expectProfilePenalty: 0,
    owner: "U72",
    note: "too few confirmed films for a prior at all",
  },
];

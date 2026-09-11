import type { EditCheck, Outcome } from "./metrics";
import type { Question } from "@/lib/agent/types";

export interface ScenarioEdit {
  text: string;
  check: EditCheck;
  /**
   * The sentence that undoes this one, where one exists. Used only by
   * `idempotence`, on a side copy of the trip, so declaring an inverse never
   * changes what the rest of the scenario measures.
   */
  inverse?: string;
}

export interface Scenario {
  id: string;
  note: string;
  opening: string;
  /** Fed in order as answers to whatever the agent asks. */
  answers: string[];
  edits: ScenarioEdit[];
  /**
   * Said at a finished pitch, unprompted, through the real turn.
   *
   * Distinct from `answers`, which reply to questions, and from `edits`,
   * which go through `applyOps` and cannot change where the trip is. This is
   * the traveller reading a pitch and saying the next thing she came to say.
   */
  volunteered?: string[];
  /**
   * Accepts any of these. More than one answer can be right, and pinning a
   * single id when two are defensible is how a red eval becomes background
   * noise: "somewhere that looks nothing like home, nature, not a city" was
   * asserted as Iceland and answered with New Zealand for days.
   */
  expectDestination?: string | string[];
  /**
   * Scenarios that only mean anything against the model. The rules parser has
   * no typo tolerance and never will, so running a misspelling through it is
   * a permanent red that teaches nobody anything.
   */
  onlyDriver?: "llm";
  /**
   * A place the catalogue does not hold, so the research path actually runs.
   * `call_economy` needs a turn with research in it; every other scenario
   * plans out of the catalogue and never makes a research call at all.
   */
  research?: string;
  /**
   * A question the agent must NOT put at this point, because the brief already
   * answers it.
   *
   * `thread_continuity` needs a turn in which a question is offered that has
   * already been answered, and the rules driver never produces one: its gate
   * is tight enough that it stops asking as soon as a slot fills. So the
   * drifting question is declared here and put through the real gate in
   * lib/flow.ts by a stub, exactly as `research` drives the real research path
   * for `call_economy`. Without this the metric reads 100% forever on a
   * scorecard that has never once exercised it — which is the specific way
   * three metrics in this file were green against the bugs they were written
   * for.
   */
  reask?: Question;
  /**
   * Which ending is the right one for this scenario. Defaults to "plan".
   *
   * The harness runs lib/flow.ts, and lib/flow.ts is allowed to stop without
   * an itinerary — that is most of what its guards are for. A scenario that
   * SHOULD stop has to say so, or the scorecard cannot tell an honest refusal
   * from a hole. See `outcomeFidelity` in metrics.ts.
   */
  outcome?: Outcome;
}

export const SCENARIOS: Scenario[] = [
  /*
   * Two openings that state a thing to do, because until these there were
   * none: every scenario named a mood or a place, so `claim_accuracy` had
   * nothing to score and read 100% on code that was announcing "nothing in
   * this trip covers gaudi" above the Sagrada Família.
   *
   * Both phrases are ones the word matcher used to miss for mechanical
   * reasons — a compound name, and an accent deleted before comparison —
   * which is the class that metric exists to hold.
   */
  {
    id: "stated-activity-compound",
    note: "Denmark for the design. Designmuseum Danmark is a compound; the matcher used to miss it and announce a gap.",
    opening: "i want to go to denmark for the design",
    answers: ["Four days.", "Around $2,000."],
    expectDestination: "denmark",
    edits: [
      { text: "Give me a free afternoon on day 2.", check: { type: "fewer_activities" } },
    ],
  },
  {
    id: "stated-activity-accented",
    note: "Catalonia for gaudi. The accent in Sagrada Família was deleted before comparison, so the trip denied covering its own centrepiece.",
    opening: "i want to go to catalonia for gaudi",
    answers: ["Five days.", "Around $2,500."],
    expectDestination: "catalonia",
    edits: [],
  },
  {
    id: "surprise-me",
    note: "The section 39 demo, verbatim.",
    opening: "I need a vacation. Surprise me.",
    answers: ["About a week.", "Exploration and rest. Maybe some food and wine.", "Around $2,000."],
    expectDestination: "portugal",
    /*
     * She said "About a week." in her first answer. A model driver asking for
     * the length again is the commonest way this agent loses the thread, and
     * it is a question the rules driver's own gate can never produce — its
     * floor stops the moment a slot fills — so `thread_continuity` would read
     * 100% on this scorecard forever while the model re-asked on every other
     * turn. Declared here and put through the real gate in lib/flow.ts, the
     * same way `research` drives the real research path for `call_economy`.
     */
    reask: { id: "duration", kind: "single", prompt: "How many days have you got?" },
    edits: [
      { text: "This is too much sightseeing.", check: { type: "fewer_activities" } },
      { text: "Add more wine.", check: { type: "more_tag", tag: "wine" }, inverse: "less wine" },
    ],
  },
  {
    id: "named-destination",
    note: "They already know where. The agent should not re-litigate it.",
    opening: "Plan me a trip to Portugal.",
    answers: ["Five days.", "Food and city energy mostly.", "$1,800"],
    expectDestination: "portugal",
    edits: [
      { text: "I don't really care about castles.", check: { type: "fewer_tag", tag: "castle" },
        inverse: "actually i'd love more castles" },
    ],
  },
  {
    id: "warm-and-cheap",
    note: "Tight budget, short trip. Should not propose Japan or Copenhagen.",
    opening: "I want to get away somewhere warm without spending much.",
    answers: ["Four days.", "Relaxation and food.", "Under $1,000"],
    edits: [
      { text: "Make it less touristy.", check: { type: "less_touristy" } },
    ],
  },
  {
    id: "busy-culture",
    note: "Wants a packed trip. Downtime rules must relax, pace must rise.",
    opening: "I have ten days and I want to see as much as possible.",
    answers: ["Ten days.", "Art and culture, city energy, adventure.", "$3,000+"],
    edits: [
      { text: "Actually this is too busy, slow it down.", check: { type: "fewer_activities" } },
    ],
  },
  {
    id: "constrained",
    note: "Explicit constraint stated up front, in free text.",
    opening: "A week off in October. I don't want to wake up early or spend all day in museums.",
    answers: ["A week.", "Food and drink, and some nature.", "Whatever makes sense"],
    edits: [
      { text: "I want more nature.", check: { type: "more_tag", tag: "nature" } },
    ],
  },
  {
    id: "iceland-landscape",
    note: "Nature-forward and expensive. Tests car day trips and the return-to-airport leg.",
    opening: "I want to go somewhere that looks nothing like home.",
    answers: ["A week.", "Nature and adventure, mostly. Not a city trip.", "$3,000+"],
    // The same check on a different slot: she said what she wants out of it in
    // her own words, and being asked again is the app telling her it was not
    // listening.
    reask: { id: "vibes", kind: "multi", prompt: "What sounds good right now?" },
    // Iceland AND New Zealand are both correct answers to this brief. It was
    // pinned to Iceland, failed on New Zealand every run, and the exit code
    // stopped meaning anything.
    expectDestination: ["iceland", "newzealand"],
    edits: [
      { text: "I want more time in hot water.", check: { type: "more_tag", tag: "spa" } },
      { text: "This is too much driving, slow it down.", check: { type: "fewer_activities" } },
    ],
  },
  {
    id: "korea-food",
    note: "Two bases plus high-speed rail. Tests the KTX override and dense-city pacing.",
    opening: "I want to eat my way through a city for a week and a bit.",
    answers: ["Eight days.", "Food and drink, art and culture, city energy.", "$2,000–3,000"],
    // Mexico City is a defensible answer to this now that its catalogue is
    // deep, so the assertion allows either rather than pinning a tie.
    /*
     * Three, not two. Filling out the France catalogue took its depth term to
     * the cap, and the top three now sit inside 0.0007 of each other with
     * vibe capped at 1.00 for all of them — a genuine three-way tie that the
     * stable index nudge resolves, not a ranking decision. The app itself
     * says so: the gap is under the confidence floor, so it names two and
     * asks which direction she means. Pinning two of three would be
     * asserting the nudge. This assertion was already widened once, for the
     * same reason, when the Mexico catalogue deepened.
     *
     * Four, now. Taipei arrived with four night markets and a catalogue deep
     * enough to cap the depth term, and on the vibes this brief actually
     * parses to it lands 0.001 above Korea — which is the nudge again, not a
     * ranking decision, and Taiwan is not a wrong answer to "eat my way
     * through a city for a week and a bit".
     */
    expectDestination: ["korea", "mexico", "france", "taiwan"],
    edits: [
      { text: "This is too much sightseeing.", check: { type: "fewer_activities" } },
      { text: "More food please.", check: { type: "more_tag", tag: "food" } },
    ],
  },
  /*
   * Three scenarios added with the metrics below them, because the suite as it
   * stood could not exercise any of them:
   *
   *   - no scenario produced an unmatched-activity report at all, so
   *     `noise_rate` had no denominator and would have read 100% forever;
   *   - no scenario opened with a question, which is where the noise phrases
   *     ("the weather", "the exchange rate") actually come from;
   *   - every edit in the suite was a single clause, so `clause_accounting`
   *     could not see the bulk-marking gap it exists to see.
   */
  {
    id: "stated-activity-gap",
    note: "A thing to do that Portugal genuinely has nothing for. The honest report, which noise_rate has to count as grounded.",
    opening: "i want to go to portugal for surfing",
    answers: ["Six days.", "Around $2,000."],
    expectDestination: "portugal",
    edits: [],
  },
  {
    id: "question-as-opening",
    note: "She opens by asking whether a week is too long for the kids. Nothing here is a request, so nothing may be reported as unmatched.",
    opening: "we're thinking portugal - is a week too long for the kids?",
    answers: ["A week.", "Food and city energy.", "$2,000"],
    expectDestination: "portugal",
    edits: [],
  },
  {
    id: "two-things-in-one-sentence",
    note: "Two clauses, one of them something the engine holds no tag for. The second must be done or named — silence is the bug.",
    opening: "Plan me a week in Portugal.",
    answers: ["Seven days.", "Food and wine.", "$2,200"],
    expectDestination: "portugal",
    edits: [
      { text: "more wine and more helicopters", check: { type: "more_tag", tag: "wine" } },
      { text: "i'd love more markets and a cooking class", check: { type: "more_tag", tag: "market" } },
    ],
  },
  {
    id: "unresearched-place",
    note: "Somewhere the catalogue does not hold, so the research path runs and its calls can be counted.",
    opening: "i want to go to the faroe islands",
    answers: ["A week.", "Nature, mostly.", "$2,500"],
    research: "the faroe islands",
    /*
     * And it ends without a trip, on purpose.
     *
     * The harness's research stub streams a paragraph and then never returns
     * a pack, which is the real failure mode this scenario was written for.
     * The product's answer to that is to say so and stop — "I couldn't work
     * up Faroe Islands properly just now, and I'm not going to send you
     * somewhere else instead" — so a plan on this row is the bug, not the
     * pass. It is declared here rather than inferred, so the day the app
     * starts planning Korea again the row goes red instead of quietly
     * scoring the Korea trip on twenty other metrics.
     */
    outcome: "refusal",
    edits: [],
  },
  /*
   * Two more, added with `words_survive` and `attribution_accuracy` below
   * them, because the suite as it stood could not exercise either properly:
   *
   *   - every other scenario puts one to three phrases on the brief and all
   *     but two of them arrive in the opening message, so the metric that asks
   *     whether a phrase SURVIVES a session had almost no session to survive;
   *   - seven of seventeen scenarios attributed nothing to her at all, so
   *     `attribution_accuracy` was reading a handful of lines and two of them
   *     carried the whole number.
   */
  {
    id: "stacked-typed-phrases",
    note: "Four messages, each adding something: a length, a budget, then a place and two things to do and a refusal. Everything must still be on the brief after the edits.",
    // Deliberately says neither where nor why, because that is the only gate
    // that keeps nextQuestionRules asking. An opening that names a place gets
    // one turn and the accumulate path is never walked.
    opening: "i need to get away, not sure where yet",
    answers: [
      "Six days.",
      "Around $1,800.",
    ],
    /*
     * The third sentence, moved out of `answers`.
     *
     * It used to sit there and it was never delivered, because the product
     * asks two discovery questions and then pitches: `nextQuestionRules` has
     * one discovery question, `threadDrift` drops it the third time it is
     * put, and `advance()` reaches the open-field branch. So the scenario
     * asserted Portugal on the strength of a sentence the harness never let
     * her say, and it only passed under a harness that drove nextQuestion in
     * a loop of its own.
     *
     * It is not an `edit` either: edits run through `applyOps`, which cannot
     * change where the trip is. This is her reading a pitch for somewhere
     * else and saying where she actually wants to go, which the product
     * handles by running `interpret` and repinning.
     */
    volunteered: [
      "we want to go to portugal for the surfing and the seafood, and no early starts",
    ],
    expectDestination: "portugal",
    edits: [
      { text: "more markets please", check: { type: "more_tag", tag: "market" } },
      { text: "i also really want to spend time in hot springs", check: { type: "more_tag", tag: "spa" } },
    ],
  },
  /*
   * Three openings whose purpose clause is NOT a thing to do, one per class
   * `NOT_AN_ACTIVITY` and `WHO_NOT_WHAT` hold: a reason, a quality, a
   * companion. Added with the rebuilt `words_survive`, because the suite as it
   * stood reached that word list exactly once, by accident, in a scenario
   * written for something else — so a filter that deletes a phrase from the
   * brief on every one of these sentences was scored by nothing.
   *
   * What each asserts is not that the phrase becomes an activity. It must not:
   * `activities` drives the +0.6 `asked` weight and `unserved`'s out-loud
   * report, and "One thing this doesn't cover: my mum" is what putting it
   * there produces. What they assert is that the phrase is still SOMEWHERE at
   * the end of the session, which is the difference between refusing a phrase
   * and deleting one.
   */
  {
    id: "reason-not-activity",
    note: "Why the trip is happening. 'work' is not a thing to do in Lisbon, and it is still a word she typed.",
    opening: "i'm flying to lisbon for work",
    answers: ["Five days.", "Food and city energy.", "$2,000"],
    expectDestination: "portugal",
    edits: [
      { text: "More food please.", check: { type: "more_tag", tag: "food" } },
    ],
  },
  {
    id: "quality-not-activity",
    note: "What she wants out of it. 'the scenery' compresses to the nature vibe and her own word used to be dropped on the way.",
    opening: "i want to go to iceland for the scenery",
    answers: ["Six days.", "$3,000+"],
    expectDestination: "iceland",
    edits: [
      { text: "I want more time in hot water.", check: { type: "more_tag", tag: "spa" } },
    ],
  },
  {
    id: "companion-not-activity",
    note: "Who she is going with. The sentence that produced 'One thing this doesn't cover: my mum' and then produced nothing at all.",
    opening: "i want to go to japan for my mum",
    answers: ["Seven days.", "Art and culture.", "$3,000+"],
    expectDestination: "japan",
    edits: [],
  },
  {
    id: "length-plus-activity",
    note: "A duration and a thing to do in one clause. The parser refuses the whole tail because it contains 'week', and 'design museums' goes with it.",
    opening: "heading to denmark for a week of design museums",
    answers: ["Seven days.", "Around $2,500."],
    expectDestination: "denmark",
    edits: [],
  },
  {
    id: "quoted-back",
    note: "Two words the reason bank has second-person lines for. The attribution metric has to score a correct quote 100%, or all it measures is that the app talks.",
    opening: "i want to go to portugal for the wine and the markets",
    answers: ["Six days.", "$2,000"],
    expectDestination: "portugal",
    edits: [
      { text: "Add more wine.", check: { type: "more_tag", tag: "wine" }, inverse: "less wine" },
    ],
  },
  // --- adversarial ---------------------------------------------------------
  //
  // The eight above are all the same shape: a complete, correctly spelled
  // brief, answered in order, followed by two instructions. Every bug found
  // by hand-testing lived outside that shape.
  {
    id: "question-at-proposal",
    note: "A question about the trip is not a request for a different one. The LA Olympics turn.",
    opening: "Plan me five days in Iceland.",
    answers: ["Five days.", "Nature and adventure.", "$3,000+"],
    expectDestination: "iceland",
    edits: [
      { text: "what's the weather actually like there in October?", check: { type: "no_change" } },
      { text: "how far is the airport from the first hotel?", check: { type: "no_change" } },
    ],
  },
  {
    id: "new-interest-at-proposal",
    note: "The box is an input, not a command line. A new interest reaches the itinerary.",
    opening: "Plan me a week in Iceland.",
    answers: ["Seven days.", "Nature, mostly.", "$3,000+"],
    expectDestination: "iceland",
    edits: [
      { text: "i also really want to spend time in hot springs", check: { type: "more_tag", tag: "spa" } },
    ],
  },
  {
    id: "stay-put",
    note: "Her hard rule. Named a country, then said something that used to pull the recommender elsewhere.",
    opening: "I want to go to Korea for a week.",
    answers: ["Seven days.", "Somewhere with good beaches would be nice too.", "$2,500"],
    expectDestination: "korea",
    edits: [
      { text: "More food please.", check: { type: "more_tag", tag: "food" } },
    ],
  },
  {
    id: "named-with-typo",
    note: "One missing letter. 'canad' cost a traveller the entire country.",
    opening: "10 days in portgual",
    answers: ["Ten days.", "Food and city energy.", "$2,500"],
    expectDestination: "portugal",
    onlyDriver: "llm",
    edits: [],
  },
  {
    id: "vague-flexible",
    note: "Maximally vague. Tests that the agent still converges in few questions.",
    opening: "I don't know, I just need to get out of here.",
    answers: ["I'm flexible", "Surprise me", "Whatever makes sense"],
    edits: [
      { text: "Give me a free afternoon somewhere.", check: { type: "fewer_activities" } },
    ],
  },
];

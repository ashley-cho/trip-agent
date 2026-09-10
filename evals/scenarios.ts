import type { EditCheck } from "./metrics";
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
    expectDestination: ["korea", "mexico"],
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
      "we want to go to portugal for the surfing and the seafood, and no early starts",
    ],
    expectDestination: "portugal",
    edits: [
      { text: "more markets please", check: { type: "more_tag", tag: "market" } },
      { text: "i also really want to spend time in hot springs", check: { type: "more_tag", tag: "spa" } },
    ],
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

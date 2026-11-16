# Executive Summary: Cognitive Engineering of Spaced Repetition Prompts

## 1. Core Cognitive & Algorithmic Foundations

Effective Anki card design is not passive data archiving; it is **recurring cognitive task design** engineered to reorganize long-term memory schemas.

* **The Working Memory Bottleneck:** Human working memory can only process **3 to 4 discrete chunks** of information simultaneously (Cowan, 2001). Under John Sweller's *Cognitive Load Theory*, flashcards that ask for multiple unintegrated facts overload working memory, halting schema consolidation.

* **Storage vs. Retrieval Strength:** Under Robert and Elizabeth Bjork's *New Theory of Disuse*, long-term **storage strength** grows most when momentary **retrieval strength** is low. Passive recognition or over-cued prompts create *illusions of competence* (scoring \~40% lower on delayed tests), whereas effortful active recall ("desirable difficulties") boosts retention by 30% to 50%.

* **Algorithmic Reality (FSRS):** Modern schedulers like the **Free Spaced Repetition Scheduler (FSRS)** eliminate legacy SM-2 "Ease Hell" by tracking *Memory Stability*, *Retrievability*, and *Difficulty* independently (reaching equilibrium at \~60–80 daily reviews for 10 new cards/day at 90% target retention). However, FSRS relies on a clean self-grading signal. Overloaded or ambiguous cards corrupt this signal, generating **leeches**—the 3% to 5% of cards that consume up to **50% of total review time** (Woźniak, 1999).

## 2. The Top 10 Rules for Cognitive Success

These ten rules represent the premier tier because they directly govern working memory load, synaptic retrieval consistency, and real-world transfer:

 1. **Comprehension & Holistic Schema Before Memorization:** Build a coherent mental model before creating cards (*"Do not learn if you do not understand"*). Prior schemas dramatically elevate retention (Bransford & Johnson, 1973), whereas memorizing uncomprehended text relies on shallow phonological rehearsal.

 2. **Minimum Information Principle & Atomic Decomposition:** Restrict each card to a single, indivisible ("atomic") fact. Atomic cards respect the 3–4 chunk working memory limit, isolate the exact locus of forgetting, and ensure pure FSRS stability grading.

 3. **Unambiguous Precision & Retrieval Consistency:** Phrase prompts so the expected shape of the answer is unmistakable and activates the exact same neural pathway every session. Use compact front-loaded context cues (e.g., `bioch: GRE`) and satisfy Issa Rice's **Expert Response Heuristic** (a domain expert who never read your notes should produce the exact intended answer without hesitation).

 4. **Effortful Generative Retrieval Over Pattern Matching:** Demand active memory reconstruction rather than binary (yes/no) guessing or visual pattern matching (e.g., reflexively answering "mitochondria" to the shape of the phrase *"powerhouse of the cell"* without engaging the underlying biology).

 5. **Calibrated Tractability & Fundamental Scaffolding:** Keep difficulty *desirable* (\~90% recall) rather than *destructive* by aggressively ankifying foundational definitions, symbols, and axioms. Automating basics into single chunks frees working memory for complex, high-element-interactivity reasoning.

 6. **Transfer-Appropriate Processing (TAP) Alignment:** Match card tasks to real-world performance operations (Morris, Bransford, & Franks, 1977). Replace static definitional prompts with concrete classification, execution, and situationally triggered *salience prompts* to avoid the \~50% transfer penalty of mismatched study formats.

 7. **Planned Redundancy & Multi-Angle Encoding:** Interrogate complex concepts across multiple atomic cards from six complementary angles: *formal definition, geometric/intuitive meaning, concrete instance classification, teleology/purpose, one-sentence proof compression, and counterfactual boundary-pushing*.

 8. **Densely Linked Conceptual Hierarchies (The Anti-Orphan Rule):** Never add an isolated "orphan" card on a new topic (Nielsen, 2018). Author tightly linked clusters of 3 to 5+ cards that pair low-level atomic facts with high-level integrative prompts to build deep semantic networks (Craik & Lockhart, 1972).

 9. **Proactive Interference Mitigation & Interleaved Contrast:** Combat memory interference—the #1 cause of forgetting in mature decks—by refactoring confused concepts with explicit discriminative contrast (*"Unlike X, how does Y..."*) and merging sub-decks into **One Big Deck** to leverage interleaving (+200% delayed test performance; Rohrer & Taylor, 2007).

10. **Elimination of Unordered Sets & Raw Enumerations:** Never test raw unordered lists on a single card, as random retrieval order causes *retrieval-induced forgetting (RIF)*. Convert lists into functional/categorical questions, targeted missing-element clozes (for 3–4 item lists), or overlapping chained clozes for ordered sequences.

## 3. Why Secondary & Popular Habits Were Excluded from the Top 10

The remaining rules from Woźniak's *Twenty Rules* and popular community habits were excluded because they are either situational tactics, administrative metadata, or counterproductive misconceptions:

* **Default Textual Cloze Deletions (Woźniak Rule 5):** Copy-pasting prose and blanking out keywords (`{{c1::...}}`) encourages shallow syntactic pattern matching, leaks context hints, and fails the Expert Response Heuristic. Q&A prompts produce superior generative synthesis.

* **Imagery, Image Occlusion, & Mnemonics (Woźniak Rules 6, 7, 8):** Useful domain-specific tools (e.g., Image Occlusion for anatomy; mnemonics for the 1–5% of arbitrary lists), but forcing decorative images or artificial acronyms onto abstract concepts adds extraneous load without building semantic comprehension.

* **Personalization & Emotional States (Woźniak Rules 14, 15):** Useful for rescuing stubborn leeches, but state-dependent memory restricts recall to specific moods rather than cultivating context-independent professional transfer.

* **Sources, Date Stamping, & Prioritization (Woźniak Rules 18, 19, 20):** Crucial **macro-workflow governance** (e.g., Nielsen's 10-Minute Rule, Gwern's 5-Minute Rule, non-tested source fields), rather than micro-level cognitive prompt design.

* **Multi-Fact "Chunking" on Single Cards:** A community misapplication of Miller (1956); placing 3–5 un-automated facts on one card does not build a chunk—it overloads working memory. True chunking is built hierarchically across separate atomic and integrative cards.

## 4. Operational Takeaway: The Diagnostic Leech Refactoring Protocol

When running Anki with FSRS (90% target retention, unified interleaved deck), treat repeated lapses (**leeches**) as diagnostic signals of flawed card design rather than personal memory failures:

* **Overwhelming / Partial Recall?** $\rightarrow$ Violates **Rule 2** or **Rule 10** (*Split into atomic Q&A or functional categories*).

* **Knew the concept, but guessed the wrong answer shape?** $\rightarrow$ Violates **Rule 3** (*Add context labels and narrow the constraint to pass the Expert Response Heuristic*).

* **Easy in Anki, but useless in real-world problem solving?** $\rightarrow$ Violates **Rule 4**, **Rule 6**, or **Rule 7** (*Replace passive clozes/definitions with multi-angle application and boundary-pushing tasks*).

* **Feels arbitrary, stale, or confused with a similar term?** $\rightarrow$ Violates **Rule 1**, **Rule 5**, **Rule 8**, or **Rule 9** (*Re-read source schema, automate missing basics, weave a 3–5 card cluster, and add contrastive prompts*).
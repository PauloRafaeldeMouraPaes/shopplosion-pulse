# Evidence-to-Insight layer

The Pulse study layer remains privacy-first and browser-local. Uploaded studies are persisted in IndexedDB and exposed to Ask AI as provenance-rich evidence.

## Contract

- `claims`: descriptive sentence-level observations extracted from study text.
- `polarity`: heuristic positive/negative/neutral signal; **not** statistical inference.
- `topics`: heuristic FMCG topics detected in the text.
- `provenance`: identifies user-provided evidence and extraction method.
- `potential-contradictions`: opposing claim polarities sharing a topic across different studies. These are **review flags**, not automatic truth judgments.

The design deliberately avoids silently converting extraction heuristics into factual or statistical conclusions.

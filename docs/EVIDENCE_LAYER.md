# Evidence layer contract

The Pulse study layer turns uploaded study text into provenance-rich, descriptive evidence for Ask AI.

Claims are sentence-level observations extracted from the uploaded text. Polarity and topics are heuristic signals only; they are not statistical inference. A potential contradiction is flagged when two different studies contain opposing polarity claims on a shared topic. The UI explicitly asks for human review rather than declaring either study correct.

Evidence remains removable, and clearing studies clears the active study context.

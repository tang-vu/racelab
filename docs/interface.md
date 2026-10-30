# The concurrency lab interface

The workbench gives an experiment a visible sequence: observe the overlap, inspect the shared read, check the model's repair, compare its execution, and keep the evidence.

The paper-colored source area and dark trace stage distinguish code from execution. Request A uses lime; B uses violet. Orange marks the shared reads found in an actual failing trace. Pass/fail text and operation labels preserve meaning without relying on color. The headline describes the authored input problem. The large numerator follows the selected committed memory snapshot; the denominator comes from the fixed inputs, not model prose.

On opening a case, the app performs one serial run and one controlled overlap locally. This makes no Meta request. **Play** advances through recorded operation results; the scrubber and timeline nodes select exact steps. **Find the collision** jumps to two requests reading the same relevant key/value without a write between them. This is a visible shared-read observation, not a general causal inference engine. A passing run has no failure jump. **Run sequentially**, **Find the race** and **Re-execute** continue to execute the handler in the local runner.

**Check Meta repair** stays beside the trace. It recomputes the retained model investigation locally, then opens the candidate source and its checked execution. A/B does not replace the editable original. Scope counts remain visible next to CHECKED, and the evidence section lists the four actual input cases with schedule counts and complete/capped coverage. An unsuccessful or incomplete candidate remains inspectable. Actual/expected acceptance details expand in place.

New paid investigations live behind a separate disclosure with budget/data-flow copy. Editing source clears stale evidence. Replaying a saved repair refuses to overwrite a modified handler: reset to the authored source or investigate the edited code. Imported reports are recomputed and model attribution remains unverified. Code highlighting escapes all source text before inserting spans; model-generated source is never run by the display layer.

Focus mode keeps execution and code prominent. The narrow layout brings the trace before the source, preserves horizontal scrolling inside the timeline/editor, and stacks evidence for readability. Reduced-motion preferences disable decorative transitions and smooth following. Playback scrolls only its timeline, not the whole page.

Verification: the DOM integration test uses the actual HTML/JavaScript against a separate keyless server. It covers auto-execution, shared-read navigation, serial/search, recorded repair, A/B, source invalidation and escaping, replay refusal after edits, import recomputation, case switching, playback and Focus/Escape, with zero paid calls. jsdom does not paint CSS. Native Edge was reloaded through Computer Use and exposed the new page and executed results through accessibility; window screenshots currently time out, so visual pixel and responsive-layout verification remains pending.

The film and original eight capture files are archived from the previous interface. They have not been relabelled as captures of this design.

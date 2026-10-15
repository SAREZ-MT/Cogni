// Domain-only public entry: the metacognitive calibration classifier
// (documento-maestro §7.4, ADR 0007) for modules that need it as a value,
// such as analytics/application/get-calibration.ts. The module's index.ts
// also re-exports its Server Actions, which load server-only code, the
// database and infrastructure; importing a pure function through it would
// drag that graph into another module's application layer. This file may
// only re-export from ./domain (`domain-entry-is-pure` in
// .dependency-cruiser.cjs).
export { type Calibration, calibrationOf } from "./domain";

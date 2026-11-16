/**
 * The measuring display of the 3D body (block 7B, D181).
 *
 * A feature of its own, beside the body and not inside it: the recorder,
 * the display and its switch know nothing of three.js, so the screens that
 * open the measurement and show the switch import from here and never
 * reach behind the body's lazy boundary. The viewer reports to the
 * recorder; nothing here asks the viewer for anything.
 */
export { BodyReadout, useMeasuring } from './BodyReadout';
export { MeasureSetting } from './MeasureSetting';
export { bodyMeasure, isMeasuring } from './measure';

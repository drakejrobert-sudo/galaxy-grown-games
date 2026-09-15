import Phaser from 'phaser';
import { FlightScene } from './scene';

// Imported only after a player starts a challenge. Keep Phaser out of the setup bundle.
export { Phaser, FlightScene };

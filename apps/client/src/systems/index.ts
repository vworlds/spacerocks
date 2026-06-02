// Update phase systems (import order = execution order)
import './ShipControl';
import './Thrust';
import './AlienAI';
import './Movement';
import './AngularMovement';
import './FrictionSystem';
import './Wrap';
import './Shooting';
import './RocketSystem';
import './BoomerangSystem';
import './DecaySystem';
import './RandomClockSystem';

// Render phase systems
import './Render';
import './UI';

// Draw statement systems (render phase, enter/exit only)
import './draw/AlphaSystem';
import './draw/FillStyleSystem';
import './draw/StrokeStyleSystem';
import './draw/ShapeSystem';
import './draw/ArcSystem';
import './draw/FilledRectSystem';
import './draw/LabelSystem';
import './draw/ShieldDraw';
import './draw/HealthDraw';
import './draw/LaserBeamDraw';

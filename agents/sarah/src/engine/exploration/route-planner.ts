/**
 * Hardcoded objective progression for Pokemon Red.
 * Each objective has a target map ID and description.
 * The planner checks badges to determine current progress.
 */

interface Objective {
  badgesRequired: number;
  targetMapId: number;
  description: string;
}

const OBJECTIVES: Objective[] = [
  { badgesRequired: 0, targetMapId: 48, description: 'Beat Brock in Pewter Gym' },
  { badgesRequired: 1, targetMapId: 58, description: 'Beat Misty in Cerulean Gym' },
  { badgesRequired: 2, targetMapId: 90, description: 'Beat Lt. Surge in Vermilion Gym' },
  { badgesRequired: 3, targetMapId: 114, description: 'Beat Erika in Celadon Gym' },
  { badgesRequired: 4, targetMapId: 155, description: 'Beat Koga in Fuchsia Gym' },
  { badgesRequired: 5, targetMapId: 178, description: 'Beat Sabrina in Saffron Gym' },
  { badgesRequired: 6, targetMapId: 218, description: 'Beat Blaine in Cinnabar Gym' },
  { badgesRequired: 7, targetMapId: 45, description: 'Beat Giovanni in Viridian Gym' },
  { badgesRequired: 8, targetMapId: 245, description: 'Challenge the Elite Four' },
];

export function getNextObjective(badgeCount: number): { targetMapId: number; description: string } {
  for (const obj of OBJECTIVES) {
    if (badgeCount <= obj.badgesRequired) {
      return { targetMapId: obj.targetMapId, description: obj.description };
    }
  }
  return OBJECTIVES[OBJECTIVES.length - 1];
}

export function getObjectiveDescription(badgeCount: number): string {
  return getNextObjective(badgeCount).description;
}

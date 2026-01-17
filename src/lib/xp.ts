
const BASE_XP = 100;
const EXPONENT = 1.5;

export function calculateLevel(xp: number) {
  if (xp < 0) {
    return { level: 1, levelXp: 0, nextLevelXp: BASE_XP, progress: 0 };
  }

  let level = 1;
  let requiredXp = 0;

  // Find the current level
  while (true) {
    const xpForNextLevel = requiredXp + Math.floor(BASE_XP * Math.pow(level, EXPONENT));
    if (xp < xpForNextLevel) {
      break;
    }
    requiredXp = xpForNextLevel;
    level++;
    if (level > 100) {
        level = 100;
        break;
    }
  }

  if (level >= 100) {
     const totalXpForLevel99 = Math.floor(BASE_XP * Math.pow(99, EXPONENT));
     const currentLevelXp = xp - totalXpForLevel99;
     return { level: 100, levelXp: currentLevelXp, nextLevelXp: currentLevelXp, progress: 100 };
  }

  const xpForCurrentLevel = requiredXp;
  const xpForNextLevel = Math.floor(BASE_XP * Math.pow(level, EXPONENT));
  const currentLevelXp = xp - xpForCurrentLevel;
  const progress = Math.floor((currentLevelXp / xpForNextLevel) * 100);

  return {
    level,
    levelXp: currentLevelXp,
    nextLevelXp: xpForNextLevel,
    progress,
    totalXpForNextLevel: xpForCurrentLevel + xpForNextLevel,
  };
}

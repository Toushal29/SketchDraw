export type DrawingChallenge = {
  id: string;
  prompt: string;
  constraints: string[];
  timeLimit: number;
  difficulty: "easy" | "medium" | "hard";
};

const CHALLENGES: DrawingChallenge[] = [
  { id: "house-3", prompt: "Draw a house", constraints: ["Use only 3 colors", "Under 60 seconds"], timeLimit: 60, difficulty: "easy" },
  { id: "face-circle", prompt: "Draw a face using only circles", constraints: ["Only circle shapes", "No freehand"], timeLimit: 90, difficulty: "easy" },
  { id: "landscape-5", prompt: "Draw a landscape", constraints: ["Max 5 strokes", "Under 45 seconds"], timeLimit: 45, difficulty: "medium" },
  { id: "robot-squares", prompt: "Draw a robot", constraints: ["Only rectangles and squares"], timeLimit: 120, difficulty: "medium" },
  { id: "one-line-cat", prompt: "Draw a cat", constraints: ["Single continuous line", "No lifting pen"], timeLimit: 60, difficulty: "hard" },
  { id: "city-iso", prompt: "Draw a city skyline", constraints: ["Isometric perspective", "Min 5 buildings"], timeLimit: 180, difficulty: "hard" },
  { id: "tree-no-erase", prompt: "Draw a tree with birds", constraints: ["No erasing", "Under 90 seconds"], timeLimit: 90, difficulty: "medium" },
  { id: "food-2colors", prompt: "Draw your favorite food", constraints: ["Only 2 colors"], timeLimit: 75, difficulty: "easy" },
  { id: "vehicle-geo", prompt: "Draw a vehicle", constraints: ["Only geometric shapes", "No curves"], timeLimit: 120, difficulty: "medium" },
  { id: "monster-5shapes", prompt: "Design a friendly monster", constraints: ["Max 5 shapes", "Must include eyes"], timeLimit: 90, difficulty: "easy" },
  { id: "space-noblack", prompt: "Draw a space scene", constraints: ["No black color", "Include a planet"], timeLimit: 150, difficulty: "hard" },
  { id: "underwater", prompt: "Draw an underwater scene", constraints: ["Only blue and green tones", "Min 3 creatures"], timeLimit: 120, difficulty: "medium" },
  { id: "mirror-sym", prompt: "Draw a butterfly", constraints: ["Perfectly symmetrical", "Under 2 minutes"], timeLimit: 120, difficulty: "hard" },
  { id: "emotion-abstract", prompt: "Draw an emotion without a face", constraints: ["Abstract only", "3 colors max"], timeLimit: 60, difficulty: "hard" },
];

export function dailyChallenge(): DrawingChallenge {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return CHALLENGES[dayOfYear % CHALLENGES.length];
}

export function randomChallenge(difficulty?: DrawingChallenge["difficulty"]): DrawingChallenge {
  const pool = difficulty ? CHALLENGES.filter(c => c.difficulty === difficulty) : CHALLENGES;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function allChallenges(): DrawingChallenge[] {
  return [...CHALLENGES];
}

export type ChallengeSession = {
  challenge: DrawingChallenge;
  startTime: number;
  remaining: number;
  running: boolean;
};

export function createChallengeTimer(
  challenge: DrawingChallenge,
  onTick: (remaining: number) => void,
  onComplete: () => void,
): { start: () => void; stop: () => void; pause: () => void; resume: () => void } {
  let interval: ReturnType<typeof setInterval> | undefined;
  let remaining = challenge.timeLimit;
  let paused = false;

  return {
    start() {
      remaining = challenge.timeLimit;
      paused = false;
      interval = setInterval(() => {
        if (paused) return;
        remaining--;
        onTick(remaining);
        if (remaining <= 0) {
          clearInterval(interval);
          onComplete();
        }
      }, 1000);
    },
    stop() { if (interval) clearInterval(interval); },
    pause() { paused = true; },
    resume() { paused = false; },
  };
}

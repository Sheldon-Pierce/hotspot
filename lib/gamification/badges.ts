export interface BadgeDef {
  key: string;
  name: string;
  description: string;
  icon: string; // emoji
  criteria: string;
}

export const BADGES: BadgeDef[] = [
  { key: "first-round", name: "First Round", icon: "🍺",
    description: "Your very first check-in.", criteria: "1 check-in" },
  { key: "explorer-5", name: "Explorer", icon: "🧭",
    description: "Checked in at 5 different bars.", criteria: "5 distinct bars" },
  { key: "explorer-10", name: "Trailblazer", icon: "🗺️",
    description: "Checked in at 10 different bars.", criteria: "10 distinct bars" },
  { key: "regular", name: "Regular", icon: "🪑",
    description: "10 check-ins at a single bar.", criteria: "10 check-ins at one bar" },
  { key: "night-owl", name: "Night Owl", icon: "🦉",
    description: "Checked in after midnight.", criteria: "check-in hour >= 0 and < 4" },
  { key: "neighborhood-champ", name: "Neighborhood Champ", icon: "👑",
    description: "#1 on the all-time neighborhood leaderboard.", criteria: "all-time #1 by total points" },
];

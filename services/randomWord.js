const randomWords = [
  "tea",
  "independence",
  "physics",
  "estate",
  "reality",
  "county",
  "psychology",
  "situation",
  "bird",
  "beer",
  "maintenance",
  "grocery",
  "family",
  "profession",
  "selection",
  "resolution",
  "area",
  "definition",
  "girl",
  "assumption",
  "imagination",
  "philosophy",
  "penalty",
  "recognition",
  "growth",
  "manager",
  "awareness",
  "meaning",
  "world",
  "country"
];

module.exports = {
  randomWord: () => randomWords[Math.floor(Math.random() * randomWords.length)]
};

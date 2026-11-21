export const HILLS = ['nano', 'tiny'];
export const HILL_SIZE = 10;
export const HILL_ROUNDS = 50;
export const HILL_SEED = 48172;
export const HILL_REVISION = 1;

const hillOption = {
  name: 'hill', type: 3, description: 'Choose the hill', required: true,
  choices: HILLS.map(hill => ({ name: hill, value: hill })),
};

export const ladderCommand = {
  name: 'ladder', type: 1, description: 'Show the current ZoreWars hill standings', options: [hillOption],
};

export const submitCommand = {
  name: 'submit', type: 1, description: 'Challenge a ZoreWars hill with a Redcode warrior',
  options: [hillOption, { name: 'warrior', type: 11, description: 'Warrior (.red file)', required: true }],
};

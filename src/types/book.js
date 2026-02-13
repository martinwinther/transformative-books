/**
 * @typedef {Object} Book
 * @property {string} author
 * @property {string} title
 * @property {number} rating
 * @property {string} justification
 * @property {string} expandedJustification
 * @property {string} transformativeExperience
 * @property {string} slug
 */

export const RATING_SCALE = [
  {
    level: 1,
    label: 'Easy to read',
    description:
      'Easy to read for anyone; can be enjoyed just for the story (though deeper symbolism may exist).',
  },
  {
    level: 2,
    label: 'Easy with depth',
    description: 'Easy to read but contains some deeper meaning if you look into it.',
  },
  {
    level: 3,
    label: 'Moderately difficult',
    description:
      'Moderately difficult for the average reader, but you can get through it without outside help.',
  },
  {
    level: 4,
    label: 'Difficult',
    description:
      'A difficult read; you might need to look up references or discuss parts of the writing to fully understand.',
  },
  {
    level: 5,
    label: 'Extremely difficult',
    description:
      'Extremely difficult to comprehend without companion materials; discussion with an expert or professor is advised.',
  },
]

import { CARD_PALETTES } from '../../services/cardsApi.js';
import './cards.css';

/**
 * A small flat swatch in the card's chosen colour, so cards are easy to tell
 * apart in lists. The colour is the user's (the card's `palette`).
 */
export default function CardMark({ palette, size = 'md', className = '' }) {
  const color = (CARD_PALETTES[palette] || CARD_PALETTES.obsidian).from;
  return (
    <span
      className={`card-mark card-mark--${size} ${className}`.trim()}
      style={{ '--card-mark-color': color }}
      aria-hidden="true"
    />
  );
}

import { useEffect, useState } from 'react';
import { fetchDues } from '../../services/cardsApi.js';

/**
 * Credit-card bills for the dashboard's "Needs attention" list: the same
 * read-only `GET /cards/dues` the Cards page shows. A failure only means no
 * bill rows; the rest of the dashboard does not depend on it.
 */
export function useCardDues() {
  const [dues, setDues] = useState([]);

  useEffect(() => {
    let alive = true;
    fetchDues()
      .then((res) => {
        if (alive) setDues(Array.isArray(res?.upcoming) ? res.upcoming : []);
      })
      .catch(() => {
        if (alive) setDues([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  return dues;
}

import { useCallback, useState } from 'react';
import {
  addCardTransactionFriend,
  deleteCardTransactionFriend,
  listCardTransactionFriends,
  updateCardTransaction,
} from '../services/cardsApi.js';

/**
 * Everything needed to manage card transactions the way bank transactions are
 * managed: category assignment, friend tags and splits, and the manage sheet.
 *
 * Card transactions surface in three places — a card's own ledger, the covered
 * list on a bill payment's detail page, and the nested rows under a bill
 * payment in the main ledger — so this lives in one place rather than three.
 *
 * @param categories  category list, used to patch rows locally after assigning
 * @param onRowPatched(txnId, patch)  apply a local field patch to the caller's copy of the row
 * @param onTagsChanged  optional; called after tags change, for callers that
 *                       want to refetch rather than trust the local update
 */
export function useCardTransactionManager({
  categories = [],
  onRowPatched,
  onTagsChanged,
} = {}) {
  const [tagsByTransaction, setTagsByTransaction] = useState({});
  const [tagsStatusByTransaction, setTagsStatusByTransaction] = useState({});
  const [categoryStatusByTransaction, setCategoryStatusByTransaction] = useState({});
  const [manageSheetId, setManageSheetId] = useState(null);
  const [splitApplyingTransactionId, setSplitApplyingTransactionId] = useState(null);

  /**
   * Seed the tag map from a list payload that already carries `friendTags`.
   * Merges by default so several independently-loaded groups (one per expanded
   * bill payment) can each seed without clobbering the others; pass
   * `{ replace: true }` when the payload is the complete set.
   */
  const seedTags = useCallback((rows, { replace = false } = {}) => {
    const seeded = {};
    for (const row of rows || []) seeded[row.id] = row.friendTags || [];
    setTagsByTransaction((prev) => (replace ? seeded : { ...prev, ...seeded }));
    if (replace) {
      setTagsStatusByTransaction({});
      setCategoryStatusByTransaction({});
    }
  }, []);

  const fetchTags = useCallback(async (txnId) => {
    setTagsStatusByTransaction((p) => ({ ...p, [txnId]: 'Loading tags...' }));
    try {
      const data = await listCardTransactionFriends(txnId);
      setTagsByTransaction((p) => ({ ...p, [txnId]: data.data || [] }));
      setTagsStatusByTransaction((p) => ({ ...p, [txnId]: '' }));
      onTagsChanged?.(txnId, data.data || []);
    } catch (e) {
      setTagsStatusByTransaction((p) => ({ ...p, [txnId]: e.message || 'Failed to fetch tags' }));
    }
  }, [onTagsChanged]);

  const assignCategory = useCallback(async (txnId, categoryId) => {
    setCategoryStatusByTransaction((p) => ({ ...p, [txnId]: 'Saving…' }));
    try {
      await updateCardTransaction(txnId, { categoryId: categoryId || null });
      const cat = categories.find((c) => String(c.id) === String(categoryId)) || null;
      onRowPatched?.(txnId, { categoryId: cat ? cat.id : null, category: cat });
      setCategoryStatusByTransaction((p) => ({ ...p, [txnId]: '' }));
    } catch {
      setCategoryStatusByTransaction((p) => ({ ...p, [txnId]: 'Failed to save' }));
    }
  }, [categories, onRowPatched]);

  const openManage = useCallback(async (txnId) => {
    setManageSheetId(txnId);
    if (!tagsByTransaction[txnId]) await fetchTags(txnId);
  }, [tagsByTransaction, fetchTags]);

  const closeManage = useCallback(() => setManageSheetId(null), []);

  const applySplit = useCallback(async (
    txnId,
    { results, direction, note, linkedTagsByParticipant },
  ) => {
    setTagsStatusByTransaction((p) => ({ ...p, [txnId]: '' }));
    setSplitApplyingTransactionId(txnId);
    const noteTrimmed = typeof note === 'string' ? note.trim() : '';
    try {
      for (const r of results) {
        const amountMinor = r.amountMinor;
        const lineDirection = amountMinor === 0 ? 'NOTHING_OUTSTANDING' : direction;
        const amountValue = amountMinor === 0 ? 0 : Number((amountMinor / 100).toFixed(2));
        const linkedIds = linkedTagsByParticipant?.[r.participantId];
        await addCardTransactionFriend(txnId, {
          friendId: Number(r.participantId),
          amount: amountValue,
          direction: lineDirection,
          ...(noteTrimmed ? { note: noteTrimmed } : {}),
          ...(lineDirection === 'SETTLEMENT' && linkedIds?.length > 0
            ? { linkedTransactionIds: linkedIds.map(Number) } : {}),
        });
      }
      setTagsStatusByTransaction((p) => ({ ...p, [txnId]: 'Split applied — friend tags added.' }));
      await fetchTags(txnId);
    } catch (e) {
      setTagsStatusByTransaction((p) => ({ ...p, [txnId]: e.message || 'Failed to apply split.' }));
    } finally {
      setSplitApplyingTransactionId(null);
    }
  }, [fetchTags]);

  const removeTag = useCallback(async (txnId, tagId) => {
    setTagsStatusByTransaction((p) => ({ ...p, [txnId]: 'Removing tag...' }));
    try {
      await deleteCardTransactionFriend(txnId, tagId);
      await fetchTags(txnId);
    } catch (e) {
      setTagsStatusByTransaction((p) => ({ ...p, [txnId]: e.message || 'Failed to delete tag' }));
    }
  }, [fetchTags]);

  /**
   * Props for TransactionManageSheet for a given card transaction, minus the
   * page-specific bits (`friends`, `actions`, `metaLine`).
   */
  const manageSheetPropsFor = useCallback((txn) => {
    if (!txn) return null;
    const amount = Number(txn.amount || 0);
    return {
      transaction: txn,
      date: txn.txnDate,
      amountIn: txn.isRefund ? amount : 0,
      amountOut: txn.isRefund ? 0 : amount,
      categories,
      categoryId: txn.categoryId,
      onAssignCategory: (value) => assignCategory(txn.id, value),
      categoryStatus: categoryStatusByTransaction[txn.id],
      tags: tagsByTransaction[txn.id] || [],
      tagsStatus: tagsStatusByTransaction[txn.id],
      splitApplying: splitApplyingTransactionId === txn.id,
      onApplySplit: (args) => applySplit(txn.id, args),
      onDeleteTag: (tagId) => removeTag(txn.id, tagId),
      onClose: closeManage,
    };
  }, [
    categories, assignCategory, categoryStatusByTransaction, tagsByTransaction,
    tagsStatusByTransaction, splitApplyingTransactionId, applySplit, removeTag, closeManage,
  ]);

  return {
    tagsByTransaction,
    setTagsByTransaction,
    tagsStatusByTransaction,
    categoryStatusByTransaction,
    manageSheetId,
    setManageSheetId,
    splitApplyingTransactionId,
    seedTags,
    fetchTags,
    assignCategory,
    openManage,
    closeManage,
    applySplit,
    removeTag,
    manageSheetPropsFor,
  };
}

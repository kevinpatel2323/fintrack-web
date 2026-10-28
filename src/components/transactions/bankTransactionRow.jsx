import { CreditCard } from 'lucide-react';
import { Badge } from '../ui';
import { accountHint, peopleFromTags } from './transactionListModel.js';

/** Maps a bank transaction into the shape TransactionTable renders. */
export function toBankTableRow(row, tagsByTransaction = {}) {
  const withdrawal = Number(row.withdrawal || 0);
  const deposit = Number(row.deposit || 0);
  const isIncome = deposit > 0;
  const cc = row.ccBillPayment;
  const tags = tagsByTransaction[row.id];

  return {
    id: row.id,
    raw: row,
    date: row.transactionDate,
    title: row.upiName || row.narration || '',
    subtitle: row.upiDescription || row.narration || row.upiBank,
    titleBadge: cc ? (
      <Badge size="sm" prefix={CreditCard} label={`CC bill${cc.cardLast4 ? ` · •• ${cc.cardLast4}` : ''}`} />
    ) : null,
    // The UPI remark, else the narration when it says more than the title.
    note: row.upiDescription || (row.narration && row.narration !== row.upiName ? row.narration : null),
    category: row.category,
    categoryId: row.categoryId,
    method: row.upiBank ? `UPI · ${row.upiBank}` : row.isManual ? 'Manual' : 'Bank',
    tagCount: tags === undefined ? null : tags.length,
    people: peopleFromTags(tags),
    amount: isIncome ? deposit : withdrawal,
    isIncome,
    expandable: Boolean(cc),
    // Phone-only extras (TransactionListRow): the row's subtitle reads
    // "Category · ••6001", and a card bill payment carries a compact marker.
    // The UPI remark and narration stay on the transaction page.
    mobileSubtitle: accountHint(row.accountNumber) || (row.isManual ? 'Manual' : null),
    mobileBadge: cc ? (
      <Badge size="sm" prefix={CreditCard} label={cc.cardLast4 ? `Bill ••${cc.cardLast4}` : 'Card bill'} title="Card bill payment" />
    ) : null,
    metaTrailing: null,
  };
}

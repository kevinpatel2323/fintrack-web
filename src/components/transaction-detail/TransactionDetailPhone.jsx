import { AlertCircle, Ellipsis, Link2, Unlink, Users } from 'lucide-react';
import { FriendTagCard } from '../FriendTagLedgerDisplay.jsx';
import { CategoryIcon } from '../common/Category.jsx';
import {
  Amount, Badge, Button, Dropdown, EmptyState, MobileActionBar, MobileList, MobileSection, PageBody,
  PageHeader, Skeleton,
} from '../ui';
import CardBillCard from './CardBillCard.jsx';
import { CategoryRow } from './CategoryRow.jsx';
import { DetailsList } from './DetailsPanel.jsx';
import { formatTxnDate } from './formatTxnDate.js';

/**
 * The transaction page on a phone (a pushed page: Back, no tab bar), laid out
 * the way Frappe's phone record pages are: one hero figure, the fields as an
 * inset group, then the sections, with the main action pinned at the bottom
 * and everything else in the header's `…`. State, data and handlers all
 * come from TransactionDetail; this is only the phone layout.
 */
export default function TransactionDetailPhone({
  tx,
  title,
  onBack,
  categories,
  onAssignCategory,
  categorySaving,
  tags,
  tagsLoading,
  ccLink,
  coveredRows,
  cardManager,
  canSplit,
  splitLabel,
  splitTotal,
  canLinkCc,
  onSplit,
  onLinkCc,
  onUnlinkCc,
  onRemoveTag,
  onTagsChanged,
}) {
  const withdrawal = Number(tx.withdrawal || 0);
  const deposit = Number(tx.deposit || 0);
  const isIncome = deposit > 0;
  const amount = isIncome ? deposit : withdrawal;
  const signed = isIncome ? amount : -amount;
  const hasPaise = Math.round(amount * 100) % 100 !== 0;
  const hasTags = tags.length > 0;
  const linked = Boolean(ccLink?.linked);

  const menu = [
    { items: [canLinkCc && { label: 'Link to card bill', icon: Link2, onClick: onLinkCc }].filter(Boolean) },
    { items: [linked && { label: 'Unlink card bill', icon: Unlink, theme: 'red', onClick: onUnlinkCc }].filter(Boolean) },
  ].filter((g) => g.items.length > 0);

  const category = tx.category;
  const categoryId = tx.categoryId != null && tx.categoryId !== '' ? String(tx.categoryId) : '';

  return (
    <>
      <PageHeader
        title="Transaction"
        back={onBack}
        mobileActions={menu.length > 0 ? (
          <Dropdown options={menu} label="Transaction actions">
            <Button variant="ghost" size="md" icon={Ellipsis} label="More actions" />
          </Dropdown>
        ) : null}
      />

      <PageBody className="txd-m">
        <section className="txd-m-hero" aria-label="Summary">
          <div className="txd-m-hero__who">
            <CategoryIcon category={category} size={40} />
            <h2 className="txd-m-hero__title">{title}</h2>
          </div>
          <Amount
            className="txd-m-hero__amount"
            value={signed}
            sign="always"
            decimals={hasPaise ? 2 : 0}
          />
          <p className="txd-m-hero__meta">
            {isIncome ? 'You received' : 'You paid'} · {formatTxnDate(tx.transactionDate)}
          </p>
          {(hasTags || linked || tx.isManual) && (
            <div className="txd-m-hero__badges">
              {hasTags && (
                <Badge
                  prefix={Users}
                  label={`Split with ${tags.length} ${tags.length === 1 ? 'person' : 'people'}`}
                />
              )}
              {linked && <Badge theme="blue" prefix={Link2} label="Card bill payment" />}
              {tx.isManual && <Badge label="Manual" />}
            </div>
          )}
        </section>

        <MobileSection title="Details">
          <DetailsList
            tx={tx}
            title={title}
            leading={(
              <CategoryRow
                categories={categories}
                value={categoryId}
                onChange={onAssignCategory}
                saving={categorySaving}
              />
            )}
          />
        </MobileSection>

        <MobileSection title="Split with people">
          {tagsLoading && !hasTags ? (
            <div className="txd-m-skeleton" aria-busy="true">
              <Skeleton height={44} />
            </div>
          ) : hasTags ? (
            <div className="txd-m-tags" role="list" aria-label="People on this transaction">
              {tags.map((tag) => (
                <FriendTagCard
                  key={tag.id}
                  tag={tag}
                  transaction={tx}
                  friendName={tag.friend?.name || `Friend #${tag.friendId}`}
                  onRemove={() => onRemoveTag(tag.id)}
                  onAllocationChanged={onTagsChanged}
                />
              ))}
            </div>
          ) : (
            <p className="txd-m-muted">
              {splitTotal > 0
                ? 'Not split with anyone yet. Split it to track who owes whom.'
                : 'Nothing to split on this transaction.'}
            </p>
          )}
        </MobileSection>

        {linked && (
          <CardBillCard
            ccLink={ccLink}
            rows={coveredRows}
            isMobile
            categories={categories}
            onAssignCategory={cardManager.assignCategory}
            onOpenManage={cardManager.openManage}
          />
        )}
      </PageBody>

      {canSplit && (
        <MobileActionBar>
          <Button size="lg" variant="solid" iconLeft={Users} label={splitLabel} onClick={onSplit} />
        </MobileActionBar>
      )}
    </>
  );
}

/** Phone loading and not-found states, under the same header. */
export function TransactionDetailPhoneStatus({ loading, error, onBack, backLabel }) {
  return (
    <>
      <PageHeader title="Transaction" back={onBack} />
      <PageBody className="txd-m">
        {loading ? (
          <div aria-busy="true">
            <section className="txd-m-hero">
              <div className="txd-m-hero__who">
                <Skeleton width={40} height={40} />
                <Skeleton height={18} width="55%" />
              </div>
              <Skeleton height={32} width={140} />
              <Skeleton height={14} width="45%" />
            </section>
            <MobileSection title="Details">
              <MobileList variant="inset" className="txd-m-skeleton-list">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="txd-m-skeleton-list__row">
                    <Skeleton height={14} width="28%" />
                    <Skeleton height={14} width="36%" />
                  </div>
                ))}
              </MobileList>
            </MobileSection>
          </div>
        ) : (
          <EmptyState
            className="txd-m-missing"
            icon={AlertCircle}
            title={error ? 'Could not load this transaction.' : 'Transaction not found.'}
            action={<Button size="lg" label={`Back to ${backLabel}`} onClick={onBack} />}
          />
        )}
      </PageBody>
    </>
  );
}

import { AlertCircle, Ellipsis, RefreshCw, RotateCw, Trash2 } from 'lucide-react';
import {
  Badge, Button, Dropdown, EmptyState, MobileActionBar, MobileList, MobileSection, PageBody, PageHeader, Skeleton,
} from '../../components/ui';
import { MemoDetailsList } from './memoDetailParts.jsx';
import { MemoAmount, MemoTile, UnverifiedBadge } from './memoParts.jsx';

/**
 * The memo's page on a phone (a pushed page: Back to /memos, no tab bar),
 * laid out like TransactionDetailPhone: the payee and one hero figure, then
 * the memo, the message and the details as sections, with "Save memo" in
 * the bottom action bar and Re-parse / Delete in the header's `…`. State,
 * data and handlers all come from pages/MemoDetail.jsx.
 */
export default function MemoDetailPhone({
  memo,
  detail,
  detailError,
  payee,
  accountNames,
  summaryLine,
  status,
  editor,
  message,
  dirty,
  saving,
  onSave,
  reparsing,
  onReparse,
  onDelete,
}) {
  const menu = [
    { items: [{ label: reparsing ? 'Re-parsing…' : 'Re-parse', icon: RotateCw, disabled: reparsing, onClick: onReparse }] },
    { items: [{ label: 'Delete', icon: Trash2, theme: 'red', onClick: onDelete }] },
  ];

  return (
    <>
      <PageHeader
        title="Memo"
        back="/memos"
        mobileActions={(
          <Dropdown options={menu} label="Memo actions">
            <Button variant="ghost" size="md" icon={Ellipsis} label="More actions" />
          </Dropdown>
        )}
      />

      <PageBody className="memos-dm">
        <section className="memos-dm-hero" aria-label="Summary">
          <div className="memos-dm-hero__who">
            <MemoTile memo={memo} size={40} />
            <h2 className="memos-dm-hero__title">{payee}</h2>
          </div>
          <MemoAmount className="memos-dm-hero__amount" memo={memo} />
          <p className="memos-dm-hero__meta">{summaryLine}</p>
          {(memo.senderVerified === false || status) && (
            <div className="memos-dm-hero__badges">
              {memo.senderVerified === false && <UnverifiedBadge size="md" />}
              {status && <Badge theme={status.theme} label={status.label} />}
            </div>
          )}
        </section>

        <MobileSection title="Memo">{editor}</MobileSection>
        <MobileSection title="Message">{message}</MobileSection>
        <MobileSection title="Details">
          <MemoDetailsList memo={memo} detail={detail} detailError={detailError} accountNames={accountNames} />
        </MobileSection>
      </PageBody>

      <MobileActionBar>
        <Button size="lg" variant="solid" label="Save memo" loading={saving} disabled={!dirty} onClick={onSave} />
      </MobileActionBar>
    </>
  );
}

/** Phone loading and couldn't-load states, under the same header. */
export function MemoDetailPhoneStatus({ loading, error, onRetry }) {
  return (
    <>
      <PageHeader title="Memo" back="/memos" />
      <PageBody className="memos-dm">
        {loading ? (
          <div aria-busy="true">
            <section className="memos-dm-hero">
              <div className="memos-dm-hero__who">
                <Skeleton width={40} height={40} />
                <Skeleton height={18} width="55%" />
              </div>
              <Skeleton height={32} width={140} />
              <Skeleton height={14} width="45%" />
            </section>
            <MobileSection title="Details">
              <MobileList variant="inset" className="memos-dm-skeleton">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="memos-dm-skeleton__row">
                    <Skeleton height={14} width="28%" />
                    <Skeleton height={14} width="36%" />
                  </div>
                ))}
              </MobileList>
            </MobileSection>
          </div>
        ) : (
          <EmptyState
            className="memos-dm-missing"
            icon={AlertCircle}
            title="Could not load this memo"
            description={error}
            action={<Button size="lg" iconLeft={RefreshCw} label="Try again" onClick={onRetry} />}
          />
        )}
      </PageBody>
    </>
  );
}

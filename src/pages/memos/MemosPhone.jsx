import { Ellipsis, NotebookPen, Plus, RotateCw, Search, Smartphone } from 'lucide-react';
import {
  Amount, Badge, Button, Dropdown, EmptyState, MobileList, MobileListItem, PageBody, PageHeader, Skeleton,
  TabButtons, TextInput,
} from '../../components/ui';
import ListToolbar from '../../components/common/ListToolbar.jsx';
import { TABS, fmtMemoTime, memoAccount, memoAmount, memoPayee, memoTime } from './memoModel.js';

function MemoRow({ row, onOpen }) {
  const payee = memoPayee(row);
  const amount = memoAmount(row);
  const account = memoAccount(row);
  const facts = [fmtMemoTime(memoTime(row)), account].filter(Boolean).join(' · ');
  return (
    <MobileListItem
      title={(
        <span className="memos-m-title">
          <span className="memos-m-title__text">{payee}</span>
          {row.senderVerified === false && <Badge size="sm" theme="amber" label="Unverified" />}
        </span>
      )}
      subtitle={(
        <>
          {facts}
          {' · '}
          {row.memo ? (
            <span className="memos-m-memo">{row.memo}</span>
          ) : (
            <span className="memos-m-add">Add memo</span>
          )}
        </>
      )}
      value={<Amount value={amount.value} sign={amount.sign} tone={amount.tone} decimals={amount.decimals} />}
      onClick={() => onOpen(row)}
    />
  );
}

/**
 * Memos on a phone (a pushed page under You): a pinned search with the four
 * segments, then the captured SMS as rows — payee and amount, then time,
 * account and the memo (or "Add memo"). A tap opens the same sheet as on
 * desktop, where the memo is written. Same state as pages/Memos.jsx; nothing
 * is fetched here.
 */
export default function MemosPhone({
  tab,
  onTabChange,
  withoutMemo,
  queryInput,
  onQueryInput,
  rows,
  count,
  pageSize,
  loading,
  loadingMore,
  error,
  onRetry,
  noMemos,
  emptyCopy,
  onOpen,
  onLoadMore,
  onConnect,
  onDevices,
  onReparseAll,
}) {
  let list;
  if (error) {
    list = (
      <EmptyState
        icon={NotebookPen}
        title="Could not load memos"
        description={error}
        action={<Button size="md" label="Try again" onClick={onRetry} />}
      />
    );
  } else if (noMemos) {
    list = (
      <EmptyState
        icon={NotebookPen}
        title="No memos yet"
        description="Connect your iPhone to start capturing bank SMS."
        action={<Button size="lg" variant="solid" iconLeft={Plus} label="Connect iPhone" onClick={onConnect} />}
      />
    );
  } else if (loading && rows.length === 0) {
    list = (
      <MobileList aria-label="Memos" aria-busy="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <MobileListItem
            key={i}
            title={<Skeleton as="span" className="memos-m-skeleton" height={14} width="55%" />}
            subtitle={<Skeleton as="span" className="memos-m-skeleton" height={11} width="75%" />}
          />
        ))}
      </MobileList>
    );
  } else if (rows.length === 0) {
    list = <EmptyState size="sm" title={emptyCopy.title} description={emptyCopy.description} />;
  } else {
    const more = Math.min(pageSize, count - rows.length);
    list = (
      <>
        <MobileList className="memos-m-list" aria-label="Memos">
          {rows.map((row) => <MemoRow key={row.id} row={row} onOpen={onOpen} />)}
        </MobileList>
        {more > 0 && (
          <div className="memos-m-more">
            <span className="memos-m-more__count">
              {rows.length} of {count}
            </span>
            <Button variant="subtle" size="md" label={`Show ${more} more`} loading={loadingMore} onClick={onLoadMore} />
          </div>
        )}
      </>
    );
  }

  // The search stays on screen through an error, so a search that failed can be changed.
  const showControls = !noMemos;

  return (
    <>
      <PageHeader
        title="Memos"
        mobileActions={(
          <>
            <Button variant="ghost" size="md" icon={Plus} label="Connect iPhone" onClick={onConnect} />
            <Dropdown
              label="Memos"
              options={[
                { label: 'Devices', icon: Smartphone, onClick: onDevices },
                { label: 'Re-parse all', icon: RotateCw, onClick: onReparseAll },
              ]}
            >
              <Button variant="ghost" size="md" icon={Ellipsis} label="More actions" />
            </Dropdown>
          </>
        )}
      />
      <PageBody className="memos-m">
        {showControls && (
          <ListToolbar className="memos-m-toolbar">
            <TextInput
              className="memos-m-search"
              type="search"
              size="md"
              prefix={Search}
              placeholder="Search memos"
              aria-label="Search memos"
              value={queryInput}
              onChange={(e) => onQueryInput(e.target.value)}
            />
            <TabButtons
              className="memos-m-segments"
              aria-label="Show"
              fluid
              value={tab}
              onChange={onTabChange}
              options={TABS.map((t) => ({
                value: t.id,
                label:
                  t.id === 'no-memo' && withoutMemo > 0 ? (
                    <>
                      {t.label}
                      <span className="memos-count">{withoutMemo}</span>
                    </>
                  ) : (
                    t.label
                  ),
              }))}
            />
          </ListToolbar>
        )}
        {list}
      </PageBody>
    </>
  );
}

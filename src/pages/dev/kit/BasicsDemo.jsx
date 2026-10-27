import { useState } from 'react';
import {
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  Download,
  Inbox,
  MoreHorizontal,
  Pencil,
  Plus,
  Receipt,
  Search,
  Settings,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import Alert from '../../../components/ui/Alert.jsx';
import Amount from '../../../components/ui/Amount.jsx';
import Avatar from '../../../components/ui/Avatar.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import AvatarGroup from '../../../components/ui/AvatarGroup.jsx';
import Card from '../../../components/ui/Card.jsx';
import Divider from '../../../components/ui/Divider.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import ErrorMessage from '../../../components/ui/ErrorMessage.jsx';
import KeyboardShortcut from '../../../components/ui/KeyboardShortcut.jsx';
import LoadingIndicator from '../../../components/ui/LoadingIndicator.jsx';
import Progress from '../../../components/ui/Progress.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import Spinner from '../../../components/ui/Spinner.jsx';
import StatCard from '../../../components/ui/StatCard.jsx';
import Tooltip from '../../../components/ui/Tooltip.jsx';

// Dev gallery for the Basics group: every component, every variant and state.
// Inline widths below only lay the gallery out (UiKit.css has no grid helper).

const VARIANTS = ['solid', 'subtle', 'outline', 'ghost'];
const BUTTON_THEMES = ['gray', 'blue', 'green', 'red'];
const SIZES = ['xs', 'sm', 'md', 'lg'];
const BADGE_THEMES = ['gray', 'blue', 'green', 'amber', 'red', 'violet'];
const AVATAR_SIZES = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'];
const ALERT_THEMES = ['gray', 'blue', 'green', 'amber', 'red'];

const w = (width) => ({ width });

function Group({ title, children }) {
  return (
    <div className="uikit-group">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function Row({ children }) {
  return <div className="uikit-row">{children}</div>;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function BasicsDemo() {
  const [progress, setProgress] = useState(40);
  const [dismissed, setDismissed] = useState({});
  const [toggled, setToggled] = useState(false);
  const [busy, setBusy] = useState(false);
  const dismiss = (key) => () => setDismissed((d) => ({ ...d, [key]: true }));

  const apiError = new Error('Request failed');
  apiError.messages = ['Amount must be greater than zero.', 'Pick a card for this payment.'];

  return (
    <section className="uikit-section">
      <h2>Basics</h2>

      {/* ---------------- Button ---------------- */}
      <Group title="Button · variant × theme (sm)">
        {VARIANTS.map((variant) => (
          <Row key={variant}>
            {BUTTON_THEMES.map((theme) => (
              <Button key={theme} variant={variant} theme={theme} label={`${variant} ${theme}`} />
            ))}
          </Row>
        ))}
      </Group>

      <Group title="Button · disabled">
        {VARIANTS.map((variant) => (
          <Row key={variant}>
            {BUTTON_THEMES.map((theme) => (
              <Button key={theme} variant={variant} theme={theme} label={`${variant} ${theme}`} disabled />
            ))}
          </Row>
        ))}
      </Group>

      <Group title="Button · active (held pressed: `active` or data-state open|active)">
        {VARIANTS.map((variant) => (
          <Row key={variant}>
            {BUTTON_THEMES.map((theme) => (
              <Button key={theme} variant={variant} theme={theme} label={`${variant} ${theme}`} active />
            ))}
          </Row>
        ))}
      </Group>

      <Group title="Button · sizes">
        <Row>
          {SIZES.map((size) => (
            <Button key={size} variant="solid" size={size} label={`Solid ${size}`} />
          ))}
        </Row>
        <Row>
          {SIZES.map((size) => (
            <Button key={size} size={size} iconLeft={Plus} label={`Add ${size}`} />
          ))}
        </Row>
        <Row>
          {SIZES.map((size) => (
            <Button key={size} variant="outline" size={size} label={`Export ${size}`} iconRight={Download} />
          ))}
        </Row>
      </Group>

      <Group title="Button · icon only (label → aria-label)">
        {VARIANTS.map((variant) => (
          <Row key={variant}>
            {SIZES.map((size) => (
              <Button key={size} variant={variant} size={size} icon={Settings} label="Settings" />
            ))}
            <Button variant={variant} theme="red" icon={Trash2} label="Delete" />
            <Button variant={variant} icon={MoreHorizontal} label="More" disabled />
          </Row>
        ))}
      </Group>

      <Group title="Button · loading">
        <Row>
          {SIZES.map((size) => (
            <Button key={size} variant="solid" size={size} label="Save" loading />
          ))}
          <Button label="Import" loading loadingText="Importing…" />
          <Button variant="outline" icon={Upload} label="Upload" loading />
          <Button
            variant="solid"
            theme="blue"
            label={busy ? 'Saving' : 'Click to load for 1.5s'}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await wait(1500);
              setBusy(false);
            }}
          />
        </Row>
      </Group>

      <Group title="Button · links, toggle, tooltip">
        <Row>
          <Button to="/transactions" variant="outline" label="Router link (to)" iconRight={ArrowRight} />
          <Button href="https://frappeui.com" variant="ghost" theme="blue" label="External (href)" />
          <Button to="/transactions" label="Disabled link → button" disabled />
          <Button
            variant="outline"
            icon={Star}
            label={toggled ? 'Unstar' : 'Star'}
            active={toggled}
            aria-pressed={toggled}
            onClick={() => setToggled((t) => !t)}
          />
          <Button variant="subtle" label="Filter" iconRight={ChevronDown} data-state="open" />
          <Button icon={Pencil} label="Edit" tooltip="Edit transaction" />
          <Button variant="solid" iconLeft={Plus} label="New transaction" tooltip="Add one by hand" />
        </Row>
      </Group>

      {/* ---------------- Badge ---------------- */}
      <Group title="Badge · variant × theme (md)">
        {VARIANTS.map((variant) => (
          <Row key={variant}>
            {BADGE_THEMES.map((theme) => (
              <Badge key={theme} variant={variant} theme={theme} label={theme} />
            ))}
          </Row>
        ))}
      </Group>

      <Group title="Badge · sizes, prefix / suffix, numbers">
        <Row>
          {['sm', 'md', 'lg'].map((size) => (
            <Badge key={size} size={size} theme="green" label={`Paid ${size}`} prefix={Check} />
          ))}
          {['sm', 'md', 'lg'].map((size) => (
            <Badge key={size} size={size} variant="outline" label={`Due ${size}`} suffix={<Bell />} />
          ))}
          <Badge theme="red" variant="solid" label={3} />
          <Badge label={0} />
          <Badge theme="amber">Children win over label</Badge>
        </Row>
      </Group>

      {/* ---------------- Avatar ---------------- */}
      <Group title="Avatar · sizes (initials from label, xs/sm show one letter)">
        <Row>
          {AVATAR_SIZES.map((size) => (
            <Avatar key={size} size={size} label="Het Patel (Sankalp)" />
          ))}
        </Row>
        <Row>
          {AVATAR_SIZES.map((size) => (
            <Avatar key={size} size={size} label="Swiggy" shape="square" theme="violet" />
          ))}
        </Row>
      </Group>

      <Group title="AvatarGroup · 7 people in 56 / 96 / 140 / 240px (fits what it can, +N lists the rest)">
        <Row>
          {[56, 96, 140, 240].map((w) => (
            <div key={w} style={{ width: w, border: '1px dashed var(--outline-gray-2)', padding: 4 }}>
              <AvatarGroup
                people={['Yash Patel', 'Kevin Patel', 'Jaimin Tank', 'Alchemy tech', 'Het Patel (Sankalp)', 'Meera Shah', 'Saral Gajjar'].map(
                  (name, i) => ({ id: String(i + 1), name, to: `/friends/${i + 1}` }),
                )}
              />
            </div>
          ))}
          <div style={{ width: 140, border: '1px dashed var(--outline-gray-2)', padding: 4 }}>
            <AvatarGroup people={[{ id: '9', name: 'Yash Patel' }, { id: '8', name: 'Kevin Patel' }]} />
          </div>
        </Row>
      </Group>

      <Group title="Avatar · themes, image, broken image, icon, indicator">
        <Row>
          {BADGE_THEMES.map((theme) => (
            <Avatar key={theme} size="xl" label={`${theme} Member`} theme={theme} />
          ))}
          <Avatar size="xl" image="/favicon.png" label="Fintrack" />
          <Avatar size="xl" image="/does-not-exist.png" label="Mira Wadhwa" />
          <Avatar size="xl" label="Receipts">
            <Receipt strokeWidth={1.5} />
          </Avatar>
          <Avatar size="xl" label="Yash Patel" indicator="green" />
          <Avatar size="2xl" label="Yash Patel" indicator="amber" />
          <Avatar size="md" label="Yash Patel" indicator="red" shape="square" />
          <Avatar size="lg" label="Anonymous" />
          <Avatar size="lg" />
        </Row>
      </Group>

      {/* ---------------- Spinner / LoadingIndicator / Skeleton ---------------- */}
      <Group title="Spinner · sizes, themes, track, inherit colour">
        <Row>
          {SIZES.map((size) => (
            <Spinner key={size} size={size} />
          ))}
          <Spinner size="lg" theme="gray" />
          <Spinner size="lg" theme="red" />
          <Spinner size="lg" theme="gray" track />
          <span className="text-ink-green-7">
            <Spinner size="lg" track />
          </span>
          <Spinner className="text-ink-blue-link" />
        </Row>
      </Group>

      <Group title="LoadingIndicator · spinner alias, and with text (LoadingText)">
        <Row>
          <LoadingIndicator size="md" />
          <LoadingIndicator text />
          <LoadingIndicator text="Saving…" />
        </Row>
      </Group>

      <Group title="Skeleton">
        <Row>
          <Skeleton circle width={32} height={32} />
          <div className="uikit-group" style={w(240)}>
            <Skeleton height={14} width="70%" />
            <Skeleton height={12} width="45%" />
          </div>
          <Skeleton width={120} height={28} />
          <Skeleton width={200} height={80} />
        </Row>
      </Group>

      {/* ---------------- Divider ---------------- */}
      <Group title="Divider · horizontal, vertical (flexItem), with action">
        <Divider />
        <Row>
          <span className="text-sm text-ink-gray-5">Left</span>
          <Divider orientation="vertical" flexItem />
          <span className="text-sm text-ink-gray-5">Right</span>
          <Divider orientation="vertical" flexItem />
          <Button size="xs" label="After rule" />
        </Row>
        <Divider action={{ label: 'Load older entries', onClick: () => {} }} />
        <Divider align="start" action={{ label: 'Start', iconLeft: Plus, onClick: () => {} }} />
        <Divider align="end" action={{ label: 'End', variant: 'subtle', onClick: () => {} }} />
      </Group>

      {/* ---------------- Progress ---------------- */}
      <Group title="Progress · sizes, label + hint, intervals, animation">
        <div style={w(420)} className="uikit-group">
          {['sm', 'md', 'lg', 'xl'].map((size) => (
            <Progress key={size} size={size} value={progress} />
          ))}
          <Progress size="md" value={progress} label="Statements imported" hint />
          <Progress size="lg" value={progress} intervals={5} label="Setup" hint={<span className="text-sm text-ink-gray-5">2 of 5 steps</span>} />
          <Progress size="md" value={140} label="Over budget (clamped)" hint />
          <Row>
            <Button size="xs" label="0" onClick={() => setProgress(0)} />
            <Button size="xs" label="40" onClick={() => setProgress(40)} />
            <Button size="xs" label="75" onClick={() => setProgress(75)} />
            <Button size="xs" label="100" onClick={() => setProgress(100)} />
          </Row>
        </div>
      </Group>

      {/* ---------------- Tooltip ---------------- */}
      <Group title="Tooltip · placements (hover 500ms, focus at once, Escape closes)">
        <Row>
          {['top', 'bottom', 'left', 'right', 'top-start', 'bottom-end'].map((placement) => (
            <Tooltip key={placement} text={`Placed ${placement}`} placement={placement}>
              <Button variant="outline" label={placement} />
            </Tooltip>
          ))}
          <Tooltip text="No delay" hoverDelay={0}>
            <Button variant="outline" theme="red" icon={Trash2} label="Delete" />
          </Tooltip>
          <Tooltip
            text={
              <span>
                Search <KeyboardShortcut combo="Mod+K" />
              </span>
            }
          >
            <Button icon={Search} label="Search" />
          </Tooltip>
          <Tooltip text="A longer explanation that wraps onto a second line once it runs past the tooltip's maximum width, so it never spans the screen.">
            <Button variant="ghost" label="Long text" />
          </Tooltip>
          <Tooltip text="You will not see this" disabled>
            <Button variant="ghost" label="Disabled tooltip" />
          </Tooltip>
          <Tooltip text="Tooltips also work on plain text">
            <span className="text-sm text-ink-gray-5" tabIndex={0}>
              Hover or tab to me
            </span>
          </Tooltip>
        </Row>
      </Group>

      {/* ---------------- Alert ---------------- */}
      <Group title="Alert · row (title only), every theme">
        {ALERT_THEMES.map((theme) =>
          dismissed[`row-${theme}`] ? null : (
            <Alert
              key={theme}
              theme={theme}
              title={`Row alert in ${theme}`}
              dismissible
              onDismiss={dismiss(`row-${theme}`)}
            />
          ),
        )}
        <Alert theme="blue" title="Statement for HDFC Regalia is ready to import" primaryAction={{ label: 'Import' }} />
        <Alert
          theme="green"
          title="Saved. Async action shows a spinner"
          primaryAction={{ label: 'Undo', onClick: () => wait(1200) }}
          dismissible
        />
        <Alert icon={false} title="No icon" />
        <Alert theme="amber" icon={Bell} title="Custom lucide icon" />
        <Alert prefix={<Spinner size="sm" />} title="Importing 248 transactions…" />
        <Row>
          <Button size="xs" variant="ghost" label="Restore dismissed alerts" onClick={() => setDismissed({})} />
        </Row>
      </Group>

      <Group title="Alert · banner (description or secondary action)">
        {!dismissed.review && (
          <Alert
            theme="amber"
            title="3 settlements need review"
            description="These were saved before amounts existed. Review them so People balances stay correct."
            primaryAction={{ label: 'Review now' }}
            secondaryAction={{ label: 'Later', onClick: ({ dismiss: close }) => close() }}
            onDismiss={dismiss('review')}
          />
        )}
        {!dismissed.banner && (
          <Alert
            theme="red"
            title="Card bill overdue"
            description="HDFC Millennia bill of ₹18,240 was due on 22 Oct."
            primaryAction={{ label: 'Mark as paid' }}
            dismissible
            onDismiss={dismiss('banner')}
          />
        )}
        <Alert theme="green" title="Description only" description="Banner layout without any actions." />
        <Alert
          title="Custom actions node"
          description="`actions` replaces the generated buttons and receives { dismiss }."
          actions={() => <Button size="md" variant="solid" label="Custom" />}
        />
      </Group>

      {/* ---------------- ErrorMessage ---------------- */}
      <Group title="ErrorMessage · string, list, Error with messages, Error, empty (renders nothing)">
        <ErrorMessage message="Enter an amount." />
        <ErrorMessage message={['Date is required.', 'Description is required.']} />
        <ErrorMessage message={apiError} />
        <ErrorMessage message={new Error('Network error, try again.')} />
        <ErrorMessage message="" />
      </Group>

      {/* ---------------- KeyboardShortcut ---------------- */}
      <Group title="KeyboardShortcut · plain">
        <Row>
          <KeyboardShortcut combo="Mod+K" />
          <KeyboardShortcut combo="Mod+Shift+P" />
          <KeyboardShortcut combo="Ctrl+Alt+Delete" />
          <KeyboardShortcut combo="Shift+F2" />
          <KeyboardShortcut combo="Mod+Enter" />
          <KeyboardShortcut combo="ArrowUp" altCombos={['ArrowDown']} />
          <KeyboardShortcut combo="Ctrl+K" showPlus={false} />
          <KeyboardShortcut combo="Mod+Slash" useIcons={false} />
          <KeyboardShortcut>Fallback text</KeyboardShortcut>
        </Row>
      </Group>

      <Group title="KeyboardShortcut · bg (chips)">
        <Row>
          <KeyboardShortcut bg combo="Mod+K" />
          <KeyboardShortcut bg combo="Mod+Shift+P" />
          <KeyboardShortcut bg combo="Escape" />
          <KeyboardShortcut bg combo="Enter" />
          <KeyboardShortcut bg combo="Alt+ArrowLeft" />
          <KeyboardShortcut bg combo="Mod+Z" altCombos={['Mod+Shift+Z', 'Ctrl+Y']} />
        </Row>
      </Group>

      {/* ---------------- EmptyState ---------------- */}
      <Group title="EmptyState · md, and sm inside a card">
        <Row>
          <Card style={w(420)} padding="none">
            <EmptyState
              icon={Inbox}
              title="No transactions this month"
              description="Import a statement or add a transaction by hand."
              action={<Button variant="solid" iconLeft={Upload} label="Import statement" />}
            />
          </Card>
          <Card style={w(300)} title="Recent transactions">
            <EmptyState size="sm" icon={Receipt} title="Nothing yet" description="New spends show up here." />
          </Card>
          <Card style={w(300)} title="Title only">
            <EmptyState size="sm" title="No upcoming bills" />
          </Card>
        </Row>
      </Group>

      {/* ---------------- Card ---------------- */}
      <Group title="Card · header, actions, footer, paddings">
        <Row>
          <Card
            style={w(320)}
            as="section"
            title="Spending by category"
            description="October 2026"
            actions={<Button variant="ghost" size="sm" icon={MoreHorizontal} label="More" />}
            footer={<Button variant="ghost" size="sm" label="View all" iconRight={ArrowRight} />}
          >
            <p className="text-p-base text-ink-gray-7">Body content sits 12px under the header.</p>
          </Card>
          <Card style={w(260)} title="padding sm" padding="sm" actions={<Badge theme="green" label="Live" />}>
            <p className="text-p-sm text-ink-gray-7">Tighter inset for side panels.</p>
          </Card>
          <Card style={w(260)} title="padding none" padding="none" footer={<span className="text-sm text-ink-gray-5">Footer strip</span>}>
            <div>
              {['Swiggy', 'Uber', 'Amazon'].map((name, i) => (
                <div key={name}>
                  {i > 0 && <Divider />}
                  <div className="uikit-row" style={{ padding: '8px 16px', justifyContent: 'space-between' }}>
                    <span className="text-base text-ink-gray-8">{name}</span>
                    <Amount value={-(i + 1) * 420} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card style={w(220)}>
            <p className="text-p-base text-ink-gray-7">No header at all.</p>
          </Card>
        </Row>
      </Group>

      {/* ---------------- StatCard ---------------- */}
      <Group title="StatCard · deltas, tones, states">
        <Row>
          <div style={w(220)}>
            <StatCard label="Spent this month" value={<Amount value={127450} tone="inherit" />} delta={12.4} deltaLabel="vs last month" positiveIsGood={false} />
          </div>
          <div style={w(220)}>
            <StatCard label="Money in" value={<Amount value={210000} tone="inherit" />} delta={-3.25} deltaLabel="vs last month" />
          </div>
          <div style={w(220)}>
            <StatCard label="Savings rate" value="38%" delta={5} deltaLabel="vs last month" />
          </div>
          <div style={w(220)}>
            <StatCard label="Transactions" value={1284} delta={0} deltaLabel="no change" />
          </div>
          <div style={w(220)}>
            <StatCard label="Owed to you" value={<Amount value={18240} tone="inherit" compact />} hint="Across 4 people" />
          </div>
          <div style={w(220)}>
            <StatCard label="Loading" loading />
          </div>
          <div style={w(220)}>
            <StatCard label="No value yet" value={null} />
          </div>
          <div style={w(220)}>
            <StatCard label="As a link (to)" value={<Amount value={-6400} tone="inherit" />} delta={8} deltaLabel="vs last week" to="/transactions" />
          </div>
          <div style={w(220)}>
            <StatCard label="As a button (onClick)" value="12" deltaLabel="statements to import" onClick={() => {}} />
          </div>
        </Row>
      </Group>

      {/* ---------------- Amount ---------------- */}
      <Group title="Amount · sign × tone">
        <Row>
          <Amount value={6265} sign="always" />
          <Amount value={-67} sign="always" />
          <Amount value={0} sign="always" />
          <Amount value={-1250} />
          <Amount value={1250} />
          <Amount value={-1250} sign="never" />
        </Row>
        <Row>
          <Amount value={18240} tone="due" />
          <Amount value={18240} tone="muted" />
          <span className="text-ink-blue-link">
            <Amount value={18240} tone="inherit" /> (inherit)
          </span>
          <Amount value={-500} tone="in" />
          <Amount value={500} tone="out" />
        </Row>
        <Row>
          <Amount value={1234567.891} decimals={2} />
          <Amount value={12500000} compact />
          <Amount value={-245000} compact />
          <Amount value={8450} compact sign="always" />
          <Amount value={null} />
          <Amount value="not a number" />
          <span className="text-3xl font-semibold">
            <Amount value={127450} tone="inherit" />
          </span>
        </Row>
      </Group>
    </section>
  );
}

import { useEffect, useState } from 'react';
import Portal from './Portal.jsx';
import { GhostBtn, PrimaryBtn, Overline } from './ui/primitives.jsx';
import CardFace from './ui/CardFace.jsx';
import { IcClose } from './ui/Icon.jsx';
import { BANK_TINTS, CARD_PALETTES, NETWORKS, createCard, updateCard } from '../services/cardsApi.js';

const BANK_OPTIONS = Object.entries(BANK_TINTS).map(([key, v]) => ({ key, label: v.name }));

const emptyForm = {
  kind: 'credit',
  bank: 'hdfc',
  network: 'visa',
  name: '',
  nickname: '',
  last4: '',
  expiryMonth: '',
  expiryYear: '',
  holder: '',
  palette: 'obsidian',
  creditLimit: '',
  statementDay: '',
  dueDay: '',
  linkedAccountNumber: '',
  dailyLimit: '',
  atmLimit: '',
  pointsLabel: '',
  pointsBalance: '',
  pointsValue: '',
  isPrimary: false,
  notes: '',
};

export default function CardFormModal({ initial = null, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ ...emptyForm, ...(initial || {}) }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initial) {
      setForm({
        ...emptyForm,
        ...initial,
        creditLimit: initial.creditLimit ?? '',
        statementDay: initial.statementDay ?? '',
        dueDay: initial.dueDay ?? '',
        dailyLimit: initial.dailyLimit ?? '',
        atmLimit: initial.atmLimit ?? '',
        pointsBalance: initial.pointsBalance ?? '',
        pointsValue: initial.pointsValue ?? '',
        nickname: initial.nickname ?? '',
        holder: initial.holder ?? '',
        linkedAccountNumber: initial.linkedAccountNumber ?? '',
        pointsLabel: initial.pointsLabel ?? '',
        notes: initial.notes ?? '',
      });
    }
  }, [initial]);

  const set = (k) => (e) => {
    const v = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [k]: v }));
  };

  const previewCard = {
    ...form,
    last4: form.last4 || '0000',
    name: form.name || 'Card Name',
    holder: form.holder || 'CARDHOLDER',
    expiryMonth: form.expiryMonth ? Number(form.expiryMonth) : 12,
    expiryYear: form.expiryYear ? Number(form.expiryYear) : 2030,
    frozen: false,
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        kind: form.kind,
        bank: form.bank,
        network: form.network,
        name: form.name.trim(),
        nickname: form.nickname.trim() || null,
        last4: form.last4.trim(),
        expiryMonth: Number(form.expiryMonth),
        expiryYear: Number(form.expiryYear),
        holder: form.holder.trim() || null,
        palette: form.palette,
        isPrimary: !!form.isPrimary,
        notes: form.notes.trim() || null,
      };
      if (form.kind === 'credit') {
        payload.creditLimit = form.creditLimit === '' ? null : Number(form.creditLimit);
        payload.statementDay = form.statementDay === '' ? null : Number(form.statementDay);
        payload.dueDay = form.dueDay === '' ? null : Number(form.dueDay);
        payload.pointsLabel = form.pointsLabel.trim() || null;
        payload.pointsBalance = form.pointsBalance === '' ? 0 : Number(form.pointsBalance);
        payload.pointsValue = form.pointsValue === '' ? 0 : Number(form.pointsValue);
      } else {
        payload.linkedAccountNumber = form.linkedAccountNumber.trim() || null;
        payload.dailyLimit = form.dailyLimit === '' ? null : Number(form.dailyLimit);
        payload.atmLimit = form.atmLimit === '' ? null : Number(form.atmLimit);
      }
      const saved = initial?.id ? await updateCard(initial.id, payload) : await createCard(payload);
      onSaved?.(saved);
    } catch (err) {
      setError(err.message || 'Failed to save card');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Portal>
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--ft-scrim)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          zIndex: 1000,
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose?.();
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 760,
            maxHeight: '92vh',
            overflow: 'auto',
            background: 'var(--ft-surface)',
            border: '1px solid var(--ft-border)',
            borderRadius: 20,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid var(--ft-border)',
              position: 'sticky',
              top: 0,
              background: 'var(--ft-surface)',
              zIndex: 1,
            }}
          >
            <div>
              <Overline>{initial ? 'Edit card' : 'Add card'}</Overline>
              <h2 style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 600 }}>
                {initial ? form.name || initial.name : 'New card'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'transparent',
                border: 0,
                color: 'var(--ft-text-dim)',
                cursor: 'pointer',
                padding: 6,
              }}
            >
              <IcClose size={18} />
            </button>
          </div>

          <form onSubmit={submit} style={{ padding: 20, display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <CardFace card={previewCard} width={300} height={185} privacy={false} />
            </div>

            {/* Kind toggle */}
            <Field label="Card type">
              <SegmentedControl
                value={form.kind}
                onChange={set('kind')}
                options={[
                  { value: 'credit', label: 'Credit' },
                  { value: 'debit', label: 'Debit' },
                ]}
              />
            </Field>

            <Row>
              <Field label="Bank">
                <Select value={form.bank} onChange={set('bank')}>
                  {BANK_OPTIONS.map((b) => (
                    <option key={b.key} value={b.key}>
                      {b.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Network">
                <Select value={form.network} onChange={set('network')}>
                  {NETWORKS.map((n) => (
                    <option key={n.key} value={n.key}>
                      {n.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </Row>

            <Row>
              <Field label="Card name" required>
                <Input value={form.name} onChange={set('name')} required maxLength={120} placeholder="Infinia Metal" />
              </Field>
              <Field label="Nickname (optional)">
                <Input value={form.nickname} onChange={set('nickname')} maxLength={120} placeholder="HDFC · Infinia" />
              </Field>
            </Row>

            <Row>
              <Field label="Last 4 digits" required>
                <Input
                  value={form.last4}
                  onChange={set('last4')}
                  required
                  maxLength={4}
                  pattern="\d{4}"
                  inputMode="numeric"
                  placeholder="4892"
                />
              </Field>
              <Field label="Cardholder name">
                <Input value={form.holder} onChange={set('holder')} maxLength={120} placeholder="AARAV SINGH" />
              </Field>
            </Row>

            <Row>
              <Field label="Expiry month" required>
                <Input
                  value={form.expiryMonth}
                  onChange={set('expiryMonth')}
                  required
                  type="number"
                  min="1"
                  max="12"
                  placeholder="MM"
                />
              </Field>
              <Field label="Expiry year" required>
                <Input
                  value={form.expiryYear}
                  onChange={set('expiryYear')}
                  required
                  type="number"
                  min="2024"
                  max="2099"
                  placeholder="YYYY"
                />
              </Field>
            </Row>

            <Field label="Theme">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {Object.entries(CARD_PALETTES).map(([key, p]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => set('palette')(key)}
                    aria-label={p.label}
                    style={{
                      width: 50,
                      height: 32,
                      borderRadius: 8,
                      background: `linear-gradient(135deg, ${p.from}, ${p.to})`,
                      border:
                        form.palette === key
                          ? `2px solid ${p.accent === '#0A0B0E' ? '#fff' : p.accent}`
                          : '2px solid transparent',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  />
                ))}
              </div>
            </Field>

            {form.kind === 'credit' ? (
              <>
                <Row>
                  <Field label="Credit limit (₹)">
                    <Input value={form.creditLimit} onChange={set('creditLimit')} type="number" min="0" placeholder="800000" />
                  </Field>
                  <Field label="Statement day (1–31)">
                    <Input value={form.statementDay} onChange={set('statementDay')} type="number" min="1" max="31" placeholder="25" />
                  </Field>
                </Row>
                <Row>
                  <Field label="Due day (1–31)">
                    <Input value={form.dueDay} onChange={set('dueDay')} type="number" min="1" max="31" placeholder="14" />
                  </Field>
                  <Field label="Rewards label">
                    <Input value={form.pointsLabel} onChange={set('pointsLabel')} maxLength={80} placeholder="Reward Points" />
                  </Field>
                </Row>
                <Row>
                  <Field label="Rewards balance">
                    <Input value={form.pointsBalance} onChange={set('pointsBalance')} type="number" min="0" placeholder="0" />
                  </Field>
                  <Field label="Rewards value (₹)">
                    <Input value={form.pointsValue} onChange={set('pointsValue')} type="number" min="0" placeholder="0" />
                  </Field>
                </Row>
              </>
            ) : (
              <>
                <Field label="Linked account">
                  <Input
                    value={form.linkedAccountNumber}
                    onChange={set('linkedAccountNumber')}
                    maxLength={50}
                    placeholder="HDFC · Savings ····4221"
                  />
                </Field>
                <Row>
                  <Field label="Daily limit (₹)">
                    <Input value={form.dailyLimit} onChange={set('dailyLimit')} type="number" min="0" placeholder="100000" />
                  </Field>
                  <Field label="ATM limit (₹)">
                    <Input value={form.atmLimit} onChange={set('atmLimit')} type="number" min="0" placeholder="25000" />
                  </Field>
                </Row>
              </>
            )}

            <Field label="Notes">
              <textarea
                value={form.notes}
                onChange={set('notes')}
                maxLength={2000}
                rows={2}
                style={{
                  width: '100%',
                  background: 'var(--ft-surface-2)',
                  border: '1px solid var(--ft-border)',
                  color: 'var(--ft-text)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontFamily: 'var(--ft-font-ui)',
                  fontSize: 13.5,
                  resize: 'vertical',
                }}
              />
            </Field>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ft-text)', fontSize: 13.5 }}>
              <input
                type="checkbox"
                checked={!!form.isPrimary}
                onChange={(e) => setForm((f) => ({ ...f, isPrimary: e.target.checked }))}
              />
              Set as primary card
            </label>

            {error && (
              <div style={{ color: 'var(--ft-spend)', fontSize: 13 }}>{error}</div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <GhostBtn onClick={onClose} type="button">
                Cancel
              </GhostBtn>
              <PrimaryBtn type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : initial ? 'Save changes' : 'Add card'}
              </PrimaryBtn>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}

function Row({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>;
}

function Field({ label, required, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ color: 'var(--ft-text-dim)', fontSize: 11.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
        {required && <span style={{ color: 'var(--ft-spend)', marginLeft: 4 }}>*</span>}
      </span>
      {children}
    </label>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      style={{
        background: 'var(--ft-surface-2)',
        border: '1px solid var(--ft-border)',
        color: 'var(--ft-text)',
        borderRadius: 10,
        padding: '10px 12px',
        fontFamily: 'var(--ft-font-ui)',
        fontSize: 13.5,
        outline: 'none',
        ...(props.style || {}),
      }}
    />
  );
}

function Select({ children, ...rest }) {
  return (
    <select
      {...rest}
      style={{
        background: 'var(--ft-surface-2)',
        border: '1px solid var(--ft-border)',
        color: 'var(--ft-text)',
        borderRadius: 10,
        padding: '10px 12px',
        fontFamily: 'var(--ft-font-ui)',
        fontSize: 13.5,
        outline: 'none',
      }}
    >
      {children}
    </select>
  );
}

function SegmentedControl({ value, onChange, options }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        background: 'var(--ft-surface-2)',
        padding: 4,
        borderRadius: 10,
        gap: 2,
      }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          style={{
            border: 0,
            background: value === opt.value ? 'var(--ft-bg)' : 'transparent',
            color: value === opt.value ? 'var(--ft-text)' : 'var(--ft-text-dim)',
            padding: '7px 14px',
            borderRadius: 8,
            fontFamily: 'var(--ft-font-ui)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

'use client';

import { useRef, useState } from 'react';
import { parseGuestListFile, type GuestRow } from '@/lib/guestList';
import { LANDING_STRINGS, type Lang } from '@/lib/i18n';
import { BRANDS, type BrandKey } from '@/lib/brands';

interface SendResult {
  email: string;
  ok: boolean;
  error?: string;
}

export default function InviteEmailPanel({
  organizerToken,
  albumName,
  brand,
  lang = 'es',
}: {
  organizerToken: string;
  albumName: string;
  brand: BrandKey;
  lang?: Lang;
}) {
  const t = LANDING_STRINGS[lang];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const [configOpen, setConfigOpen] = useState(false);
  const [subject, setSubject] = useState<string>(t.defaultInviteSubject(albumName));
  const [senderName, setSenderName] = useState<string>(BRANDS[brand].name);
  const [bodyText, setBodyText] = useState<string>(t.defaultInviteBody);

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [results, setResults] = useState<SendResult[] | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResults(null);
    setSendError(null);
    setParseError(null);
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = await parseGuestListFile(buffer);
      setGuests(parsed.guests);
      setSkipped(parsed.skipped);
    } catch {
      setGuests([]);
      setSkipped([]);
      setParseError('No se pudo leer el archivo. Probá exportarlo de nuevo como .xlsx o .csv.');
    }
  }

  async function handleSend(guestsToSend: GuestRow[]) {
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/albums/${organizerToken}/invite-emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guests: guestsToSend, subject, senderName, bodyText }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 503 && data.error === 'not_configured') {
        setSendError(t.emailNotConfigured);
        return;
      }
      if (!res.ok) {
        setSendError(data.error ?? 'No se pudo enviar.');
        return;
      }
      setResults((prev) => {
        const prevOthers = prev ? prev.filter((r) => !guestsToSend.some((g) => g.email === r.email)) : [];
        return [...prevOthers, ...(data.results as SendResult[])];
      });
    } catch {
      setSendError('No se pudo enviar. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setSending(false);
    }
  }

  const failedGuests = results ? guests.filter((g) => results.some((r) => r.email === g.email && !r.ok)) : [];
  const okCount = results ? results.filter((r) => r.ok).length : 0;
  const failCount = results ? results.filter((r) => !r.ok).length : 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-brand-dark">{t.inviteEmailsTitle}</p>
      <p className="mt-1 text-xs text-gray-500">{t.inviteEmailsHint}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          {fileName ? t.changeFile : t.chooseFile}
        </button>
        {fileName && <span className="truncate text-xs text-gray-400">{fileName}</span>}
        {guests.length > 0 && (
          <button
            type="button"
            onClick={() => setConfigOpen(true)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            {t.configureMessage}
          </button>
        )}
      </div>

      {parseError && <p className="mt-2 text-xs text-red-600">{parseError}</p>}

      {guests.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          {guests.length === 1 ? t.guestsReadySingular(guests.length) : t.guestsReadyPlural(guests.length)}
        </p>
      )}

      {skipped.length > 0 && (
        <details className="mt-2 text-xs text-amber-700">
          <summary className="cursor-pointer">
            {skipped.length === 1 ? t.skippedRowsSingular(skipped.length) : t.skippedRowsPlural(skipped.length)}
          </summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {skipped.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </details>
      )}

      {sendError && <p className="mt-2 text-xs text-red-600">{sendError}</p>}

      {guests.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            disabled={sending}
            onClick={() => handleSend(guests)}
            className="w-full rounded-lg bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {sending
              ? t.sendingEmails
              : guests.length === 1
                ? t.sendToGuestsSingular(guests.length)
                : t.sendToGuestsPlural(guests.length)}
          </button>
          {sending && <p className="mt-1.5 text-center text-xs text-gray-400">{t.sendingEmailsHint}</p>}
        </div>
      )}

      {results && (
        <div className="mt-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
          <p>{t.sentSummary(okCount, failCount)}</p>
          {failedGuests.length > 0 && (
            <>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-red-600">
                {results
                  .filter((r) => !r.ok)
                  .map((r) => (
                    <li key={r.email}>
                      {r.email}
                      {r.error ? ` — ${r.error}` : ''}
                    </li>
                  ))}
              </ul>
              <button
                type="button"
                disabled={sending}
                onClick={() => handleSend(failedGuests)}
                className="mt-2 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {t.retryFailed}
              </button>
            </>
          )}
        </div>
      )}

      {configOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setConfigOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-paper p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-serif-title text-lg text-brand-dark">{t.configureMessage}</h2>
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">{t.subjectLabel}</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">{t.senderNameLabel}</label>
                <input
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">{t.messageLabel}</label>
                <textarea
                  rows={6}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  className="mt-1 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                />
                <p className="mt-1 text-xs text-gray-400">{t.messageHint}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfigOpen(false)}
                className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => setConfigOpen(false)}
                className="flex-1 rounded-lg bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-dark"
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

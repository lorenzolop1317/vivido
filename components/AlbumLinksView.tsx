'use client';

// Vista de los tres enlaces de un álbum (organizador/invitados/solo ver) +
// QR del enlace de invitados + envío de invitaciones por email. La usa
// CreateAlbumForm justo después de crear el álbum, y también
// app/links/[token]/page.tsx para poder volver a verlos más adelante si el
// organizador los pierde (el panel de super usuario tiene un botón "Enlaces
// Web" que lleva ahí).

import { useState } from 'react';
import dynamic from 'next/dynamic';
import QRCode from 'qrcode';
import type { BrandKey } from '@/lib/brands';
import { LANDING_STRINGS, type Lang } from '@/lib/i18n';

// Carga diferida: InviteEmailPanel arrastra la librería de lectura de Excel,
// que solo hace falta si el organizador realmente sube una lista de
// invitados. Así no infla el JS que se descarga solo para ver los enlaces.
const InviteEmailPanel = dynamic(() => import('./InviteEmailPanel'), { ssr: false });

type RoleLinks = Record<'organizer' | 'contributor' | 'viewer', string>;

export default function AlbumLinksView({
  albumName,
  brand,
  lang = 'es',
  links,
}: {
  albumName: string;
  brand: BrandKey;
  lang?: Lang;
  links: RoleLinks;
}) {
  const t = LANDING_STRINGS[lang];
  const roleLabels: Record<keyof RoleLinks, { title: string; hint: string }> = {
    organizer: { title: t.roleOrganizerTitle, hint: t.roleOrganizerHint },
    contributor: { title: t.roleContributorTitle, hint: t.roleContributorHint },
    viewer: { title: t.roleViewerTitle, hint: t.roleViewerHint },
  };
  const [copiedRole, setCopiedRole] = useState<string | null>(null);
  const [qrOpenRole, setQrOpenRole] = useState<string | null>(null);
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});

  async function copyLink(role: string, path: string) {
    const fullUrl = `${window.location.origin}${path}`;
    await navigator.clipboard.writeText(fullUrl);
    setCopiedRole(role);
    setTimeout(() => setCopiedRole(null), 2000);
  }

  async function toggleQr(role: string, path: string) {
    if (qrOpenRole === role) {
      setQrOpenRole(null);
      return;
    }
    if (!qrDataUrls[role]) {
      const fullUrl = `${window.location.origin}${path}`;
      const dataUrl = await QRCode.toDataURL(fullUrl, { width: 480, margin: 1 });
      setQrDataUrls((prev) => ({ ...prev, [role]: dataUrl }));
    }
    setQrOpenRole(role);
  }

  return (
    <div className="space-y-4">
      {(Object.keys(links) as Array<keyof RoleLinks>).map((role) => (
        <div key={role} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-brand-dark">{roleLabels[role].title}</p>
          <p className="mt-1 text-xs text-gray-500">{roleLabels[role].hint}</p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-gray-50 px-2 py-1.5 text-xs text-gray-700">{links[role]}</code>
            <button
              onClick={() => copyLink(role, links[role])}
              className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark"
            >
              {copiedRole === role ? t.copiedButton : t.copyButton}
            </button>
            {role === 'contributor' && (
              <button
                onClick={() => toggleQr(role, links[role])}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                {qrOpenRole === role ? t.hideQr : t.showQr}
              </button>
            )}
          </div>
          {role === 'contributor' && qrOpenRole === role && qrDataUrls[role] && (
            <div className="mt-3 flex flex-col items-center gap-2 border-t border-gray-100 pt-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrls[role]} alt={roleLabels.contributor.title} className="h-40 w-40" />
              <p className="text-center text-xs text-gray-500">{t.qrHint}</p>
              <a
                href={qrDataUrls[role]}
                download={`qr-invitados-${albumName || 'album'}.png`}
                className="text-xs font-medium text-brand underline hover:text-brand-dark"
              >
                {t.downloadQr}
              </a>
            </div>
          )}
        </div>
      ))}
      <InviteEmailPanel organizerToken={links.organizer.replace('/a/', '')} albumName={albumName} brand={brand} lang={lang} />
    </div>
  );
}

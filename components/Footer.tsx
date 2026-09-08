'use client';

import { useState } from 'react';

// Datos de contacto de la app — cambiar acá cuando haya un email/teléfono
// definitivo (o uno propio por marca blanca, si más adelante se arma una
// versión para otra empresa).
const CONTACT_EMAIL = 'hola@vivido.app';

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17" cy="7" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4.5 7 7.5 6 7.5-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type FormState = 'idle' | 'sending' | 'sent' | 'error';

export default function Footer() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    setError(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo enviar el mensaje.');
      setState('sent');
      setName('');
      setEmail('');
      setMessage('');
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Error inesperado.');
    }
  }

  return (
    <footer className="mt-16 border-t border-gray-200 bg-white/60">
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 sm:px-6 md:grid-cols-2">
        <div>
          <p className="font-display text-2xl text-brand-dark">Vívido</p>
          <p className="mt-2 max-w-xs text-sm text-gray-500">
            Un enlace, y todos los que estuvieron suben sus fotos y videos a un mismo álbum. Sin apps, sin login.
          </p>
          <div className="mt-4 space-y-1.5 text-sm text-gray-600">
            <a href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-2 hover:text-brand">
              <MailIcon className="h-4 w-4" />
              {CONTACT_EMAIL}
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 hover:text-brand"
            >
              <InstagramIcon className="h-4 w-4" />
              @vivido.app
            </a>
          </div>
          <p className="mt-6 text-xs text-gray-400">© {new Date().getFullYear()} Vívido. Todos los derechos reservados.</p>
        </div>

        <div>
          <p className="text-sm font-semibold text-brand-dark">¿Nos escribís?</p>
          {state === 'sent' ? (
            <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">
              ¡Gracias! Recibimos tu mensaje y te vamos a responder pronto.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-3 space-y-2.5">
              <div className="grid gap-2.5 sm:grid-cols-2">
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none"
                />
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Tu email"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none"
                />
              </div>
              <textarea
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Contanos en qué te podemos ayudar"
                rows={3}
                className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none"
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={state === 'sending'}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
              >
                {state === 'sending' ? 'Enviando…' : 'Enviar mensaje'}
              </button>
            </form>
          )}
        </div>
      </div>
    </footer>
  );
}

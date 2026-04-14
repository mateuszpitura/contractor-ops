'use client';

import { ArrowRight, Menu, X } from 'lucide-react';
import { motion, useMotionValueEvent, useScroll } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', latest => {
    setScrolled(latest > 40);
  });

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const toggleMobileMenu = useCallback(() => setMobileOpen(prev => !prev), []);
  const closeMobileMenu = useCallback(() => setMobileOpen(false), []);
  const scrollToCta = useCallback(() => {
    setMobileOpen(false);
    document.querySelector('#cta')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Close mobile menu on Escape key
  useEffect(() => {
    if (!mobileOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileOpen]);

  return (
    <>
      <motion.header
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled ? 'glass-subtle py-3' : 'py-5 bg-transparent'
        }`}>
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2.5 group">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md transition-transform group-hover:scale-105">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-display text-lg font-bold tracking-tight">
              Contractor<span className="text-primary">Ops</span>
            </span>
          </a>

          {/* Desktop links */}
          <div className="hidden items-center gap-1 md:flex">
            {navLinks.map(link => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/50">
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden items-center gap-3 md:flex">
            <a
              href="/login"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Log in
            </a>
            <a
              href="#cta"
              className="group inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg active:scale-[0.98]">
              Get started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            onClick={toggleMobileMenu}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-muted/50 md:hidden"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>
      </motion.header>

      {/* Mobile menu */}
      {!!mobileOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 flex flex-col bg-background/98 backdrop-blur-xl pt-24 px-6 md:hidden">
          <nav className="flex flex-col gap-2">
            {navLinks.map(link => (
              <a
                key={link.href}
                href={link.href}
                onClick={closeMobileMenu}
                className="rounded-xl px-4 py-3.5 text-lg font-medium text-foreground transition-colors hover:bg-muted/50">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-8 flex flex-col gap-3">
            <a
              href="/login"
              className="rounded-xl border border-border px-4 py-3 text-center text-base font-medium text-foreground">
              Log in
            </a>
            <button
              type="button"
              onClick={scrollToCta}
              className="rounded-xl bg-primary px-4 py-3 text-center text-base font-semibold text-primary-foreground shadow-md">
              Get started free
            </button>
          </div>
        </motion.div>
      )}
    </>
  );
}

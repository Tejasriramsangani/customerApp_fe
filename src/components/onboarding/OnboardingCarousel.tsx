"use client";

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { Button } from '../ui';
import styles from './OnboardingCarousel.module.css';

interface OnboardingCarouselProps { onComplete: () => void; }

const SLIDES = [
  { title: 'Transparent Scrap Prices', description: 'Check live market-based rates for all scrap categories before you sell.', image: '/onboarding/Recycling Prices with Happy Neighbours.png', alt: 'A customer and collection partner presenting scrap category prices on a phone.' },
  { title: 'Easy Scrap Pickup Booking', description: 'Schedule a scrap pickup from your doorstep at a date and time that works for you.', image: '/onboarding/Smartphone Recycling Pickup Scheduler.png', alt: 'A hand selecting a pickup date and time on a smartphone.' },
  { title: 'Verified Pickup Professionals', description: 'Enjoy safe and reliable scrap collection with our verified pickup professionals.', image: '/onboarding/Trusted Recycling Collection Crew.png', alt: 'An identified collection partner with a verification badge and a crew loading a recycling vehicle.' },
  { title: 'Accurate Digital Weighing', description: 'Get precise weight measurements with digital scales for a fair and transparent deal.', image: '/onboarding/Scrap Collection in the Neighbourhood.png', alt: 'A collection partner weighing scrap on a digital scale in front of a customer.' },
  { title: 'Instant & Secure Payments', description: 'Receive your payment quickly and securely once your scrap pickup is complete.', image: '/onboarding/Payment Received_ Recycling Made Easy.png', alt: 'A customer viewing a successful payment receipt on her phone beside a collection partner.' },
] as const;

export const OnboardingCarousel: React.FC<OnboardingCarouselProps> = ({ onComplete }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const slide = SLIDES[currentSlide];
  const isLast = currentSlide === SLIDES.length - 1;
  const goTo = (index: number) => setCurrentSlide(Math.max(0, Math.min(SLIDES.length - 1, index)));

  return <section className={styles.onboarding} aria-label="Welcome to ASLI KAATA" aria-roledescription="carousel"
    onKeyDown={event => {
      if (event.key === 'ArrowRight') { event.preventDefault(); goTo(currentSlide + 1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(currentSlide - 1); }
    }}>
    <header className={styles.header}>
      <Button type="button" onClick={onComplete} className={styles.skip}>Skip</Button>
    </header>
    <div className={styles.stage}
      onTouchStart={event => { touchStart.current = { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY }; }}
      onTouchEnd={event => {
        const start = touchStart.current; touchStart.current = null;
        if (!start) return;
        const dx = event.changedTouches[0].clientX - start.x, dy = event.changedTouches[0].clientY - start.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) goTo(currentSlide + (dx < 0 ? 1 : -1));
      }}>
      <div className={styles.hero}>
          <div key={currentSlide} className={styles.artworkFrame}>
            <Image src={slide.image} alt={slide.alt} fill
              sizes="(max-width: 430px) max(100vw, 65vh), max(430px, 65vh)" loading="eager" className={styles.featureImage} />
          </div>
      </div>
      <div className={styles.panel}>
        <div className={styles.content}>
            <div key={currentSlide} className={styles.copy}
              role="group" aria-roledescription="slide" aria-label={`${currentSlide + 1} of ${SLIDES.length}`}>
              <h1>{slide.title}</h1>
              <p>{slide.description}</p>
        <div className={styles.dots} aria-label="Choose an introduction slide">
          {SLIDES.map((item, index) => <Button key={item.title} type="button" className={styles.dotButton} aria-label={`Go to slide ${index + 1}: ${item.title.replaceAll('\n', ' ')}`} aria-current={currentSlide === index ? 'step' : undefined} onClick={() => goTo(index)}><span className={`${styles.dot} ${currentSlide === index ? styles.activeDot : ''}`} /></Button>)}
        </div>
            </div>
        </div>
        <footer className={styles.footer}>
      <Button type="button" onClick={() => isLast ? onComplete() : goTo(currentSlide + 1)} className={styles.continueButton}>{isLast ? 'Get Started' : 'Next'}</Button>
      <span className="sr-only" role="status" aria-live="polite">Slide {currentSlide + 1} of {SLIDES.length}: {slide.title.replaceAll('\n', ' ')}</span>
        </footer>
      </div>
    </div>
  </section>;
};

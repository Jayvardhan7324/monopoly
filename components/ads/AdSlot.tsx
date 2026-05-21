import React, { useEffect, useState, useRef } from 'react';
import { getAds, subscribeAds, trackAd, pickWeighted, type Ad } from '../../services/adsService';

interface Props {
  placement: string;
  className?: string;
  /** When true, render a faint dashed outline + label even when no ad is present (admin preview). */
  debug?: boolean;
}

const AdSlot: React.FC<Props> = ({ placement, className = '', debug = false }) => {
  const [ad, setAd] = useState<Ad | null>(() => pickWeighted(getAds(placement)));
  const trackedRef = useRef<string | null>(null);

  useEffect(() => {
    const unsub = subscribeAds(() => {
      const next = pickWeighted(getAds(placement));
      setAd(prev => (prev?.id === next?.id ? prev : next));
    });
    return unsub;
  }, [placement]);

  useEffect(() => {
    if (ad && trackedRef.current !== ad.id) {
      trackedRef.current = ad.id;
      trackAd(ad.id, 'impression');
    }
  }, [ad]);

  if (!ad) {
    if (!debug) return null;
    return (
      <div className={`flex items-center justify-center text-[10px] text-slate-600 border border-dashed border-slate-700/60 rounded-md py-2 ${className}`}>
        ad slot · {placement}
      </div>
    );
  }

  const handleClick = () => {
    trackAd(ad.id, 'click');
  };

  const safeImageUrl = toHttpsUrl(ad.imageUrl);
  const safeLinkUrl = toHttpsUrl(ad.linkUrl);

  if (safeImageUrl) {
    const img = (
      <img
        src={safeImageUrl}
        alt={ad.altText || ad.name}
        loading="lazy"
        className="block w-full h-full object-contain rounded-md"
      />
    );
    return (
      <div className={`ad-slot ${className}`} data-placement={placement}>
        {safeLinkUrl ? (
          <a
            href={safeLinkUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={handleClick}
            className="block"
          >
            {img}
          </a>
        ) : img}
      </div>
    );
  }

  return null;
};

function toHttpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export default AdSlot;

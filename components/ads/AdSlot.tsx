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

  if (ad.htmlSnippet) {
    return (
      <iframe
        className={`ad-slot w-full border-0 ${className}`}
        data-placement={placement}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="strict-origin-when-cross-origin"
        srcDoc={ad.htmlSnippet}
        title={ad.name}
        loading="lazy"
      />
    );
  }

  if (ad.imageUrl) {
    const img = (
      <img
        src={ad.imageUrl}
        alt={ad.altText || ad.name}
        loading="lazy"
        className="block w-full h-full object-contain rounded-md"
      />
    );
    return (
      <div className={`ad-slot ${className}`} data-placement={placement}>
        {ad.linkUrl ? (
          <a
            href={ad.linkUrl}
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

export default AdSlot;

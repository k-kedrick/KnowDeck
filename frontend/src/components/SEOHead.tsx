import { useEffect } from 'react';
import { applySEO } from '../utils/seo';
import type { SEOConfig } from '../utils/seo';

export const SEOHead = (config: SEOConfig) => {
  useEffect(() => {
    applySEO(config);
  }, [config]);
  return null;
};

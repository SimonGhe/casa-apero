import { Camera, Music2 } from 'lucide-react';
import { business } from '../data/business';

export function SocialLinks() {
  return <div className="social-links" aria-label="Casa Apero op sociale media">
    <a href={business.instagram} target="_blank" rel="noopener noreferrer" aria-label="Casa Apero op Instagram (opent in een nieuw tabblad)"><Camera size={18} aria-hidden="true" />Instagram</a>
    <a href={business.tiktok} target="_blank" rel="noopener noreferrer" aria-label="Casa Apero op TikTok (opent in een nieuw tabblad)"><Music2 size={18} aria-hidden="true" />TikTok</a>
  </div>;
}

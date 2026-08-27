import { Injectable } from '@nestjs/common';

const CHALLENGE_MARKERS = [
  /<title>\s*just a moment(?:\.\.\.)?\s*<\/title>/iu,
  /cdn-cgi\/challenge-platform/iu,
  /cf-chl-[\w-]+/iu,
  /<title>\s*attention required[^<]*cloudflare/iu,
  /(?:hcaptcha|g-recaptcha)[\w-]*/iu,
];

@Injectable()
export class CrawlerChallengeDetectorService {
  isChallenge(document: string): boolean {
    return CHALLENGE_MARKERS.some((marker) => marker.test(document));
  }
}

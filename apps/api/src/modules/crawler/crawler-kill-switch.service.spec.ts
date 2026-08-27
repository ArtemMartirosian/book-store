import { ServiceUnavailableException } from '@nestjs/common';
import { CrawlerKillSwitchService } from './crawler-kill-switch.service';

describe('CrawlerKillSwitchService', () => {
  it.each([403, 429])('latches on HTTP %i and requires an explicit reset', (status) => {
    const service = new CrawlerKillSwitchService();
    service.observeHttpStatus(status, 'https://www.books.am/am/example.html');

    expect(service.getState()).toMatchObject({
      engaged: true,
      reason: `UPSTREAM_HTTP_${status}`,
    });
    expect(() => service.assertOperational()).toThrow(ServiceUnavailableException);
    expect(service.reset('Operator reviewed upstream response').engaged).toBe(false);
  });
});

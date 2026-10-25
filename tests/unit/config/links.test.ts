import { readFileSync } from 'fs';
import { join } from 'path';
import { SUPPORT_SERVER_URL, SITE_URL } from '../../../src/config/constants/links';

// Bot (/help) i dashboard (regulamin, polityka prywatności) linkują do tych samych adresów -
// rozjazd oznacza, że w bocie i w dokumentach prawnych widnieje inny serwer wsparcia.
const legalSource = readFileSync(join(__dirname, '../../../dashboard-nextjs/src/lib/legal.ts'), 'utf8');

function legalValue(key: string): string | undefined {
  return legalSource.match(new RegExp(`${key}:\\s*"([^"]+)"`))?.[1];
}

describe('public links', () => {
  it('uses a permanent discord.gg invite for the support server', () => {
    expect(SUPPORT_SERVER_URL).toMatch(/^https:\/\/discord\.gg\/[A-Za-z0-9]+$/);
  });

  it('matches the support server and site URL shown in the legal documents', () => {
    expect(legalValue('supportServerUrl')).toBe(SUPPORT_SERVER_URL);
    expect(legalValue('siteUrl')).toBe(SITE_URL);
  });
});

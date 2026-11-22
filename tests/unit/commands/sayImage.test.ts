jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { IMAGE_MAX_MB, data, imageFileName } from '../../../src/commands/admin/say';

describe('/say image option', () => {
  it('is an optional attachment option', () => {
    const option = data.toJSON().options?.find((o) => o.name === 'image');
    expect(option).toMatchObject({ required: false });
  });

  it.each([
    ['image/png', 'deezy-image.png'],
    ['image/jpeg', 'deezy-image.jpg'],
    ['image/gif', 'deezy-image.gif'],
    ['image/webp', 'deezy-image.webp'],
    ['image/PNG; charset=binary', 'deezy-image.png'],
  ])('accepts %s with a safe file name', (contentType, name) => {
    expect(imageFileName({ contentType, size: 1024 })).toBe(name);
  });

  it('rejects other file types, missing type and files over the size limit', () => {
    expect(imageFileName({ contentType: 'application/pdf', size: 1024 })).toBeNull();
    expect(imageFileName({ contentType: 'image/svg+xml', size: 1024 })).toBeNull();
    expect(imageFileName({ contentType: null, size: 1024 })).toBeNull();
    expect(imageFileName({ contentType: 'image/png', size: IMAGE_MAX_MB * 1024 * 1024 + 1 })).toBeNull();
  });
});

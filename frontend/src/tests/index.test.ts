import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { expect, test } from 'vitest';
import IndexPage from '../pages/index.astro';

test('Homepage renders the main heading correctly', async () => {
  const container = await AstroContainer.create();
  const result = await container.renderToString(IndexPage);
  expect(result).toContain('Have something to share?');
});
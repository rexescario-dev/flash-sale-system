import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)));
const stylesPath = join(srcRoot, 'styles.css');

const FORBIDDEN_ELEMENTS = ['h1', 'button'] as const;

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function targetsForbiddenElement(selectorPart: string, element: string): boolean {
  const simpleSelectors = selectorPart.trim().split(/[\s>+~]+/);

  for (const simple of simpleSelectors) {
    const token = simple.trim();
    if (!token || token.startsWith('.') || token.startsWith('#') || token.startsWith('[')) {
      continue;
    }

    const elementPattern = new RegExp(`^${element}(?=$|[\\s,:.\\[])`);
    if (elementPattern.test(token)) {
      return true;
    }
  }

  return false;
}

function findForbiddenElementSelectors(css: string): string[] {
  const withoutComments = stripCssComments(css);
  const violations: string[] = [];

  for (const match of withoutComments.matchAll(/([^{}]+)\{/g)) {
    const selectorGroup = match[1]?.trim() ?? '';
    if (!selectorGroup || selectorGroup.startsWith('@')) {
      continue;
    }

    for (const selectorPart of selectorGroup.split(',')) {
      const trimmed = selectorPart.trim();
      if (FORBIDDEN_ELEMENTS.some((element) => targetsForbiddenElement(trimmed, element))) {
        violations.push(trimmed);
      }
    }
  }

  return violations;
}

function findCatalogCssFiles(dir: string): string[] {
  const matches: string[] = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      matches.push(...findCatalogCssFiles(fullPath));
      continue;
    }

    if (/^catalog.*\.css$/i.test(entry)) {
      matches.push(fullPath);
    }
  }

  return matches;
}

describe('catalog CSS regression guard', () => {
  it('does not introduce global h1 or button element selectors in styles.css', () => {
    const css = readFileSync(stylesPath, 'utf8');
    const violations = findForbiddenElementSelectors(css);

    expect(
      violations,
      violations.length > 0
        ? `styles.css must not target h1/button element selectors (found: ${violations.join(', ')})`
        : undefined,
    ).toEqual([]);
  });

  it('does not add catalog-specific CSS files under src', () => {
    const catalogCssFiles = findCatalogCssFiles(srcRoot).map((filePath) =>
      relative(srcRoot, filePath),
    );

    expect(
      catalogCssFiles,
      catalogCssFiles.length > 0
        ? `catalog*.css files are not allowed under src (found: ${catalogCssFiles.join(', ')})`
        : undefined,
    ).toEqual([]);
  });
});

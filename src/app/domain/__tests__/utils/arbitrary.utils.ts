/**
 * Arbitrary utilities for Effect Schema + FastCheck property-based test generation.
 * Mirrors the `refined` helper pattern from the company testing standards.
 *
 * Usage:
 *   SomeSchema.fields.id.annotations(refined.uuid())
 *   SomeSchema.fields.createdAt.annotations(refined.dateTime.past())
 */

import { Arbitrary } from 'effect';
import { faker } from '@faker-js/faker';

/**
 * Returns an Effect Arbitrary annotation that generates valid UUID strings.
 */
function uuid() {
  return {
    arbitrary: () => (fc: any) =>
      fc.uuidV(4).map((id: string) => id.toLowerCase()),
  };
}

/**
 * DateTime arbitrary annotations — past, recent, and future timestamps.
 */
const dateTime = {
  /**
   * Generates a realistic past ISO timestamp (up to 2 years ago).
   */
  past() {
    return {
      arbitrary: () => (fc: any) =>
        fc
          .integer({ min: 0, max: 730 })
          .map((daysAgo: number) => {
            const d = new Date();
            d.setDate(d.getDate() - daysAgo);
            return d.toISOString();
          }),
    };
  },

  /**
   * Generates a recent ISO timestamp (within the last 30 days).
   */
  recent() {
    return {
      arbitrary: () => (fc: any) =>
        fc
          .integer({ min: 0, max: 30 })
          .map((daysAgo: number) => {
            const d = new Date();
            d.setDate(d.getDate() - daysAgo);
            return d.toISOString();
          }),
    };
  },

  /**
   * Generates a future ISO timestamp (within the next 30 days).
   */
  future() {
    return {
      arbitrary: () => (fc: any) =>
        fc
          .integer({ min: 1, max: 30 })
          .map((daysAhead: number) => {
            const d = new Date();
            d.setDate(d.getDate() + daysAhead);
            return d.toISOString();
          }),
    };
  },
};

/**
 * Generates a realistic email string using Faker.
 */
function email() {
  return {
    arbitrary: () => (fc: any) =>
      fc.constant(null).map(() => faker.internet.email().toLowerCase()),
  };
}

/**
 * Generates a realistic file name string using Faker.
 */
function fileName() {
  return {
    arbitrary: () => (fc: any) =>
      fc.constant(null).map(() => faker.system.fileName()),
  };
}

/**
 * Generates a realistic MIME type string using Faker.
 */
function mimeType() {
  return {
    arbitrary: () => (fc: any) =>
      fc.constant(null).map(() => faker.system.mimeType()),
  };
}

/**
 * Generates a realistic storage key (path-like string).
 */
function storageKey() {
  return {
    arbitrary: () => (fc: any) =>
      fc.constant(null).map(() => `uploads/${faker.string.uuid()}/${faker.system.fileName()}`),
  };
}

/**
 * Generates a realistic SHA-256 hex checksum (64 chars).
 */
function checksum() {
  return {
    arbitrary: () => (fc: any) =>
      fc.hexaString({ minLength: 64, maxLength: 64 }),
  };
}

/**
 * Generates a realistic file size in bytes (1 KB – 100 MB).
 */
function fileSize() {
  return {
    arbitrary: () => (fc: any) =>
      fc.integer({ min: 1024, max: 100 * 1024 * 1024 }),
  };
}

export const refined = {
  uuid,
  dateTime,
  email,
  fileName,
  mimeType,
  storageKey,
  checksum,
  fileSize,
};

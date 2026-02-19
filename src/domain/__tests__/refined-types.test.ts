import { describe, it, expect } from 'vitest';
import { TestPatterns } from './utils/test.helpers';
import {
  Email,
  DocumentId,
  DocumentVersionId,
  UserId,
  AccessPolicyId,
  MimeType,
  StorageKey,
  Checksum,
} from 'src/domain/utils/refined-types';

// ─── Email ────────────────────────────────────────────────────────────────────

describe('Email', () => {
  describe('create() — valid inputs', () => {
    it('accepts a well-formed email address', () => {
      const result = Email.create('alice@example.com');
      const email = TestPatterns.Result.expectOk(result);
      expect(email).toBe('alice@example.com');
    });

    it('normalizes uppercase to lowercase', () => {
      const result = Email.create('ALICE@EXAMPLE.COM');
      const email = TestPatterns.Result.expectOk(result);
      expect(email).toBe('alice@example.com');
    });

    it('trims surrounding whitespace before validating', () => {
      const result = Email.create('  bob@example.com  ');
      const email = TestPatterns.Result.expectOk(result);
      expect(email).toBe('bob@example.com');
    });
  });

  describe('create() — invalid inputs', () => {
    it('rejects a string with no @ symbol', () => {
      const result = Email.create('notanemail');
      const err = TestPatterns.Result.expectErr(result);
      expect(err.message).toContain('Invalid email format');
    });

    it('rejects an empty string', () => {
      const result = Email.create('');
      TestPatterns.Result.expectErr(result);
    });

    it('rejects an email over 254 characters', () => {
      const longLocal = 'a'.repeat(245);
      const result = Email.create(`${longLocal}@example.com`);
      TestPatterns.Result.expectErr(result);
    });

    it('rejects a string with only a domain (no local part)', () => {
      const result = Email.create('@example.com');
      TestPatterns.Result.expectErr(result);
    });
  });
});

// ─── UUID-based IDs ───────────────────────────────────────────────────────────

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const INVALID_INPUTS = [
  ['empty string', ''],
  ['plain text', 'not-a-uuid'],
  ['partial UUID', '550e8400-e29b-41d4'],
  ['UUID with wrong variant', '550e8400-e29b-41d4-z716-446655440000'],
];

describe('DocumentId', () => {
  describe('create() — valid inputs', () => {
    it('accepts a valid UUID', () => {
      const result = DocumentId.create(VALID_UUID);
      const id = TestPatterns.Result.expectOk(result);
      expect(id).toBe(VALID_UUID.toLowerCase());
    });

    it('normalizes uppercase UUID to lowercase', () => {
      const upper = VALID_UUID.toUpperCase();
      const result = DocumentId.create(upper);
      const id = TestPatterns.Result.expectOk(result);
      expect(id).toBe(VALID_UUID.toLowerCase());
    });
  });

  describe('create() — invalid inputs', () => {
    it.each(INVALID_INPUTS)('rejects %s', (_label, value) => {
      const result = DocumentId.create(value);
      const err = TestPatterns.Result.expectErr(result);
      expect(err.message).toContain('Invalid DocumentId');
    });
  });
});

describe('DocumentVersionId', () => {
  describe('create() — valid inputs', () => {
    it('accepts a valid UUID', () => {
      const result = DocumentVersionId.create(VALID_UUID);
      TestPatterns.Result.expectOk(result);
    });

    it('normalizes uppercase UUID to lowercase', () => {
      const result = DocumentVersionId.create(VALID_UUID.toUpperCase());
      const id = TestPatterns.Result.expectOk(result);
      expect(id).toBe(VALID_UUID.toLowerCase());
    });
  });

  describe('create() — invalid inputs', () => {
    it.each(INVALID_INPUTS)('rejects %s', (_label, value) => {
      const result = DocumentVersionId.create(value);
      const err = TestPatterns.Result.expectErr(result);
      expect(err.message).toContain('Invalid DocumentVersionId');
    });
  });
});

describe('UserId', () => {
  describe('create() — valid inputs', () => {
    it('accepts a valid UUID', () => {
      const result = UserId.create(VALID_UUID);
      TestPatterns.Result.expectOk(result);
    });

    it('normalizes uppercase UUID to lowercase', () => {
      const result = UserId.create(VALID_UUID.toUpperCase());
      const id = TestPatterns.Result.expectOk(result);
      expect(id).toBe(VALID_UUID.toLowerCase());
    });
  });

  describe('create() — invalid inputs', () => {
    it.each(INVALID_INPUTS)('rejects %s', (_label, value) => {
      const result = UserId.create(value);
      const err = TestPatterns.Result.expectErr(result);
      expect(err.message).toContain('Invalid UserId');
    });
  });
});

describe('AccessPolicyId', () => {
  describe('create() — valid inputs', () => {
    it('accepts a valid UUID', () => {
      const result = AccessPolicyId.create(VALID_UUID);
      TestPatterns.Result.expectOk(result);
    });

    it('normalizes uppercase UUID to lowercase', () => {
      const result = AccessPolicyId.create(VALID_UUID.toUpperCase());
      const id = TestPatterns.Result.expectOk(result);
      expect(id).toBe(VALID_UUID.toLowerCase());
    });
  });

  describe('create() — invalid inputs', () => {
    it.each(INVALID_INPUTS)('rejects %s', (_label, value) => {
      const result = AccessPolicyId.create(value);
      const err = TestPatterns.Result.expectErr(result);
      expect(err.message).toContain('Invalid AccessPolicyId');
    });
  });
});

// ─── MimeType ─────────────────────────────────────────────────────────────────

describe('MimeType', () => {
  describe('create() — valid inputs', () => {
    it('accepts application/json', () => {
      const result = MimeType.create('application/json');
      const mime = TestPatterns.Result.expectOk(result);
      expect(mime).toBe('application/json');
    });

    it('accepts image/jpeg', () => {
      TestPatterns.Result.expectOk(MimeType.create('image/jpeg'));
    });

    it('accepts text/plain', () => {
      TestPatterns.Result.expectOk(MimeType.create('text/plain'));
    });

    it('normalizes uppercase to lowercase', () => {
      const result = MimeType.create('Application/JSON');
      const mime = TestPatterns.Result.expectOk(result);
      expect(mime).toBe('application/json');
    });
  });

  describe('create() — invalid inputs', () => {
    it('rejects a string with no slash', () => {
      const result = MimeType.create('applicationjson');
      const err = TestPatterns.Result.expectErr(result);
      expect(err.message).toContain('Invalid MIME type format');
    });

    it('rejects an empty string', () => {
      TestPatterns.Result.expectErr(MimeType.create(''));
    });

    it('rejects a string that is only a slash', () => {
      TestPatterns.Result.expectErr(MimeType.create('/'));
    });
  });
});

// ─── StorageKey ───────────────────────────────────────────────────────────────

describe('StorageKey', () => {
  describe('create() — valid inputs', () => {
    it('accepts a typical uploads path', () => {
      const result = StorageKey.create('uploads/abc123/file.pdf');
      const key = TestPatterns.Result.expectOk(result);
      expect(key).toBe('uploads/abc123/file.pdf');
    });

    it('accepts a single character key', () => {
      TestPatterns.Result.expectOk(StorageKey.create('x'));
    });

    it('accepts a key at exactly 255 characters', () => {
      TestPatterns.Result.expectOk(StorageKey.create('a'.repeat(255)));
    });
  });

  describe('create() — invalid inputs', () => {
    it('rejects an empty string', () => {
      const result = StorageKey.create('');
      const err = TestPatterns.Result.expectErr(result);
      expect(err.message).toContain('Invalid StorageKey');
    });

    it('rejects a key over 255 characters', () => {
      const result = StorageKey.create('a'.repeat(256));
      TestPatterns.Result.expectErr(result);
    });
  });
});

// ─── Checksum ─────────────────────────────────────────────────────────────────

describe('Checksum', () => {
  describe('create() — valid inputs', () => {
    it('accepts a 64-character SHA-256 hex string', () => {
      const sha256 = 'b'.repeat(64);
      const result = Checksum.create(sha256);
      const checksum = TestPatterns.Result.expectOk(result);
      expect(checksum).toBe(sha256);
    });

    it('accepts a 32-character MD5 hex string (minimum length)', () => {
      TestPatterns.Result.expectOk(Checksum.create('c'.repeat(32)));
    });
  });

  describe('create() — invalid inputs', () => {
    it('rejects a string shorter than 32 characters', () => {
      const result = Checksum.create('abc123');
      const err = TestPatterns.Result.expectErr(result);
      expect(err.message).toContain('Invalid Checksum');
    });

    it('rejects an empty string', () => {
      TestPatterns.Result.expectErr(Checksum.create(''));
    });

    it('rejects a string longer than 64 characters', () => {
      TestPatterns.Result.expectErr(Checksum.create('a'.repeat(65)));
    });
  });
});

import { describe, it, expect } from 'vitest';
import { User } from '@domain/user/user.entity';
import { UserRole } from '@domain/user/user.enums';
import { makeUser, makeAdminUser, TEST_IDS } from './factories';
import { TestPatterns } from './utils/test.helpers';

describe('User entity', () => {
  describe('create()', () => {
    it('creates a user with a generated id', () => {
      const result = User.create({
        email: 'bob@example.com' as any,
        role: UserRole.USER,
      });

      const user = TestPatterns.Result.expectOk(result);
      expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(user.role).toBe(UserRole.USER);
    });

    it('creates an admin user', () => {
      const user = TestPatterns.Result.expectOk(
        User.create({ email: 'admin@example.com' as any, role: UserRole.ADMIN }),
      );
      expect(user.role).toBe(UserRole.ADMIN);
    });

    it('generates unique ids on each call', () => {
      const u1 = TestPatterns.Result.expectOk(
        User.create({ email: 'a@a.com' as any, role: UserRole.USER }),
      );
      const u2 = TestPatterns.Result.expectOk(
        User.create({ email: 'b@b.com' as any, role: UserRole.USER }),
      );
      expect(u1.id).not.toBe(u2.id);
    });
  });

  describe('fromSerialized()', () => {
    it('rehydrates a user from factory-generated data', () => {
      const user = makeUser({ id: TEST_IDS.user1, email: 'alice@example.com', role: UserRole.USER });

      expect(user.id).toBe(TEST_IDS.user1);
      expect(user.email).toBe('alice@example.com');
      expect(user.role).toBe(UserRole.USER);
    });

    it('factory generates realistic email addresses', () => {
      const user = makeUser();
      expect(user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });

    it('rehydrates an admin user', () => {
      const admin = makeAdminUser();
      expect(admin.role).toBe(UserRole.ADMIN);
    });
  });

  describe('serialize()', () => {
    it('round-trips through serialize → fromSerialized', () => {
      const original = makeUser({ email: 'roundtrip@example.com' });
      const serialized = original.serialize();
      const restored = User.fromSerialized(serialized);

      expect(restored.id).toBe(original.id);
      expect(restored.email).toBe(original.email);
      expect(restored.role).toBe(original.role);
    });

    it('serializes all fields to primitives', () => {
      const user = makeUser();
      const serialized = user.serialize();

      expect(typeof serialized.id).toBe('string');
      expect(typeof serialized.email).toBe('string');
      expect(typeof serialized.role).toBe('string');
      expect(typeof serialized.createdAt).toBe('string');
    });
  });
});

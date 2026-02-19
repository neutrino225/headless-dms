import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserRepositoryImpl } from "../user.repository.impl";
import { User } from "@domain/user/user.entity";
import { makeUser } from "@domain/__tests__/factories";
import { Result, Option } from "@carbonteq/fp";
import { PaginationOptions } from "@domain/shared/pagination";
import { UserRole } from "@domain/user/user.enums";
import { users } from "@infra/db/schema";

describe("UserRepositoryImpl Mocked Unit Tests", () => {
    let repository: UserRepositoryImpl;
    let dbMock: any;

    beforeEach(() => {
        // Deep mock for Drizzle's fluent API and query builder
        dbMock = {
            insert: vi.fn().mockReturnThis(),
            values: vi.fn().mockResolvedValue([]),
            update: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            returning: vi.fn().mockResolvedValue([]),
            delete: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([{ total: "1" }, { value: "1" }]),
                }),
            }),
            query: {
                users: {
                    findFirst: vi.fn(),
                    findMany: vi.fn(),
                },
            },
        };

        repository = new UserRepositoryImpl(dbMock);
    });

    describe("insert", () => {
        it("should serialize and insert a user entity", async () => {
            const user = makeUser();
            const result = await repository.insert(user);

            expect(result.isOk()).toBe(true);
            expect(dbMock.insert).toHaveBeenCalledWith(users);
            expect(dbMock.values).toHaveBeenCalled();
            expect(result.unwrap().unwrap().id.toString()).toBe(user.id.toString());
        });

        it("should return UserAlreadyExistsError on DB failure", async () => {
            const user = makeUser();
            dbMock.values.mockRejectedValue(new Error("Unique constraint violation"));

            const result = await repository.insert(user);

            expect(result.isErr()).toBe(true);
            expect(result.unwrapErr().code).toBe("USER_ALREADY_EXISTS");
        });
    });

    describe("fetchById", () => {
        it("should rehydrate a user entity when found", async () => {
            const user = makeUser();
            const raw = {
                ...user.serialize(),
                createdAt: user.createdAt.toDate(),
                updatedAt: user.updatedAt.toDate(),
            };
            dbMock.query.users.findFirst.mockResolvedValue(raw);

            const result = await repository.fetchById(user.id.toString());

            expect(result.isOk()).toBe(true);
            const maybeUser = result.unwrap();
            expect(maybeUser.isSome()).toBe(true);
            expect(maybeUser.unwrap()).toBeInstanceOf(User);
            expect(maybeUser.unwrap().id.toString()).toBe(user.id.toString());
        });

        it("should return Option.None when user not found", async () => {
            dbMock.query.users.findFirst.mockResolvedValue(null);

            const result = await repository.fetchById("non-existent");

            expect(result.isOk()).toBe(true);
            expect(result.unwrap().isNone()).toBe(true);
        });
    });

    describe("fetchActiveUsers", () => {
        it("should handle paginated queries and rehydrate results", async () => {
            const user = makeUser({ isActive: true });
            const raw = {
                ...user.serialize(),
                createdAt: user.createdAt.toDate(),
                updatedAt: user.updatedAt.toDate(),
            };

            const dataMock = {
                limit: vi.fn().mockReturnThis(),
                offset: vi.fn().mockReturnThis(),
                then: vi.fn().mockImplementation((onFulfilled) => onFulfilled([raw])),
            };

            const countMock = {
                then: vi.fn().mockImplementation((onFulfilled) => onFulfilled([{ total: "1" }])),
            };

            const fromMock = {
                where: vi.fn()
                    .mockReturnValueOnce(countMock) // First call: count
                    .mockReturnValueOnce(dataMock), // Second call: data
            };

            dbMock.select.mockReturnValue({
                from: vi.fn().mockReturnValue(fromMock),
            });

            const options = PaginationOptions.create({ pageNum: 1, pageSize: 10 }).unwrap();
            const result = await repository.fetchActiveUsers(options);

            if (result.isErr()) {
                console.error("Test failed with error:", result.unwrapErr());
            }

            expect(result.isOk()).toBe(true);
            const paginated = result.unwrap();
            expect(paginated.data[0]).toBeInstanceOf(User);
            expect(paginated.totalPages).toBe(1);
        });
    });

    describe("delete", () => {
        it("should fetch, delete and return the entity", async () => {
            const user = makeUser();
            const raw = {
                ...user.serialize(),
                createdAt: user.createdAt.toDate(),
                updatedAt: user.updatedAt.toDate(),
            };
            
            // Mock fetchById (via findFirst)
            dbMock.query.users.findFirst.mockResolvedValue(raw);
            
            const result = await repository.delete(user.id.toString());

            expect(result.isOk()).toBe(true);
            expect(dbMock.delete).toHaveBeenCalledWith(users);
            expect(result.unwrap().unwrap().id.toString()).toBe(user.id.toString());
        });
    });
});

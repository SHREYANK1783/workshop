import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllCategories,
    getAllPublishers,
    getAllGameIds,
    getGameById,
    getFilteredGames,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns categories and publishers ordered alphabetically', async () => {
        const [secondCategory] = await db
            .insert(categories)
            .values({ name: 'Action', description: 'cat' })
            .returning({ id: categories.id });
        const [firstCategory] = await db
            .insert(categories)
            .values({ name: 'Strategy', description: 'cat' })
            .returning({ id: categories.id });
        const [secondPublisher] = await db
            .insert(publishers)
            .values({ name: 'Zed Games', description: 'pub' })
            .returning({ id: publishers.id });
        const [firstPublisher] = await db
            .insert(publishers)
            .values({ name: 'Alpha Games', description: 'pub' })
            .returning({ id: publishers.id });

        expect(await getAllCategories(db)).toEqual([
            { id: secondCategory.id, name: 'Action' },
            { id: firstCategory.id, name: 'Strategy' },
        ]);
        expect(await getAllPublishers(db)).toEqual([
            { id: firstPublisher.id, name: 'Alpha Games' },
            { id: secondPublisher.id, name: 'Zed Games' },
        ]);
    });

    it('filters games by one or more categories', async () => {
        const [strategy] = await db.insert(categories).values({ name: 'Strategy' }).returning({ id: categories.id });
        const [puzzle] = await db.insert(categories).values({ name: 'Puzzle' }).returning({ id: categories.id });
        const [publisher] = await db.insert(publishers).values({ name: 'Pub One' }).returning({ id: publishers.id });
        await db.insert(games).values([
            { title: 'Strategy Game', description: 'Description', starRating: 4, categoryId: strategy.id, publisherId: publisher.id },
            { title: 'Puzzle Game', description: 'Description', starRating: 4, categoryId: puzzle.id, publisherId: publisher.id },
        ]);

        const filtered = await getFilteredGames(db, [puzzle.id], null);
        expect(filtered.map((game) => game.title)).toEqual(['Puzzle Game']);
        expect((await getFilteredGames(db, [strategy.id, puzzle.id], null)).map((game) => game.title))
            .toEqual(['Puzzle Game', 'Strategy Game']);
    });

    it('combines category and publisher filters', async () => {
        const [category] = await db.insert(categories).values({ name: 'Strategy' }).returning({ id: categories.id });
        const [matchingPublisher] = await db.insert(publishers).values({ name: 'Matching Pub' }).returning({ id: publishers.id });
        const [otherPublisher] = await db.insert(publishers).values({ name: 'Other Pub' }).returning({ id: publishers.id });
        await db.insert(games).values([
            { title: 'Matching Game', description: 'Description', starRating: 4, categoryId: category.id, publisherId: matchingPublisher.id },
            { title: 'Other Game', description: 'Description', starRating: 4, categoryId: category.id, publisherId: otherPublisher.id },
        ]);

        const filtered = await getFilteredGames(db, [category.id], matchingPublisher.id);
        expect(filtered.map((game) => game.title)).toEqual(['Matching Game']);
    });

    it('returns an empty collection when filters have no matches', async () => {
        await seedGames(db, 1);
        expect(await getFilteredGames(db, [99999], null)).toEqual([]);
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});

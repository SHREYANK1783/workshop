import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Category, Game, Publisher } from '../types/game';

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

/**
 * Returns all games in title order.
 *
 * @param db Drizzle database client used to query games and their relations.
 * @returns All games mapped to the application-facing type.
 */
export async function getAllGames(db: Database): Promise<Game[]> {
    return getFilteredGames(db, [], null);
}

/**
 * Returns games matching the selected category and publisher filters.
 *
 * Multiple category IDs are combined with OR semantics; the publisher filter
 * is then combined with the category predicate using AND semantics.
 *
 * @param db Drizzle database client used to query games and their relations.
 * @param categoryIds Category IDs to include, or an empty array for all categories.
 * @param publisherId Publisher ID to include, or null for all publishers.
 * @returns Matching games mapped to the application-facing type in title order.
 */
export async function getFilteredGames(
    db: Database,
    categoryIds: number[],
    publisherId: number | null,
): Promise<Game[]> {
    const filters = [];

    if (categoryIds.length > 0) {
        filters.push(inArray(games.categoryId, categoryIds));
    }

    if (publisherId !== null) {
        filters.push(eq(games.publisherId, publisherId));
    }

    const query = baseGamesQuery(db);
    const rows = filters.length > 0
        ? await query.where(and(...filters)).orderBy(asc(games.title))
        : await query.orderBy(asc(games.title));

    return rows.map(mapGame);
}

/**
 * Returns all categories in alphabetical order for filter controls.
 *
 * @param db Drizzle database client used to query categories.
 * @returns Categories mapped to the application-facing type.
 */
export async function getAllCategories(db: Database): Promise<Category[]> {
    return db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .orderBy(asc(categories.name));
}

/**
 * Returns all publishers in alphabetical order for filter controls.
 *
 * @param db Drizzle database client used to query publishers.
 * @returns Publishers mapped to the application-facing type.
 */
export async function getAllPublishers(db: Database): Promise<Publisher[]> {
    return db
        .select({ id: publishers.id, name: publishers.name })
        .from(publishers)
        .orderBy(asc(publishers.name));
}

/**
 * Returns all game IDs in title order for dynamic route generation.
 *
 * @param db Drizzle database client used to query games.
 * @returns Game IDs ordered by their titles.
 */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/**
 * Returns one game by ID.
 *
 * @param db Drizzle database client used to query the game and its relations.
 * @param id Numeric game ID to look up.
 * @returns The matching game, or null when no game has that ID.
 */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}

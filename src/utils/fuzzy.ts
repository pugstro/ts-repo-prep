/**
 * Simple Levenshtein distance calculator for fuzzy string matching
 */
export function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

/**
 * Calculate similarity score between two strings (0-100%)
 */
export function similarityScore(a: string, b: string): number {
    const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
    const maxLength = Math.max(a.length, b.length);
    return Math.round(((maxLength - distance) / maxLength) * 100);
}

/**
 * Find fuzzy matches for a target string in a list of candidates
 * @param target - The string to match
 * @param candidates - Array of candidate strings
 * @param threshold - Minimum similarity score (0-100)
 * @param limit - Maximum number of results
 * @returns Array of matches with scores, sorted by score descending
 */
export function findFuzzyMatches(
    target: string,
    candidates: string[],
    threshold: number = 50,
    limit: number = 5
): Array<{ match: string; score: number }> {
    const scored = candidates
        .map(candidate => ({
            match: candidate,
            score: similarityScore(target, candidate)
        }))
        .filter(item => item.score >= threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    return scored;
}

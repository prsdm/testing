/** Default RRF constant (Onyx / Cormack & Clarke). */
export const RRF_K_VALUE = 50;

/**
 * Merge multiple ranked lists with weighted Reciprocal Rank Fusion.
 * Score(item) = Σ weight_i / (k + rank_i). First occurrence of each id is kept.
 */
export function weightedReciprocalRankFusion<T>(args: {
  rankedResults: T[][];
  weights: number[];
  idExtractor: (item: T) => string;
  k?: number;
}): T[] {
  const { rankedResults, weights, idExtractor } = args;
  const k = args.k ?? RRF_K_VALUE;

  if (rankedResults.length !== weights.length) {
    throw new Error(
      `RRF list count (${rankedResults.length}) must match weights (${weights.length})`
    );
  }

  const rrfScores = new Map<string, number>();
  const idToItem = new Map<string, T>();
  const idToSourceIndex = new Map<string, number>();
  const idToSourceRank = new Map<string, number>();

  for (const [sourceIdx, resultList] of rankedResults.entries()) {
    const weight = weights.at(sourceIdx) ?? 0;
    for (const [rankZero, item] of resultList.entries()) {
      const rank = rankZero + 1;
      const itemId = idExtractor(item);
      rrfScores.set(itemId, (rrfScores.get(itemId) ?? 0) + weight / (k + rank));
      if (!idToItem.has(itemId)) {
        idToItem.set(itemId, item);
        idToSourceIndex.set(itemId, sourceIdx);
        idToSourceRank.set(itemId, rank);
      }
    }
  }

  return [...rrfScores.keys()]
    .sort((a, b) => {
      const scoreDiff = (rrfScores.get(b) ?? 0) - (rrfScores.get(a) ?? 0);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      const rankDiff =
        (idToSourceRank.get(a) ?? 0) - (idToSourceRank.get(b) ?? 0);
      if (rankDiff !== 0) {
        return rankDiff;
      }
      return (idToSourceIndex.get(a) ?? 0) - (idToSourceIndex.get(b) ?? 0);
    })
    .map((id) => idToItem.get(id))
    .filter((item): item is T => item !== undefined);
}

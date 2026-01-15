export const IMPACT_ANALYSIS_QUERY = `
WITH RECURSIVE dependency_chain AS (
    -- Base case: Direct dependents of the target symbol
    -- Meaning: Files that import the file where the symbol is defined
    SELECT 
        i.file_path as consumer_path,
        i.module_specifier,
        i.imported_symbols,
        f.path as source_path,
        1 as depth,
        i.file_path || '<-' || f.path as path_chain
    FROM imports i
    JOIN files f ON i.resolved_path = f.path
    WHERE f.path = ? -- The file where our changed symbol lives
      AND (
          -- Exact symbol match or wildcard import
          i.imported_symbols LIKE ? 
          OR i.imported_symbols = '*' 
          OR i.imported_symbols = ''
      )

    UNION ALL

    -- Recursive step: Find consumers of the consumers
    SELECT 
        i.file_path as consumer_path,
        i.module_specifier,
        i.imported_symbols,
        dc.consumer_path as source_path,
        dc.depth + 1,
        i.file_path || '<-' || dc.path_chain
    FROM imports i
    JOIN dependency_chain dc ON i.resolved_path = dc.consumer_path
    WHERE dc.depth < ? -- Max depth limit
      AND instr(dc.path_chain, i.file_path) = 0 -- Cycle detection: ensure we haven't visited this file in this chain
)
SELECT DISTINCT 
    dc.consumer_path,
    dc.depth,
    dc.source_path,
    dc.imported_symbols
FROM dependency_chain dc
ORDER BY dc.depth, dc.consumer_path;
`;

"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { IDEA_SEARCH_MIN, searchIdeas } from "@/lib/api/forums";

/** Ideas already proposed that match what the reader is typing: from 3 letters, 250 ms after they stop. */
export function useIdeaSearch(text: string, limit = 3) {
  const [query, setQuery] = useState(text.trim());
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), 250);
    return () => clearTimeout(timer);
  }, [text]);
  const enabled = query.length >= IDEA_SEARCH_MIN;
  const result = useQuery({
    queryKey: ["idea-search", query, limit],
    queryFn: () => searchIdeas(query, limit),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  return { query, enabled, ideas: enabled ? (result.data ?? null) : null, failed: result.isError };
}
